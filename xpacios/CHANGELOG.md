# Editor de Xpacios — Changelog

Versión: **v.DD.MM.AAAA.release**. Objetivo: el mejor editor de Xpacios del mundo.
Cada release se despliega en producción y se verifica. Twin de referencia: `/xpacios/xtanco-barcelona/`.
Cada versión tiene un enlace **🔗 Ver resultado** que renderiza ese commit exacto vía githack (la versión actual también está siempre en producción: https://www.pixeria.com/xpacios/xtanco-barcelona/).

## v.30.06.2026.23 — 🔗 [Ver resultado](https://raw.githack.com/csilvasantin/pixeria/e87aa15/xpacios/xtanco-barcelona/index.html)
- **Exportar / Importar decoración (JSON)**: en el panel de Versiones, **⬇️ Exportar** descarga toda la decoración del Xpacio (pósters, objetos con nombre/lock, escena, posición de pantallas) como `.json`, y **⬆️ Importar** la carga desde un archivo. Para hacer backups y **trasladar un montaje de una tienda a otra**. Importar es deshacible (Ctrl+Z) y valida el archivo.

## v.30.06.2026.22 — 🔗 [Ver resultado](https://raw.githack.com/csilvasantin/pixeria/c0011e6/xpacios/xtanco-barcelona/index.html)
- **Resumen de inventario DOOH**: el panel de Pantallas muestra ahora el total comercializable — **m² de pantallas**, nº de pantallas y cuántas están encendidas (se actualiza al encender/apagar). De un vistazo, el inventario vendible del Xpacio.

## v.30.06.2026.21 — 🔗 [Ver resultado](https://raw.githack.com/csilvasantin/pixeria/09ec69d/xpacios/xtanco-barcelona/index.html)
- **Afinar con flechas**: con una pieza seleccionada, las **flechas** la mueven 0,1 m (⇧ + flecha = 0,5 m), respetando muros y mobiliario. Posicionado fino tras arrastrar a ojo. (Las piezas bloqueadas no se mueven.)

## v.30.06.2026.20 — 🔗 [Ver resultado](https://raw.githack.com/csilvasantin/pixeria/294f1cd/xpacios/xtanco-barcelona/index.html)
- **Inventario de piezas por tipo**: al Decorar, un panel (abajo-izq, sobre el minimapa) cuenta cuántas piezas hay de cada tipo (👗 percheros, 🧍 maniquíes, 🪴 plantas…) y el total. Se actualiza al colocar/borrar/duplicar/vaciar. Para controlar de un vistazo el mobiliario del Xpacio.

## v.30.06.2026.19 — 🔗 [Ver resultado](https://raw.githack.com/csilvasantin/pixeria/5eef235/xpacios/xtanco-barcelona/index.html)
- **Medir el local (📏)**: toggle que dibuja las cotas del local sobre el suelo (ancho × fondo en metros) y muestra los **m² útiles** en el centro. Útil para fichas técnicas y comercializar la planta. Solo vista (no persiste); se oculta al pasear/tour.

## v.30.06.2026.18 — 🔗 [Ver resultado](https://raw.githack.com/csilvasantin/pixeria/ffe2369/xpacios/xtanco-barcelona/index.html)
- **Bloquear pieza (🔒)**: candado por objeto para no moverlo ni escalarlo sin querer (el arrastre y la rueda quedan inhabilitados; sigue seleccionable y el anillo se pone ámbar). Se persiste en `decor`. Ideal tras dejar el escaparate/mostrador en su sitio.

## v.30.06.2026.17 — 🔗 [Ver resultado](https://raw.githack.com/csilvasantin/pixeria/6780504/xpacios/xtanco-barcelona/index.html)
- **Nombre / etiqueta a una pieza (🏷️)**: selecciona un objeto y ponle un nombre; aparece una etiqueta flotante sobre la pieza (clic en ella para seleccionarla) que se persiste en `decor` y se restaura al recargar. Se oculta al pasear/tour. Útil para anotar la planta del Xpacio (p.ej. "Probadores", "Caja", "Escaparate").

## v.30.06.2026.16 — 🔗 [Ver resultado](https://raw.githack.com/csilvasantin/pixeria/edd2da7/xpacios/xtanco-barcelona/index.html)
- **Reubicar las pantallas DOOH (🖥️ Pantallas)**: nueva herramienta en Decorar para seleccionar y arrastrar las 4 pantallas base A/B/C/D y recolocarlas dentro del local; el override de posición se persiste en `decor` y se restaura al recargar. Botón **↺ Restablecer** para volver a las posiciones originales. Clave: los IDs A/B/C/D y el reporte de emisión (proof-of-play) **no cambian** — solo se mueve la representación 3D. Comercializa la planta real adaptando el gemelo a cada tienda.

## v.30.06.2026.15 — 🔗 [Ver resultado](https://raw.githack.com/csilvasantin/pixeria/bad3430/xpacios/xtanco-barcelona/index.html)
- **Foto del Xpacio (📸)**: botón que descarga una imagen PNG full-res del render actual (con el nombre del Xpacio y la versión), lista para presentaciones y comercialización del inventario DOOH.

## v.30.06.2026.14 — 🔗 [Ver resultado](https://raw.githack.com/csilvasantin/pixeria/7acd7ff/xpacios/xtanco-barcelona/index.html)
- **Minimapa en el editor**: al Decorar aparece un minimapa de planta (abajo-izq) con la silueta del local y la posición de cada objeto (en su color, el seleccionado resaltado) y póster, para ubicarte de un vistazo.

## v.30.06.2026.13 — 🔗 [Ver resultado](https://raw.githack.com/csilvasantin/pixeria/e72b3ad/xpacios/xtanco-barcelona/index.html)
- **Miniaturas en las versiones**: al guardar una versión (💾) se captura una **foto del render** y se muestra como miniatura en la lista de versiones, para reconocerlas de un vistazo al restaurar.

## v.30.06.2026.12 — 🔗 [Ver resultado](https://raw.githack.com/csilvasantin/pixeria/c119b94/xpacios/xtanco-barcelona/index.html)
- **Rejilla de edición**: al entrar en 🖼️ Decorar se muestra una rejilla de 0,5 m en el suelo (se oculta al salir/pasear), para colocar y alinear objetos con precisión.

## v.30.06.2026.11 — 🔗 [Ver resultado](https://raw.githack.com/csilvasantin/pixeria/6d6c149/xpacios/xtanco-barcelona/index.html)
- **Aforo simulado**: botón 👥 que pobla la tienda con clientes paseando (van entre puntos del local) + contador de aforo. Da vida al Xpacio y conecta con la audiencia DOOH. Apagado por defecto; sin persistencia.

## v.30.06.2026.10 — 🔗 [Ver resultado](https://raw.githack.com/csilvasantin/pixeria/127e4e7/xpacios/xtanco-barcelona/index.html)
- **Snap a la pared**: al arrastrar un objeto cerca de una pared (<0,6 m) se pega a ella y se orienta mirando al interior (ideal para percheros, espejos, tótems y bancos). Lejos de las paredes mantiene el snap a rejilla.

## v.30.06.2026.9 — 🔗 [Ver resultado](https://raw.githack.com/csilvasantin/pixeria/4446911/xpacios/xtanco-barcelona/index.html)
- **Compartir**: botón 🔗 que copia al portapapeles el enlace de este Xpacio (con su `?xpacio=` si es uno propio) y muestra un toast de confirmación. Toast reutilizable para futuros avisos.

## v.30.06.2026.8 — 🔗 [Ver resultado](https://raw.githack.com/csilvasantin/pixeria/6561086/xpacios/xtanco-barcelona/index.html)
- **Duplicar inteligente + alinear**: al duplicar (⧉), la copia busca un hueco libre alrededor (sin solapar otros objetos ni atravesar muros); nuevo botón **⊞ Alinear** que ajusta el objeto seleccionado a la rejilla de 0,5 m.

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
