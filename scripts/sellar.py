#!/usr/bin/env python3
"""sellar.py — propaga el sello canónico de release a TODAS las páginas de Pixeria.

Por qué (MorfeoMacMini, 1-sep-2026 · FLT-1484 · Normativa 09 y 13): el sello vivía
a mano en cada página, así que se bumpeaba index.html y las otras 68 se quedaban
atrás. Auditoría de ese día: de 69 páginas, 5 decían la versión buena, 14 una
rancia (la HOME enseñaba una de 25 días antes) y 50 no decían nada. /webmaster
daba pixeria por verde porque solo mira index.html.

  scripts/sellar.py                         propaga el sello que ya tiene index.html
  scripts/sellar.py v.01.09.2026.r1.09:12   fija ese sello y lo propaga
  scripts/sellar.py --check                 no toca nada; sale 1 si algo está desalineado

Toca dos sitios por página: el <meta name="admiranext-version"> (lo que lee
/webmaster) y el <span class="rail-ver"> visible, cuando existe.
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_DIRS = {'.git', 'node_modules', '.wrangler'}
PREFIX = 'Pixeria '
VER_RE = re.compile(r'^v\.\d{2}\.\d{2}\.\d{4}\.r\d+\.\d{2}:\d{2}$')
META_RE = re.compile(r'(<meta\s+name="admiranext-version"\s+content=")([^"]*)(">)')
RAIL_RE = re.compile(r'(<span class="rail-ver">)([^<]*)(</span>)')
VIEWPORT_RE = re.compile(r'<meta\s+name="viewport"[^>]*>')
HEAD_RE = re.compile(r'<head[^>]*>')
# El ?v= de los assets propios sale del sello (Carlos, 29-sep-2026): /assets se
# sirve con max-age=14400, así que un release que cambia cuadratura.js pero deja
# el ?v= de ayer (y lo mismo workspace.css, app.js…) se ve en local y NO en la web hasta 4 h después. Cada sello
# nuevo cambia todas las URLs de /assets y el navegador baja lo publicado.
ASSET_RE = re.compile(r'''(["'](?!https?:|//)[\w./-]+\.(?:js|css))\?v=[^"'\s>]*''')


def pages():
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in sorted(filenames):
            if name.endswith('.html'):
                yield os.path.join(dirpath, name)


def canonical():
    """El sello de index.html manda: es el que lee deploy.sh para firmar el release."""
    src = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    found = META_RE.search(src)
    if not found:
        sys.exit('✗ index.html no tiene <meta name="admiranext-version">: no hay canónico que propagar')
    return found.group(2).replace(PREFIX, '').strip()


def stamp(path, version, dry):
    """Deja la página con el sello `version`. Devuelve la lista de cambios."""
    src = open(path, encoding='utf-8').read()
    out, changes = src, []
    content = PREFIX + version

    found = META_RE.search(out)
    if found:
        if found.group(2) != content:
            out = META_RE.sub(lambda m: m.group(1) + content + m.group(3), out, count=1)
            changes.append('meta ' + (found.group(2) or '(vacío)'))
    elif '<head' in out:
        tag = '  <meta name="admiranext-version" content="%s">\n' % content
        anchor = VIEWPORT_RE.search(out) or HEAD_RE.search(out)
        if anchor:
            out = out[:anchor.end()] + '\n' + tag.rstrip('\n') + out[anchor.end():]
            changes.append('meta AUSENTE')

    if RAIL_RE.search(out):
        for rail in RAIL_RE.finditer(out):
            if rail.group(2) != content:
                changes.append('visible ' + rail.group(2))
        out = RAIL_RE.sub(lambda m: m.group(1) + content + m.group(3), out)

    token = version[2:].replace(':', '')
    stale = [m.group(0) for m in ASSET_RE.finditer(out) if not m.group(0).endswith('?v=' + token)]
    if stale:
        out = ASSET_RE.sub(lambda m: m.group(1) + '?v=' + token, out)
        changes.append('assets ?v= (%d)' % len(stale))

    if changes and not dry:
        open(path, 'w', encoding='utf-8').write(out)
    return changes


def version_json(version, dry=False):
    """version.json del repo = sello actual: el despliegue automático desde git lo publica tal cual."""
    import json, datetime
    path = os.path.join(ROOT, 'version.json')
    try:
        data = json.load(open(path, encoding='utf-8'))
    except Exception:
        data = {}
    if dry:
        return data.get('version') == version
    try:
        firma = json.load(open(os.path.join(ROOT, 'release-signature.json'), encoding='utf-8'))
    except Exception:
        firma = {}
    data['version'] = version
    for k in ('deployer', 'machine', 'signature', 'agent'):
        if firma.get(k):
            data[k] = firma[k]
    data['builtAt'] = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    open(path, 'w', encoding='utf-8').write(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    return True


def main():
    args = [a for a in sys.argv[1:] if a != '--check']
    dry = '--check' in sys.argv
    version = args[0] if args else canonical()
    version = version.replace(PREFIX, '').strip()
    if not VER_RE.match(version):
        sys.exit('✗ «%s» no es un sello v.DD.MM.AAAA.rN.HH:MM (Normativa 07)' % version)

    if args and not dry:
        stamp(os.path.join(ROOT, 'index.html'), version, dry=False)
        version_json(version)

    touched = 0
    for path in pages():
        changes = stamp(path, version, dry)
        if changes:
            touched += 1
            print('  %-42s %s' % (os.path.relpath(path, ROOT), ' · '.join(changes)))

    total = sum(1 for _ in pages())
    if dry and not version_json(version, dry=True):
        print('✗ version.json no dice %s (el despliegue automático desde git lo publicaría viejo)' % version)
        return 1
    if dry:
        if touched:
            print('\n✗ %d de %d páginas NO dicen %s' % (touched, total, version))
            return 1
        print('✓ las %d páginas dicen %s' % (total, version))
        return 0
    print('\n✓ %d de %d páginas selladas con %s' % (touched, total, version))
    return 0


if __name__ == '__main__':
    sys.exit(main())
