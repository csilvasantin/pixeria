#!/usr/bin/env python3
"""stock-subir.py — publica ficheros LOCALES en el Stock de Pixeria, del tamaño que sean.

Por qué existe
--------------
El botón «Archivos locales → Stock» de pixeria.com manda el asset a
/stock/publish como data: URL dentro de un JSON. Base64 infla un 33% y el borde
de Cloudflare corta el cuerpo de la petición en 100 MB — medido, no estimado:
un cuerpo de 105 MB devuelve 413 antes de llegar al Worker. Eso deja el techo
por navegador en ~74 MB de fichero, y un episodio completo no cabe.

Cuando el fichero se pasa de ese techo, este script lo SUBE POR PARTES: abre una
multiparte de R2 en el Worker, manda trozos de 25 MB —cada uno en su propia
petición, así el límite de cuerpo deja de importar— y lo cierra. Entra entero y
sin perder un bit.

Si el Worker todavía no tiene esos endpoints, cae al plan B de antes:
RECODIFICAR con ffmpeg hasta que quepa. Pierde calidad, pero entra. El original
no se toca en ninguno de los dos casos.

Desde el 9-oct-2026 va por partes todo lo que pasa de 8 MB (--max-mb), no solo
lo que no cabe en 100 MB: en base64 dentro del JSON, desde unos 40 MB el Worker
se quedaba sin memoria (503 «Worker exceeded resource limits»). Cada trozo se
lee del disco a bloques de 1 MB mientras se envía (nunca el fichero ni el trozo
entero en memoria), se reintenta hasta 3 veces si falla la red o el Worker
responde 408, 429 o 5xx, y si no hay manera se aborta la subida. Tope: 2 GB, el
del Worker. Lo de 8 MB o menos sigue en base64, como siempre.

Uso
---
    ./stock-subir.py episodio1.mp4 episodio2.mp4 ...
    ./stock-subir.py --comentario "Animatrix · interno" ~/Downloads/*.mp4
    ./stock-subir.py --dry-run fichero.mp4     # sin publicar, dice qué haría
    ./stock-subir.py --max-mb 70 fichero.mp4   # base64 hasta 70 MB (no recomendado)

Opciones útiles: --tipo, --motor, --titulo, --comentario, --max-mb, --sin-recodificar.
STOCK_API en el entorno apunta a otro Worker (para probar contra `wrangler dev`).

NeoMBP16 · MacBook Pro 16 · 28-08-2026
"""
import argparse
import base64
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

API = os.environ.get("STOCK_API", "https://api.admira.store")
PUBLISH = API + "/stock/publish"

# Hasta aquí, base64 en una sola petición; por encima, por partes (como el
# Adaptador y el Stock de pixeria.com: PARTS_THRESHOLD de adaptaciones/stock-publish.mjs).
# Era 70 MB y en base64 el Worker ya se caía desde unos 40.
MAX_MB_DEF = 8

# Lo más que cabe en UNA petición base64: el borde corta el cuerpo en 100 MB (413,
# comprobado) y base64 multiplica por 4/3. Solo cuenta en el plan B, si el Worker
# no tuviera la subida por partes: entonces se recodifica hasta caber aquí.
BASE64_MAX_MB = 70

# Tope de fichero: el del Worker para la subida por partes (STOCK_STAGED_MAX).
TOPE_MB = 2048

# Subida por partes: intentos por trozo (1 + 2 reintentos) y bloque de lectura.
INTENTOS_TROZO = 3
BLOQUE = 1024 * 1024

# Sin User-Agent de navegador, Cloudflare responde 403 «error code: 1010»
# (Browser Integrity Check) y la petición no llega ni al Worker.
CABECERAS = {
    "User-Agent": ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                   "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36"),
    "Origin": "https://www.pixeria.com",
    "Referer": "https://www.pixeria.com/stock",
}

EXT_TIPO = {
    ".mp4": "video", ".mov": "video", ".m4v": "video", ".webm": "video", ".mkv": "video",
    ".mp3": "audio", ".m4a": "audio", ".wav": "audio", ".aac": "audio", ".ogg": "audio",
    ".png": "image", ".jpg": "image", ".jpeg": "image", ".webp": "image", ".gif": "image",
}
EXT_MIME = {
    ".mp4": "video/mp4", ".mov": "video/quicktime", ".m4v": "video/x-m4v",
    ".webm": "video/webm", ".mkv": "video/x-matroska",
    ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".wav": "audio/wav",
    ".aac": "audio/aac", ".ogg": "audio/ogg",
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".webp": "image/webp", ".gif": "image/gif",
}


def mb(n):
    return n / 1048576.0


def duracion(path):
    """Segundos del media, o 0 si ffprobe no sabe decirlo."""
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=nw=1:nk=1", path],
            capture_output=True, text=True, timeout=120,
        ).stdout.strip()
        return float(out)
    except Exception:
        return 0.0


def recodificar(origen, destino, objetivo_bytes, altura_max=720):
    """Recodifica a H.264/AAC apuntando a `objetivo_bytes`.

    El bitrate sale de la duración, no de una constante: un episodio de 10 min y
    uno de 40 no admiten el mismo ajuste. Se reserva un 6% de margen porque el
    contenedor y el VBR se pasan un poco de lo pedido.
    """
    seg = duracion(origen)
    if seg <= 0:
        return False, "ffprobe no pudo leer la duración"
    audio_kbps = 128
    total_kbps = (objetivo_bytes * 8 / seg) / 1000 * 0.94
    video_kbps = int(total_kbps - audio_kbps)
    if video_kbps < 150:
        return False, ("haría falta bajar a %d kbps de vídeo (%.0f min): "
                       "no merece la pena, pártelo en trozos" % (video_kbps, seg / 60))
    cmd = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", origen,
        "-vf", "scale=-2:'min(%d,ih)'" % altura_max,
        "-c:v", "libx264", "-preset", "medium",
        "-b:v", "%dk" % video_kbps,
        "-maxrate", "%dk" % int(video_kbps * 1.35),
        "-bufsize", "%dk" % int(video_kbps * 2),
        "-profile:v", "high", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "%dk" % audio_kbps,
        "-movflags", "+faststart",
        destino,
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return False, (r.stderr or "").strip()[-300:]
    return True, "%d kbps de vídeo · alto máx %dp" % (video_kbps, altura_max)


class TrozoFichero:
    """El trozo [inicio, inicio+largo) de un fichero abierto, para mandarlo SIN cargarlo.

    urllib lo va leyendo a bloques mientras envía (con el Content-Length puesto a
    mano, así no cae en chunked). Nunca devuelve más de BLOQUE de una vez.
    """

    def __init__(self, f, inicio, largo):
        self.f = f
        self.resta = largo
        f.seek(inicio)

    def read(self, n=-1):
        if self.resta <= 0:
            return b""
        if n is None or n < 0 or n > self.resta:
            n = self.resta
        b = self.f.read(min(n, BLOQUE))
        self.resta -= len(b)
        return b


def peticion(path, datos, metodo="POST", tipo="application/json", largo=None, timeout=600):
    """Una petición al Worker. Devuelve (estado HTTP o None si no hubo respuesta, dict|str)."""
    cab = dict(CABECERAS)
    cab["Content-Type"] = tipo
    if largo is not None:
        cab["Content-Length"] = str(largo)
    req = urllib.request.Request(API + path, data=datos, method=metodo, headers=cab)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        with e:
            return e.code, "HTTP %s · %s" % (e.code, e.read().decode("utf-8", "replace")[:200])
    except Exception as e:
        return None, str(e)


def pedir(path, obj, metodo="POST", timeout=600):
    """POST JSON contra el Worker. Devuelve (ok, dict|str)."""
    estado, d = peticion(path, json.dumps(obj).encode("utf-8"), metodo=metodo, timeout=timeout)
    return estado is not None and 200 <= estado < 300, d


def subir_por_partes(path, mime, abrir=open, esperar=time.sleep):
    """Sube el fichero entero a uploads/ troceándolo. Devuelve (clave, detalle).

    clave None + detalle 'sin-soporte' = este Worker todavía no tiene los
    endpoints; el que llama debe seguir por el camino de siempre.
    """
    tam = os.path.getsize(path)
    ok, ini = pedir("/stock/upload/init", {"mime": mime, "size": tam})
    if not ok:
        if "404" in str(ini) or "no encontrado" in str(ini):
            return None, "sin-soporte"
        return None, str(ini)
    key, up = ini.get("key"), ini.get("uploadId")
    trozo_max = int(ini.get("partSize") or 25 * 1024 * 1024)
    if not key or not up:
        return None, "sin-soporte"
    partes, hecho = [], 0
    total = max(1, -(-tam // trozo_max))
    with abrir(path, "rb") as f:
        for n in range(1, total + 1):
            inicio = (n - 1) * trozo_max
            largo = min(trozo_max, tam - inicio)
            q = "?key=%s&uploadId=%s&n=%d" % (
                urllib.parse.quote(key, safe=""), urllib.parse.quote(up, safe=""), n)
            for intento in range(1, INTENTOS_TROZO + 1):
                estado, d = peticion("/stock/upload/part" + q, TrozoFichero(f, inicio, largo),
                                     metodo="PUT", tipo="application/octet-stream", largo=largo)
                if estado is not None and 200 <= estado < 300 and isinstance(d, dict) and d.get("etag"):
                    break
                reintentable = estado is None or estado in (408, 429) or estado >= 500
                if not reintentable or intento == INTENTOS_TROZO:
                    pedir("/stock/upload/abort", {"key": key, "uploadId": up})
                    return None, "trozo %d: %s" % (n, d)
                sys.stdout.write("\r      … trozo %d falló (%s); reintento %d\n" % (n, d, intento))
                esperar(intento)
            partes.append({"partNumber": d.get("partNumber") or n, "etag": d["etag"]})
            hecho += largo
            sys.stdout.write("\r      … %d de %d MB en %d trozos" % (hecho // 1048576, tam // 1048576, n))
            sys.stdout.flush()
    sys.stdout.write("\r" + " " * 60 + "\r")
    ok, d = pedir("/stock/upload/complete", {"key": key, "uploadId": up, "parts": partes})
    if not ok:
        pedir("/stock/upload/abort", {"key": key, "uploadId": up})
        return None, "cierre: %s" % d
    return key, "%d trozos · %.1f MB" % (len(partes), mb(d.get("size") or tam))


def publicar_staged(key, tipo, mime, motor, titulo, comentario, prompt, tam=0):
    # Los mismos campos que el camino base64 (publicar): la entrada del Stock sale igual.
    ok, d = pedir("/stock/publish", {
        "type": tipo, "motor": motor, "mime": mime, "r2Staged": key,
        "costEst": "local · %.1fMB" % mb(tam),
        "title": (titulo or "")[:120] or None,
        "comment": (comentario or "")[:500] or None,
        "prompt": (prompt or "")[:500] or None,
    })
    if not ok:
        return False, str(d)
    if not d.get("ok", True) and d.get("error"):
        return False, str(d.get("error"))
    return True, d.get("id") or "publicado"


def publicar(path, tipo, mime, motor, titulo, comentario, prompt, dry):
    with open(path, "rb") as f:
        crudo = f.read()
    b64 = base64.b64encode(crudo).decode("ascii")
    payload = {
        "type": tipo, "motor": motor, "base64": b64, "mime": mime,
        "costEst": "local · %.1fMB" % mb(len(crudo)),
    }
    if titulo:
        payload["title"] = titulo[:120]
    if comentario:
        payload["comment"] = comentario[:500]
    if prompt:
        payload["prompt"] = prompt[:500]
    cuerpo = json.dumps(payload).encode("utf-8")
    if dry:
        return True, "DRY-RUN · cuerpo %.1f MB (tope 100 MB)" % mb(len(cuerpo))
    if len(cuerpo) > 100 * 1024 * 1024:
        return False, "el cuerpo saldría de %.1f MB y el borde corta en 100" % mb(len(cuerpo))
    # Sin User-Agent de navegador, Cloudflare responde 403 «error code: 1010»
    # (Browser Integrity Check) y no llega ni al Worker. Con el de urllib pasaba
    # siempre; con este, no. Comprobado el 28-08-2026.
    req = urllib.request.Request(
        PUBLISH, data=cuerpo, method="POST",
        headers={
            "Content-Type": "application/json",
            "User-Agent": ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                           "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36"),
            "Origin": "https://www.pixeria.com",
            "Referer": "https://www.pixeria.com/stock",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            d = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return False, "HTTP %s · %s" % (e.code, e.read().decode("utf-8", "replace")[:200])
    except Exception as e:
        return False, str(e)
    if not d.get("ok", True) and d.get("error"):
        return False, str(d.get("error"))
    return True, d.get("id") or json.dumps(d)[:120]


def main():
    ap = argparse.ArgumentParser(description="Publica ficheros locales en el Stock de Pixeria.")
    ap.add_argument("ficheros", nargs="+")
    ap.add_argument("--tipo", default=None, help="video|audio|image (por defecto, por extensión)")
    ap.add_argument("--motor", default="local")
    ap.add_argument("--titulo", default=None, help="por defecto, el nombre del fichero sin extensión")
    ap.add_argument("--comentario", default=None, help="indexable por búsqueda en el Stock")
    ap.add_argument("--max-mb", type=float, default=MAX_MB_DEF,
                    help="hasta aquí, base64 en una petición; por encima, por partes (por defecto 8)")
    ap.add_argument("--sin-recodificar", action="store_true",
                    help="no llamar a ffmpeg: si no cabe, se salta")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    umbral = int(a.max_mb * 1024 * 1024)
    tope_base64 = BASE64_MAX_MB * 1024 * 1024   # solo en el plan B (Worker sin subida por partes)
    total = len(a.ficheros)
    ok = 0
    tmpdir = tempfile.mkdtemp(prefix="stock-subir-")

    for i, path in enumerate(a.ficheros, 1):
        pre = "[%d/%d]" % (i, total)
        if not os.path.isfile(path):
            print("%s ✗ %s — no existe" % (pre, path))
            continue
        ext = os.path.splitext(path)[1].lower()
        tipo = a.tipo or EXT_TIPO.get(ext)
        mime = EXT_MIME.get(ext, "application/octet-stream")
        if not tipo:
            print("%s ✗ %s — no sé qué tipo es (usa --tipo)" % (pre, path))
            continue
        tam = os.path.getsize(path)
        subir = path
        nota = ""
        print("%s %s · %.1f MB" % (pre, os.path.basename(path), mb(tam)))
        if tam > TOPE_MB * 1024 * 1024:
            print("      ✗ pasa del tope del Stock (%d MB)" % TOPE_MB)
            continue

        if tam > umbral:
            if a.dry_run:
                trozos = max(1, -(-tam // (25 * 1024 * 1024)))
                print("      ✓ DRY-RUN · por partes: %d trozos de 25 MB como mucho" % trozos)
                ok += 1
                continue
            # Por partes: entra ENTERO y sin perder calidad, y el Worker nunca
            # tiene el fichero en memoria. Recodificar es el plan B de cuando el
            # Worker no sabía trocear.
            print("      … más de %g MB: subiendo por partes" % a.max_mb)
            clave, det = subir_por_partes(path, mime)
            if clave:
                bien, det2 = publicar_staged(clave, tipo, mime, a.motor,
                                             a.titulo or os.path.splitext(os.path.basename(path))[0],
                                             a.comentario, os.path.basename(path), tam)
                print("      %s %s (%s)" % ("✓" if bien else "✗", det2, det))
                if bien:
                    ok += 1
                continue
            if det != "sin-soporte":
                print("      ✗ subida por partes: %s" % det)
                continue
            print("      … este Stock aún no trocea; va en una sola petición")

        if tam > tope_base64:
            if a.sin_recodificar or tipo != "video":
                print("      ✗ se pasa del tope de %.0f MB y no se recodifica" % mb(tope_base64))
                continue
            destino = os.path.join(tmpdir, "cabe-%d.mp4" % i)
            print("      … no cabe: recodificando con ffmpeg para que quepa (el original no se toca)")
            bien, det = recodificar(path, destino, tope_base64)
            if not bien:
                print("      ✗ no se pudo recodificar: %s" % det)
                continue
            nuevo = os.path.getsize(destino)
            if nuevo > tope_base64:
                print("      … sigue en %.1f MB, segundo intento a 480p" % mb(nuevo))
                bien, det = recodificar(path, destino, tope_base64, altura_max=480)
                nuevo = os.path.getsize(destino) if bien else nuevo
            if nuevo > tope_base64:
                print("      ✗ ni así cabe (%.1f MB). Pártelo en trozos." % mb(nuevo))
                continue
            print("      ✓ %.1f MB (%s)" % (mb(nuevo), det))
            subir = destino
            nota = "recodificado para caber en el Stock (original %.1f MB)" % mb(tam)
            mime = "video/mp4"

        titulo = a.titulo or os.path.splitext(os.path.basename(path))[0]
        comentario = " · ".join(x for x in [a.comentario, nota] if x) or None
        bien, det = publicar(subir, tipo, mime, a.motor, titulo, comentario,
                             os.path.basename(path), a.dry_run)
        print("      %s %s" % ("✓" if bien else "✗", det))
        if bien:
            ok += 1

    print("\n%d de %d en el Stock · https://www.pixeria.com/stock" % (ok, total))
    return 0 if ok == total else 1


if __name__ == "__main__":
    sys.exit(main())
