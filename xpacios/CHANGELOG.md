# Editor de Xpacios — Changelog

Versión: **v.DD.MM.AAAA.release**. Objetivo: el mejor editor de Xpacios del mundo.
Cada release se despliega en producción y se verifica. Twin de referencia: `/xpacios/xtanco-barcelona/`.
Cada versión tiene un enlace **🔗 Ver resultado** que renderiza ese commit exacto vía githack (la versión actual también está siempre en producción: https://www.pixeria.com/xpacios/xtanco-barcelona/).

## v.30.06.2026.7 — 🔗 [Ver resultado](https://raw.githack.com/csilvasantin/pixeria/d4f2218/xpacios/xtanco-barcelona/index.html)
- **Modo Día / Noche**: botón ☀️/🌙 en la pestaña 🎨 Escena. De noche baja la exposición y oscurece el ambiente, y las pantallas DOOH lucen más (ideal para previsualizar la tienda y vender el inventario). Persistente y deshacible.

## v.30.06.2026.6 — 🔗 [Ver resultado](https://raw.githack.com/csilvasantin/pixeria/6360476/xpacios/xtanco-barcelona/index.html)
- **Panel de ayuda/atajos (❔ / tecla `?`)**: ventana que resume modos (Isométrica/Pasear/Tour/Decorar) y todos los controles del editor (colocar, seleccionar, mover, rotar Q/E, escalar, duplicar, recolorear, vestir, escena, deshacer, vaciar, versiones). Cierra con ✕/Esc/click fuera.

## v.30.06.2026.5 — 🔗 [Ver resultado](https://raw.githack.com/csilvasantin/pixeria/84f6320/xpacios/xtanco-barcelona/index.html)
- **Versiones nombradas del Xpacio**: botón 💾 en el editor para **guardar** la decoración actual con nombre y **restaurar** o borrar versiones anteriores (snapshots con posters/objetos/escena, guardados en el backend compartido `saves-<Xpacio>`). Restaurar es deshacible.

## v.30.06.2026.4 — 🔗 [Ver resultado](https://raw.githack.com/csilvasantin/pixeria/18efb2f/xpacios/xtanco-barcelona/index.html)
- **Catálogo de objetos ampliado**: 5 nuevos muebles colocables — 🪴 Planta, 💡 Lámpara, 🛋️ Banco, 🪞 Espejo, 🧾 Caja registradora. Todos con recolorear/escalar/duplicar/mover/vestir y persistencia. Paleta de objetos con auto-ajuste (wrap).

## v.30.06.2026.3 — 🔗 [Ver resultado](https://raw.githack.com/csilvasantin/pixeria/997c986/xpacios/xtanco-barcelona/index.html)
- **Escena**: nueva pestaña 🎨 en el editor para cambiar el **color del suelo y de las paredes** (paletas de tonos de madera/neutros y blanco/Desigual/oscuros). Global por Xpacio, persistente y deshacible.

## v.30.06.2026.2 — 🔗 [Ver resultado](https://raw.githack.com/csilvasantin/pixeria/ddab4c3/xpacios/xtanco-barcelona/index.html)
- **Recolorear objeto**: al seleccionar un objeto, una paleta de colores Desigual lo recolorea al instante (mantiene la textura como tinte si la tiene). Se persiste por objeto; deshacible con Ctrl+Z.

## v.30.06.2026.1 — 🔗 [Ver resultado](https://raw.githack.com/csilvasantin/pixeria/9091a10/xpacios/xtanco-barcelona/index.html)
- **Deshacer (Ctrl+Z / ⌘Z)**: pila de estados; revierte la última acción (colocar, mover, rotar, escalar, borrar, vestir, duplicar).
- **Vaciar (🧹)**: borra toda la decoración del Xpacio (con un Deshacer disponible).
- **Versión visible** en el editor (lee el `<meta version>`), para no perder de vista en qué release estamos.

## v.30.06.2026.0 — baseline (lo ya construido) — 🔗 [Ver resultado](https://raw.githack.com/csilvasantin/pixeria/5426049/xpacios/xtanco-barcelona/index.html)
- Gemelo 3D del Xtanco (Valencia y Barcelona/Desigual), pantallas DOOH emitiendo en vivo, gestión remota.
- Modos: Isométrica, **Pasear** (1ª/3ª persona, colisión), **Tour** tipo Matterport (waypoints, transición cinematográfica, minimapa), realismo (IBL + tone mapping, suelo/paredes/techo).
- **Editor (Decorar)**: pósters en paredes; **objetos** (perchero, maniquí, mesa, probador, tótem DOOH): colocar/mover/rotar/borrar.
- **Manipular**: escalar (rueda/＋－), duplicar (⧉), snap a rejilla 0,2 m.
- **Contenido/Vestir**: textura del stock de Pixeria o imagen subida → contenido de pantalla en tótems, ropa en maniquíes/percheros.
- **Persistencia compartida** en backend (worker pixer-eleven) por Xpacio; galería rica + crear Xpacio nuevo.
