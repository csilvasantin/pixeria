#!/usr/bin/env python3
"""Build an explicit public review package from the public Pixeria source.
Run ONLY in a disposable git-archive staging directory for a Pages preview.
No production routes, secrets, auth bindings or existing access rules change.
"""
import json,re,sys
from pathlib import Path
root=Path(sys.argv[1]).resolve()
if (root/'.git').exists() or root==Path(__file__).resolve().parents[1]:
    raise SystemExit('Use a disposable archive, never the repository or production directory')
for lang in ['es','en']:
    prefix=f'/review/4905/{lang}/'
    for source,destination in [(('en/' if lang=='en' else '')+'video.html','video.html'),(('en/' if lang=='en' else '')+'adaptaciones/index.html','adaptaciones/index.html')]:
        content=(root/source).read_text()
        content=re.sub(r'<!-- GATE-INICIO -->.*?<!-- GATE-FIN -->','',content,flags=re.S)
        content=re.sub(r'<script>if \((?:\(location\.hostname|/\(\^).*?</script>','',content)
        content=content.replace('<head>','<head><base href="'+('/en/' if lang=='en' else '/')+'">',1)
        content=re.sub(r'<body([^>]*)>',lambda m:'<body'+m[1]+' data-preview-root="'+prefix+'">',content,count=1)
        content=content.replace('href="/en/video.html"','href="'+prefix+'video.html"').replace('href="/video.html"','href="'+prefix+'video.html"')
        destination_path=root/prefix.lstrip('/')/destination
        destination_path.parent.mkdir(parents=True,exist_ok=True);destination_path.write_text(content)
# Existing routes continue through the same Functions and server authentication.
# Only these new review pages are explicitly public; source/assets were already public.
routes_path=root/'_routes.json'
routes=json.loads(routes_path.read_text()) if routes_path.exists() else {'version':1,'include':['/*'],'exclude':[]}
routes['exclude']=list(dict.fromkeys(routes['exclude']+['/review/4905/*']))
routes_path.write_text(json.dumps(routes,indent=2)+'\n')
