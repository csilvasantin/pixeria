#!/usr/bin/env python3
"""adaptador-proyectos.py — índice de fichas de proyecto del Adaptador y lista de Yokup.

Cada proyecto con ajustes propios tiene una ficha en adaptaciones/proyectos/<id-yokup>.json
(Carlos, 5-oct-2026). Este script deriva de ellas, sin edición a mano:

  adaptaciones/proyectos/index.json   fichas existentes (id, nombre, alias, recuentos, campañas)
  adaptaciones/proyectos/yokup.json   respaldo de la lista pública de proyectos de Yokup
                                      (GET https://api.yokup.com/projects: solo id, nombre y estado)

  scripts/adaptador-proyectos.py                 regenera index.json
  scripts/adaptador-proyectos.py --yokup         además descarga la lista de Yokup y renueva yokup.json
  scripts/adaptador-proyectos.py --check         no escribe; sale 1 si index.json está desfasado o si
                                                 una ficha usa un id que no está en yokup.json
  scripts/adaptador-proyectos.py --check --yokup además compara yokup.json con Yokup en vivo

El esquema completo de las fichas lo valida test/adapter-proyectos.test.mjs.
"""
import datetime
import glob
import json
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, 'adaptaciones', 'proyectos')
INDEX = os.path.join(DIR, 'index.json')
YOKUP = os.path.join(DIR, 'yokup.json')
YOKUP_URL = 'https://api.yokup.com/projects'
GENERATED = {'index.json', 'yokup.json'}


def dump(data):
    return json.dumps(data, ensure_ascii=False, indent=2) + '\n'


def fichas():
    for path in sorted(glob.glob(os.path.join(DIR, '*.json'))):
        name = os.path.basename(path)
        if name.startswith('_') or name in GENERATED:
            continue
        yield name, json.load(open(path, encoding='utf-8'))


def lista(ficha, clave):
    ref = (ficha.get('formatos') or {}).get(clave)
    if ref is None:
        return []
    if isinstance(ref, list):
        return ref
    path = os.path.normpath(os.path.join(DIR, ref['archivo']))
    if not path.startswith(os.path.join(ROOT, 'adaptaciones') + os.sep):
        sys.exit('✗ %s: formatos.%s.archivo sale de adaptaciones/' % (ficha.get('id'), clave))
    return json.load(open(path, encoding='utf-8'))[ref['clave']]


def build_index():
    out = []
    for name, ficha in fichas():
        estandar, especiales = lista(ficha, 'estandar'), lista(ficha, 'especiales')
        out.append({
            'id': ficha['id'],
            'nombre': ficha['nombre'],
            'alias': ficha.get('alias') or [],
            'archivo': name,
            'formatos': {
                'estandar': len(estandar),
                'especiales': len(especiales),
                'myblu': sum(1 for f in estandar if f.get('myblu')),
            },
            'campanas': [c['id'] for c in ficha.get('campanas') or []],
        })
    return {
        'version': 1,
        'nota': 'Generado por scripts/adaptador-proyectos.py a partir de las fichas de esta carpeta. No editar a mano.',
        'proyectos': out,
    }


def yokup_live():
    req = urllib.request.Request(YOKUP_URL, headers={'Accept': 'application/json', 'User-Agent': 'pixeria-adaptador-proyectos'})
    with urllib.request.urlopen(req, timeout=20) as r:
        data = json.load(r)
    seen, out = set(), []
    for p in data.get('projects') or []:
        pid = str(p.get('id') or '').strip()
        if not pid or pid in seen:
            continue
        seen.add(pid)
        out.append({'id': pid, 'nombre': str(p.get('name') or pid).strip(), 'estado': str(p.get('status') or 'activo')})
    return sorted(out, key=lambda p: p['id'])


def main():
    check = '--check' in sys.argv
    refresh = '--yokup' in sys.argv
    errors = []

    index = build_index()
    current = open(INDEX, encoding='utf-8').read() if os.path.exists(INDEX) else ''
    if current != dump(index):
        if check:
            errors.append('index.json no coincide con las fichas: ejecuta scripts/adaptador-proyectos.py')
        else:
            open(INDEX, 'w', encoding='utf-8').write(dump(index))
            print('✓ index.json · %d ficha(s)' % len(index['proyectos']))

    if refresh:
        live = yokup_live()
        saved = json.load(open(YOKUP, encoding='utf-8')) if os.path.exists(YOKUP) else {}
        if check:
            if saved.get('proyectos') != live:
                errors.append('yokup.json no coincide con %s: ejecuta scripts/adaptador-proyectos.py --yokup' % YOKUP_URL)
        elif saved.get('proyectos') != live:
            open(YOKUP, 'w', encoding='utf-8').write(dump({
                'fuente': YOKUP_URL,
                'actualizado': datetime.date.today().isoformat(),
                'nota': 'Respaldo de la lista pública de proyectos de Yokup (id, nombre, estado). El Adaptador la pide en vivo y usa este archivo si Yokup no responde.',
                'proyectos': live,
            }))
            print('✓ yokup.json · %d proyectos' % len(live))

    ids = {p['id'] for p in (json.load(open(YOKUP, encoding='utf-8')).get('proyectos') or [])} if os.path.exists(YOKUP) else set()
    for p in index['proyectos']:
        if p['id'] not in ids:
            errors.append('la ficha %s usa un id que no está en la lista de Yokup' % p['archivo'])

    for e in errors:
        print('✗ ' + e)
    if check and not errors:
        print('✓ %d ficha(s) al día y con id de Yokup' % len(index['proyectos']))
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
