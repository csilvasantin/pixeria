#!/usr/bin/env python3
"""stock-subir.py — publica ficheros LOCALES en el Stock de Pixeria, del tamaño que sean.

Por qué existe
--------------
El botón «Archivos locales → Stock» de pixeria.com manda el asset a
/stock/publish como data: URL dentro de un JSON. Base64 infla un 33% y el borde
de Cloudflare corta el cuerpo de la petición en 100 MB — medido, no estimado:
un cuerpo de 105 MB devuelve 413 antes de llegar al Worker. Eso deja el techo
por navegador en ~74 MB de fichero, y un episodio completo no cabe.

Este script hace lo mismo desde el terminal y, cuando el fichero se pasa, lo
RECODIFICA con ffmpeg para que quepa en vez de rendirse. El original no se toca.

Uso
---
    ./stock-subir.py episodio1.mp4 episodio2.mp4 ...
    ./stock-subir.py --comentario "Animatrix · interno" ~/Downloads/*.mp4
    ./stock-subir.py --dry-run fichero.mp4     # sin publicar, dice qué haría

Opciones útiles: --tipo, --motor, --titulo, --comentario, --max-mb, --sin-recodificar.

La solución de verdad para ficheros grandes es una subida multiparte a R2 desde
el Worker (createMultipartUpload), que esquiva el límite de cuerpo troceando.
Eso exige desplegar pixer-eleven, y el token de la Cúpula de este Mac es solo de
Pages. Mientras tanto, esto funciona hoy y sin depender de nadie.

NeoMBP16 · MacBook Pro 16 · 28-08-2026
"""
import argparse
import base64
import json
import os
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request

API = os.environ.get("STOCK_API", "https://api.admira.store")
PUBLISH = API + "/stock/publish"

# Tope de FICHERO. El cuerpo de la petición no puede pasar de 100 MB (413 del
# borde, comprobado) y base64 multiplica por 4/3, así que 74 MB es el máximo
# teórico. 70 deja aire para el resto del JSON y para reintentos.
MAX_MB_DEF = 70

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
    ap.add_argument("--max-mb", type=float, default=MAX_MB_DEF)
    ap.add_argument("--sin-recodificar", action="store_true",
                    help="no llamar a ffmpeg: si no cabe, se salta")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    tope = int(a.max_mb * 1024 * 1024)
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

        if tam > tope:
            if a.sin_recodificar or tipo != "video":
                print("      ✗ se pasa del tope de %.0f MB y no se recodifica" % a.max_mb)
                continue
            destino = os.path.join(tmpdir, "cabe-%d.mp4" % i)
            print("      … no cabe: recodificando con ffmpeg para que quepa (el original no se toca)")
            bien, det = recodificar(path, destino, tope)
            if not bien:
                print("      ✗ no se pudo recodificar: %s" % det)
                continue
            nuevo = os.path.getsize(destino)
            if nuevo > tope:
                print("      … sigue en %.1f MB, segundo intento a 480p" % mb(nuevo))
                bien, det = recodificar(path, destino, tope, altura_max=480)
                nuevo = os.path.getsize(destino) if bien else nuevo
            if nuevo > tope:
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
