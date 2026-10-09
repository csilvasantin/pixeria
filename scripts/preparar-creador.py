#!/usr/bin/env python3
from pathlib import Path
import re

# Creator shares the Adapter shell and runtime. Its demo entry belongs here too,
# so regenerating either language never removes the Creator demo controls.
DEMO_ENTRY = '<script type="module" src="/campanas/creador/demo.mjs?v=creator-full-5"></script>'
root=Path(__file__).resolve().parents[1]
for lang in ('es','en'):
 source=root/('en/adaptaciones/index.html' if lang=='en' else 'adaptaciones/index.html')
 target=root/('en/creador/index.html' if lang=='en' else 'creador/index.html')
 text=source.read_text().replace('<body class="adapt-page">','<body class="adapt-page creator-page">')
 text=re.sub(r'<title>.*?</title>', '<title>'+('Creator · Campaigns for screens' if lang=='en' else 'Creador · Campañas para pantallas')+' | Pixeria</title>',text)
 text=re.sub(r'(<meta name="description" content=")[^"]*',lambda m:m[1]+('Create campaigns from scratch for every screen configuration, with editable product, logo and copy.' if lang=='en' else 'Crea campañas desde cero para cada configuración de pantallas, con producto, logo y mensaje editables.'),text)
 text=text.replace('https://www.pixeria.com/en/adaptaciones/','https://www.pixeria.com/en/creador/').replace('https://www.pixeria.com/adaptaciones/','https://www.pixeria.com/creador/')
 text=text.replace("location.replace('/en/adaptaciones/'", "location.replace('/en/creador/'")
 text=text.replace('<section id="sec-adapt" class="card">','<section id="sec-adapt" class="card" hidden>')
 if text.count('</body>') != 1:
  raise ValueError(f'{source}: expected one closing body for the Creator demo entry')
 text=text.replace('</body>',DEMO_ENTRY+'\n</body>')
 target.parent.mkdir(parents=True,exist_ok=True);target.write_text(text)
