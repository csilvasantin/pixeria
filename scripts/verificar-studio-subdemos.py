#!/usr/bin/env python3
"""Verifica el contrato de importación, guiones, recursos y formatos del pack."""
from pathlib import Path
from urllib.parse import urlparse
from html.parser import HTMLParser
import json,subprocess,hashlib
root=Path(__file__).resolve().parents[1];manifest=json.loads((root/'demo/studio.subdemos.json').read_text())
assert manifest['version']==1 and manifest['plataforma']=='studio'
assert [(d['letra'],d['id']) for d in manifest['subdemos']]==list(zip('abcde',['voz','musica','imagen','video','adaptar']))
class IDs(HTMLParser):
 def __init__(self):super().__init__();self.ids=set()
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a:self.ids.add(a['id'])
for d in manifest['subdemos']:
 assert d['url'].startswith('https://www.admira.studio/') and d['muestra']['url'].startswith('https://www.pixeria.com/assets/demos/studio-v1/')
 assert d['duracion']==60
 page=urlparse(d['url']).path.strip('/');page=page+'/index.html' if not page.endswith('.html') else page
 parser=IDs();parser.feed((root/page).read_text())
 for action in d['guion']:
  assert action['accion'] in ['di','espera','escribe','elige','señala','clic']
  if action['selector']:assert action['selector'].startswith('#') and action['selector'][1:] in parser.ids,(d['id'],action)
  if action['accion']=='clic':assert action['selector']=='#btn-adaptar','No clic de generación/export/publicación en el ensayo'
 assert all(s['tool'] in ['demo_muestra','adaptacion_plan'] for s in d['steps'])
 sample=root/urlparse(d['muestra']['url']).path.lstrip('/');assert sample.is_file()
 if d['id']=='adaptar':
  assert [v['formato'] for v in d['muestra']['variantes']]==['1920x1080','1080x1920','1080x1080','1920x540']
  for v in d['muestra']['variantes']:
   assert v['url'].startswith('https://www.pixeria.com/assets/demos/studio-v1/');f=root/urlparse(v['url']).path.lstrip('/')
   probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-of','json',str(f)]));stream=next(s for s in probe['streams'] if s['codec_type']=='video')
   assert f"{stream['width']}x{stream['height']}"==v['formato']
   assert stream['codec_name']=='h264' and stream['pix_fmt']=='yuv420p'
   assert hashlib.sha256(f.read_bytes()).hexdigest()==v['sha256']
 single=json.loads((root/'demo/studio-v1'/f"{d['letra']}-{d['id']}.json").read_text());assert single==d
selection=json.loads((root/'demo/studio-seleccion.subdemos.json').read_text());assert selection['proyectos'][0]['demos']==['studio/'+d['id'] for d in manifest['subdemos']]
headers=(root/'_headers').read_text();assert '/demo/studio.subdemos.json\n  Access-Control-Allow-Origin: *' in headers and '/assets/demos/studio-v1/*\n  Access-Control-Allow-Origin: *' in headers
print('OK: 5 subdemos, contrato Neo v1, selectores, pasos sin gasto/publicación, 4 formatos exactos, hashes y CORS.')
