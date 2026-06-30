# Editor de Xpacios — Changelog

Versión: **v.DD.MM.AAAA.release**. Objetivo: el mejor editor de Xpacios del mundo.
Cada release se despliega en producción y se verifica. Twin de referencia: `/xpacios/xtanco-barcelona/`.

## v.30.06.2026.4
- **Catálogo de objetos ampliado**: 5 nuevos muebles colocables — 🪴 Planta, 💡 Lámpara, 🛋️ Banco, 🪞 Espejo, 🧾 Caja registradora. Todos con recolorear/escalar/duplicar/mover/vestir y persistencia. Paleta de objetos con auto-ajuste (wrap).

## v.30.06.2026.3
- **Escena**: nueva pestaña 🎨 en el editor para cambiar el **color del suelo y de las paredes** (paletas de tonos de madera/neutros y blanco/Desigual/oscuros). Global por Xpacio, persistente y deshacible.

## v.30.06.2026.2
- **Recolorear objeto**: al seleccionar un objeto, una paleta de colores Desigual lo recolorea al instante (mantiene la textura como tinte si la tiene). Se persiste por objeto; deshacible con Ctrl+Z.

## v.30.06.2026.1
- **Deshacer (Ctrl+Z / ⌘Z)**: pila de estados; revierte la última acción (colocar, mover, rotar, escalar, borrar, vestir, duplicar).
- **Vaciar (🧹)**: borra toda la decoración del Xpacio (con un Deshacer disponible).
- **Versión visible** en el editor (lee el `<meta version>`), para no perder de vista en qué release estamos.

## v.30.06.2026.0 — baseline (lo ya construido)
- Gemelo 3D del Xtanco (Valencia y Barcelona/Desigual), pantallas DOOH emitiendo en vivo, gestión remota.
- Modos: Isométrica, **Pasear** (1ª/3ª persona, colisión), **Tour** tipo Matterport (waypoints, transición cinematográfica, minimapa), realismo (IBL + tone mapping, suelo/paredes/techo).
- **Editor (Decorar)**: pósters en paredes; **objetos** (perchero, maniquí, mesa, probador, tótem DOOH): colocar/mover/rotar/borrar.
- **Manipular**: escalar (rueda/＋－), duplicar (⧉), snap a rejilla 0,2 m.
- **Contenido/Vestir**: textura del stock de Pixeria o imagen subida → contenido de pantalla en tótems, ropa en maniquíes/percheros.
- **Persistencia compartida** en backend (worker pixer-eleven) por Xpacio; galería rica + crear Xpacio nuevo.
