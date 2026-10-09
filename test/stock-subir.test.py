#!/usr/bin/env python3
"""Pruebas de scripts/stock-subir.py contra un Worker FALSO en 127.0.0.1 (nada sale a la red).

Desde el 9-oct-2026 todo lo que pasa de 8 MB sube por partes (/stock/upload/init → part →
complete → /stock/publish {r2Staged}) leyendo del disco a bloques, con reintentos por trozo y
abort si no hay manera. Lo pequeño sigue en base64. Se ejecuta con:

    python3 test/stock-subir.test.py

(test/stock-subir-py.test.mjs lo lanza dentro de `node --test`.)
"""
import importlib.util
import io
import json
import os
import sys
import tempfile
import threading
import unittest
from contextlib import redirect_stdout
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

AQUI = os.path.dirname(os.path.abspath(__file__))
MB = 1024 * 1024


class WorkerFalso(BaseHTTPRequestHandler):
    """Imita /stock/upload/* y /stock/publish del Worker; anota cada petición."""
    estado = None  # dict compartido que pone cada test

    def log_message(self, *a):
        pass

    def _responder(self, codigo, obj):
        cuerpo = json.dumps(obj).encode()
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.end_headers()
        self.wfile.write(cuerpo)

    def _cuerpo(self):
        if self.headers.get("Transfer-Encoding", "").lower() == "chunked":
            return None  # el script nunca debe mandar chunked: R2 exige longitud conocida
        return self.rfile.read(int(self.headers.get("Content-Length") or 0))

    def do_POST(self):
        self._manejar("POST")

    def do_PUT(self):
        self._manejar("PUT")

    def _manejar(self, metodo):
        e = WorkerFalso.estado
        url = urlparse(self.path)
        datos = self._cuerpo()
        reg = {"metodo": metodo, "ruta": url.path, "ua": self.headers.get("User-Agent"),
               "origin": self.headers.get("Origin"), "chunked": datos is None}
        e["llamadas"].append(reg)
        if url.path == "/stock/upload/init":
            if e.get("sin_partes"):
                return self._responder(404, {"error": "not-found"})
            reg["json"] = json.loads(datos)
            return self._responder(200, {"ok": True, "key": "uploads/abc123-def456.mp4", "uploadId": "up-1",
                                         "partSize": e["part_size"], "maxParts": 400})
        if url.path == "/stock/upload/part":
            q = parse_qs(url.query)
            n = int(q["n"][0])
            reg.update(n=n, bytes=len(datos or b""), key=q["key"][0], uploadId=q["uploadId"][0])
            fallos = e["fallos"].get(n) or []
            if fallos:
                return self._responder(fallos.pop(0), {"error": "part-failed"})
            e["trozos"][n] = datos
            return self._responder(200, {"ok": True, "partNumber": n, "etag": "e%d" % n})
        if url.path == "/stock/upload/complete":
            reg["json"] = json.loads(datos)
            total = sum(len(e["trozos"][p["partNumber"]]) for p in reg["json"]["parts"])
            return self._responder(200, {"ok": True, "key": reg["json"]["key"], "size": total})
        if url.path == "/stock/upload/abort":
            reg["json"] = json.loads(datos)
            return self._responder(200, {"ok": True, "aborted": True})
        if url.path == "/stock/publish":
            reg["json"] = json.loads(datos)
            return self._responder(200, {"ok": True, "id": "stk-1"})
        return self._responder(404, {"error": "not-found"})


def cargar_script(api):
    os.environ["STOCK_API"] = api
    spec = importlib.util.spec_from_file_location("stock_subir", os.path.join(AQUI, "..", "scripts", "stock-subir.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class LectorEspia:
    """Fichero que anota cuánto se pide en cada read(): nunca el fichero entero."""

    def __init__(self, path, lecturas):
        self.f = open(path, "rb")
        self.lecturas = lecturas

    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.f.close()

    def seek(self, n):
        self.f.seek(n)

    def read(self, n=-1):
        self.lecturas.append(n)
        return self.f.read(n)


class StockSubirTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), WorkerFalso)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.mod = cargar_script("http://127.0.0.1:%d" % cls.server.server_address[1])
        cls.tmp = tempfile.mkdtemp(prefix="stock-subir-test-")

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        WorkerFalso.estado = {"llamadas": [], "trozos": {}, "fallos": {}, "part_size": 4 * MB}

    def fichero(self, nombre, tam):
        path = os.path.join(self.tmp, nombre)
        with open(path, "wb") as f:
            f.write(bytes((i * 7) & 255 for i in range(256)) * (tam // 256) + b"x" * (tam % 256))
        return path

    def main(self, *args):
        viejo = sys.argv
        sys.argv = ["stock-subir.py"] + list(args)
        salida = io.StringIO()
        try:
            with redirect_stdout(salida):
                codigo = self.mod.main()
        finally:
            sys.argv = viejo
        return codigo, salida.getvalue()

    def rutas(self):
        return [c["ruta"] for c in WorkerFalso.estado["llamadas"]]

    def test_pequeno_va_en_base64_como_siempre(self):
        path = self.fichero("clip.mp4", 1 * MB)
        codigo, _ = self.main(path)
        self.assertEqual(codigo, 0)
        self.assertEqual(self.rutas(), ["/stock/publish"])
        pub = WorkerFalso.estado["llamadas"][0]
        self.assertIn("base64", pub["json"])
        self.assertIn("Chrome/", pub["ua"])  # UA de navegador: sin él, Cloudflare da 403 1010
        self.assertEqual(pub["origin"], "https://www.pixeria.com")

    def test_mas_de_8_mb_sube_por_partes_sin_chunked_y_publica_con_r2staged(self):
        path = self.fichero("episodio.mp4", 10 * MB + 123)
        codigo, salida = self.main(path, "--comentario", "Animatrix")
        self.assertEqual(codigo, 0, salida)
        e = WorkerFalso.estado
        self.assertEqual(self.rutas(), ["/stock/upload/init"] + ["/stock/upload/part"] * 3
                         + ["/stock/upload/complete", "/stock/publish"])
        self.assertEqual(e["llamadas"][0]["json"], {"mime": "video/mp4", "size": 10 * MB + 123})
        partes = [c for c in e["llamadas"] if c["ruta"] == "/stock/upload/part"]
        self.assertEqual([p["bytes"] for p in partes], [4 * MB, 4 * MB, 2 * MB + 123])
        self.assertTrue(all(p["metodo"] == "PUT" and not p["chunked"] and "Chrome/" in p["ua"] for p in partes))
        with open(path, "rb") as f:
            self.assertEqual(b"".join(e["trozos"][n] for n in (1, 2, 3)), f.read())
        pub = e["llamadas"][-1]["json"]
        self.assertEqual(pub["r2Staged"], "uploads/abc123-def456.mp4")
        self.assertNotIn("base64", pub)
        self.assertEqual(pub["costEst"], "local · 10.0MB")  # mismos campos que el carril base64
        self.assertEqual(pub["comment"], "Animatrix")
        self.assertEqual(pub["title"], "episodio")

    def test_nunca_lee_el_fichero_entero_ni_un_trozo_entero(self):
        path = self.fichero("largo.mp4", 9 * MB)
        lecturas = []
        with redirect_stdout(io.StringIO()):
            clave, det = self.mod.subir_por_partes(path, "video/mp4", abrir=lambda p, m: LectorEspia(p, lecturas))
        self.assertEqual(clave, "uploads/abc123-def456.mp4", det)
        self.assertTrue(lecturas)
        self.assertTrue(all(0 < n <= self.mod.BLOQUE for n in lecturas), max(lecturas))

    def test_un_trozo_que_falla_se_reintenta(self):
        WorkerFalso.estado["fallos"] = {2: [502, 503]}
        path = self.fichero("reintento.mp4", 9 * MB)
        esperas = []
        with redirect_stdout(io.StringIO()):
            clave, det = self.mod.subir_por_partes(path, "video/mp4", esperar=esperas.append)
        self.assertEqual(clave, "uploads/abc123-def456.mp4", det)
        self.assertEqual(esperas, [1, 2])
        self.assertEqual(len([c for c in WorkerFalso.estado["llamadas"] if c.get("n") == 2]), 3)
        self.assertNotIn("/stock/upload/abort", self.rutas())

    def test_si_un_trozo_no_entra_se_aborta_y_no_se_publica(self):
        WorkerFalso.estado["fallos"] = {2: [503, 503, 503]}
        path = self.fichero("roto.mp4", 9 * MB)
        codigo, salida = self.main(path)
        self.assertEqual(codigo, 1)
        self.assertIn("/stock/upload/abort", self.rutas())
        self.assertNotIn("/stock/upload/complete", self.rutas())
        self.assertNotIn("/stock/publish", self.rutas())
        self.assertIn("trozo 2", salida)

    def test_un_4xx_no_se_reintenta(self):
        WorkerFalso.estado["fallos"] = {1: [400]}
        path = self.fichero("malo.mp4", 9 * MB)
        with redirect_stdout(io.StringIO()):
            clave, det = self.mod.subir_por_partes(path, "video/mp4", esperar=lambda s: self.fail("no debe esperar"))
        self.assertIsNone(clave)
        self.assertEqual(len([c for c in WorkerFalso.estado["llamadas"] if c.get("n") == 1]), 1)
        self.assertIn("/stock/upload/abort", self.rutas())

    def test_worker_sin_subida_por_partes_cae_a_base64_si_cabe(self):
        WorkerFalso.estado["sin_partes"] = True
        path = self.fichero("antiguo.mp4", 9 * MB)
        codigo, salida = self.main(path)
        self.assertEqual(codigo, 0, salida)
        self.assertEqual(self.rutas(), ["/stock/upload/init", "/stock/publish"])
        self.assertIn("base64", WorkerFalso.estado["llamadas"][-1]["json"])

    def test_dry_run_y_tope(self):
        path = self.fichero("seco.mp4", 9 * MB)
        codigo, salida = self.main("--dry-run", path)
        self.assertEqual(codigo, 0)
        self.assertIn("por partes", salida)
        self.assertEqual(self.rutas(), [])
        viejo = self.mod.TOPE_MB
        self.mod.TOPE_MB = 5
        try:
            codigo, salida = self.main(path)
        finally:
            self.mod.TOPE_MB = viejo
        self.assertEqual(codigo, 1)
        self.assertIn("tope del Stock", salida)
        self.assertEqual(self.rutas(), [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
