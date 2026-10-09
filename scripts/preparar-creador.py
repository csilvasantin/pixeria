#!/usr/bin/env python3
from pathlib import Path
root=Path(__file__).resolve().parents[1]
for lang in ('es','en'):
 source=root/('en/adaptaciones/index.html' if lang=='en' else 'adaptaciones/index.html')
 target=root/('en/creador/index.html' if lang=='en' else 'creador/index.html')
 text=source.read_text().replace('<body class="adapt-page">','<body class="adapt-page creator-page">')
 import re
 text=re.sub(r'<title>.*?</title>', '<title>'+('Creator · Campaigns for screens' if lang=='en' else 'Creador · Campañas para pantallas')+' | Pixeria</title>',text)
 text=re.sub(r'(<meta name="description" content=")[^"]*',lambda m:m[1]+('Create campaigns from scratch for every screen configuration, with editable product, logo and copy.' if lang=='en' else 'Crea campañas desde cero para cada configuración de pantallas, con producto, logo y mensaje editables.'),text)
 text=text.replace('https://www.pixeria.com/en/adaptaciones/','https://www.pixeria.com/en/creador/').replace('https://www.pixeria.com/adaptaciones/','https://www.pixeria.com/creador/')
 text=text.replace('<section id="sec-adapt" class="card">','<section id="sec-adapt" class="card" hidden>')
 target.parent.mkdir(parents=True,exist_ok=True);target.write_text(text)
