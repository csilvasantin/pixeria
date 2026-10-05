# Adaptador y Pixie

Base #4905 · FLT-101368. Mejora de exportación y persistencia: misión Yokup #223. Publicación autorizada por Carlos el 3-oct-2026; release v.03.10.2026.r5.22:23.

Vídeo incluye el compositor de TikToks. Adaptador ocupa su anterior entrada de navegación. La ruta `/adaptaciones/` se conserva para enlaces existentes. `/en/adaptaciones/` contiene la interfaz inglesa; la ruta raíz usa español en admira.studio y dirige a inglés en pixeria.com y previews de Pages.

Elige un vídeo del índice Stock o súbelo desde tu equipo. También puedes abrir el creador de Vídeo. Selecciona formatos estándar (9:16, 16:9, 1:1, 4:5) o un perfil de cliente. Ajusta recorte, contener o expansión con fondo desenfocado, foco y zoom. Cada tarjeta muestra resolución, uso, pérdida efectiva del encuadre y una receta H.264 plegable.

El perfil de cliente de 18 pantallas contiene las 18 filas no marcadas ESPECIAL de la página 3 de «Resoluciones y formatos» del cliente, incluyendo Shuttle Stretch (SEDE). Fuente recuperada del archivo «Resoluciones y formatos especiales .pdf» aportado por Carlos en Telegram Desktop del MacMini. SHA-256 y filas transcritas: `adaptaciones/perfil-cliente-18.json`. Mantiene las resoluciones nativas, H.264/MP4 y 25 fps. Los cinco layouts especiales segmentados no se presentan como formatos estándar: tienen su propia familia, descrita en «Videowalls segmentados». Sincro VW y LOGO requieren duración coincidente; no se sincronizan players desde esta página.

La cuadrícula previsualiza los ajustes con canvas. “Exportar MP4” en una tarjeta genera esa variante; “Exportar formatos seleccionados” las procesa secuencialmente. Al acabar aparecen enlaces de descarga individuales. Los MP4 se codifican en el navegador con FFmpeg WASM, H.264 y audio AAC cuando el origen tiene audio. La expansión repite y desenfoca el propio vídeo, sin IA generativa. Foco, zoom y recorte se calculan en el mismo módulo que el encoder; puede haber pequeñas diferencias de desenfoque. El plan muestra la orden usada; bitrate y FPS de entrada son estimaciones. Vídeos remotos pueden fallar por CORS, retirada del asset o incompatibilidad del navegador; la subida local sigue disponible.

Pixie es una ilustración SVG local con animación CSS, sin modelos ni API de pago. Se invoca desde Experto con `/avatarDigital on` (o `/digitalAvatar on`) y se oculta con `off` o ×. Cada navegación empieza oculta; no restaura preferencias antiguas. Es una guía local con texto de ayuda, sin conversación IA ni acceso a micrófono. Respeta reducir movimiento.

El minitutorial se genera con ADmira Motion en el generador oficial admiranext.com/tiktok. Es una guía animada, no una grabación real de pantalla. El vídeo exportado y las capturas se vinculan al informe de Yokup tras verificarlos.

La preview incluye un paquete de revisión explícitamente público en `/review/4905/en/adaptaciones/` y `/review/4905/es/adaptaciones/`, con Vídeo en el mismo directorio. Se genera únicamente en un archivo temporal con `scripts/preview-4905.py`; no modifica la verja, los callbacks ni las rutas existentes. Los assets y la muestra ya son públicos. Esto permite revisar los cambios aunque el callback Google existente regrese a producción y rechace la sesión de preview.

## Exportación y ajustes guardados · misión #223

Los ajustes se guardan automáticamente en localStorage, separados por proyecto y, dentro de cada uno, por ID de formato: método, foco X/Y, zoom, selección, compatibilidad y familia (biblioteca, formatos propios o videowalls). Ver «Proyectos». Cambiar de familia conserva sus ajustes y selecciones. “Restablecer ajustes” vuelve a los ajustes por defecto del proyecto activo (en General, el perfil estándar). No se guardan archivos ni URLs blob: al recargar hay que volver a elegir el archivo local. Al navegar con BFCache la fuente conservada sigue disponible. Si el almacenamiento está bloqueado se avisa y el editor sigue funcionando.

El origen tiene un límite de 100 MiB. El encoder single-thread descarga bajo demanda unos 32 MB de @ffmpeg/core 0.12.10 desde jsDelivr; el wrapper MIT @ffmpeg/ffmpeg 0.12.15 está fijado y alojado en el repositorio. El vídeo local no se envía a ese CDN. Para impedir intermediarios enormes en pantallas panorámicas, cover y blur recortan el origen antes de escalar. El presupuesto estimado admite 96 MiB por variante y 192 MiB por lote; si se excede, se pide un clip más corto, menor perfil o menos formatos. Hay además un tope real de 128 MiB por salida y se rechazan resultados desde 124 MiB para no ofrecer archivos truncados. Son límites de esta versión local, no garantías de consumo de RAM.

Durante el trabajo se congelan fuente y controles; Cancelar interrumpe descarga/worker y conserva variantes terminadas. Las descargas duran mientras siga abierta la página y se reemplazan al iniciar otra exportación o cambiar la fuente. Las fuentes Stock necesitan permiso CORS. Rendimiento 4K y vídeos largos dependen del equipo; no se acredita compatibilidad uniforme con Safari o móviles. No hay edición por capas, texto independiente, expansión IA ni sincronización de players.

Validación: cuatro pruebas Node, incluida FFmpeg nativa para cover/contain/blur con y sin audio; prueba IAB de los cuatro formatos estándar con fuente de 2 s, descarga y ffprobe (resolución, H.264/AAC, 25 fps y duración); persistencia tras recarga y cancelación verificadas en la interfaz. La batería signage tiene una aserción previa obsoleta de cache-busting (`20260902-r3`) frente a la versión sellada actual; no se modifica el Tester en esta entrega. Revisión cruzada aprobada para PR.

Minitutorial oficial: `docs/media/minitutorial-adaptador-exportacion.mp4`, plan en el JSON contiguo. ADmira Motion, 1080×1920, unos 15 segundos: es una guía animada preparada durante la revisión del Adaptador, no una grabación de pantalla. Incluye ubicación, ajuste, exportación, guardado y límites. Audio de base, sin locución humana. Se verifican los tres momentos del vídeo y su contenedor antes de vincularlo a Yokup.

Publicación: misión Yokup #233. Se conserva el tutorial exportado y verificado en la revisión. El intento de actualizar su portada desde el generador oficial anunció descarga, pero no se pudo recuperar un archivo nuevo en esta sesión; el guion actualizado se conserva y el informe de publicación declara esa limitación. El vídeo enlazado corresponde a la exportación real anterior, con la etiqueta «en revisión».

## Biblioteca de tamaños · misión Yokup #238

El panel **Tamaños** (☰ Opciones) permite buscar por nombre o medidas (`300 × 250`, `300x250`), filtrar orientación y marcar tamaños por categoría: redes, digital, display e impresión. Buscar o filtrar no modifica la selección. Cada grupo tiene una casilla «seleccionar todo el grupo» (redes 8, digital 6, display 23, impresión 5); las casillas sueltas siguen marcando un tamaño. «Todos los tamaños» / All sizes marca los 42 de la biblioteca. Las campañas sustituyen la selección de la biblioteca: redes 8, display 23 o móviles 3 (300×50, 320×50 y 320×100). El botón Adaptar / Adapt genera esa lista en la cola, con progreso N/total; cada pieza queda descargable y, si es MP4, se sube al Stock. Se pueden quitar tamaños desde su tarjeta o quitar todos. Los perfiles Biblioteca y de cliente conservan sus selecciones y ajustes al alternar.

Los presets con medidas mantienen dimensiones nativas; la compatibilidad de reproducción regula los cuatro formatos de proporción originales. Los tamaños propios se añaden en Digital: medidas pares 64–3840 px, máximo 8,3 Mpx y 12 presets guardados por navegador. La selección, medidas propias, foco, zoom y método sobreviven a la recarga; el archivo local debe elegirse otra vez.

Redes y digital exportan MP4. Display e impresión exportan PNG del fotograma actual, con el mismo reencuadre del previo; pausa para elegir el fotograma. Impresión incluye densidad PNG de 150 ppp, RGB, sin sangrado, CMYK ni PDF de imprenta. No hay remaquetación de textos/capas, áreas seguras automáticas, traducción ni generación IA. No se garantiza aceptación por las redes publicitarias: los presets son medidas de referencia. Display avisa si el PNG supera 150 KB; el usuario debe revisar las condiciones de su destino. Referencia display: [Google Ads, tamaños y restricciones](https://support.google.com/google-ads/answer/1722096).

Verificación: ocho pruebas con FFmpeg real, catálogo, búsqueda, validación de preferencias/custom y pHYs/CRC de PNG a150ppp. En el navegador se verificaron campañas, filtro sin perder selección, PNG300×250 y A41240×1754 generados, custom500×500 persistente y MP4 generado, cambio perfil de cliente 18↔Biblioteca 3. La automatización del navegador integrado no permitió recuperar nuevas descargas; no se afirma haber inspeccionado nuevos archivos PNG/MP4 del navegador. Las pruebas del encoder y la metadata PNG se verificaron por separado.

Minitutorial creado en el generador oficial de [ADmiraNeXT](https://www.admiranext.com/tiktok/). Es una guía animada, no una grabación de pantalla. El MP4 exportado fue recuperado y verificado con ffprobe (H264/AAC, 1080×1920, 15.139s) y tres fotogramas a2,6,12segundos. Vídeo: [minitutorial-adaptador-tamanos.mp4](media/minitutorial-adaptador-tamanos.mp4). SHA256 8ca9f62050fba84bf9bd545542f5f0fcd6eeff4d3ecb9cd6f7c167976dfa935e. Guion y parámetros conservados en [minitutorial-adaptador-tamanos-plan.json](media/minitutorial-adaptador-tamanos-plan.json), con ubicación, uso, resultado y límites. El tutorial anterior corresponde a exportación MP4, no documenta la nueva biblioteca.

## Videowalls segmentados (perfil de cliente)

Tercera familia del selector «Perfil de formatos», junto a Biblioteca y el perfil de cliente de 18 pantallas, en español y en inglés. Contiene las 5 filas marcadas ESPECIAL en la página 3 del mismo PDF (SHA-256 `16a17b2f…5239f7`). Están transcritas en `adaptaciones/perfil-cliente-especiales.json`. La geometría y los trabajos FFmpeg están en `adaptaciones/especiales-core.mjs`.

Lectura de la fuente: PDFKit de macOS ejecutado con `swift`, con el texto de las 8 páginas y un render PNG a 3×. Las cuadrículas de las páginas 5 y 6 se comprobaron visualmente y ampliadas. La página 5 fija la regla: cada espacio es una pantalla y cada fila continúa la siguiente. Por eso la resolución de la tabla no es un mosaico rectangular. Es **un único archivo de entrega** con una celda por pantalla, en orden de lectura; las celdas sobrantes van marcadas.

| Fila de la tabla | Entrega | Celda | Pantallas | Rejilla | Celdas sin uso | Pared física |
|---|---|---|---|---|---|---|
| VIDEOWALL 5x1 H (1280 X 1080) | 1280×1080 | 640×360 | 5 | 2×3 | 6 | 3200×360 |
| VIDEOWALL 6x1 H (1280 X 1080) | 1280×1080 | 640×360 | 6 | 2×3 | — | 3840×360 |
| VIDEOWALL 9x1 H (2880 X 1620) | 2880×1620 | 720×540 | 11 | 4×3 | 12 | 7920×540 |
| CORDOBA-098 (3840 X 2160) | 3840×2160 | 960×540 | 15 | 4×4 | 16 | 14400×540 |
| VIDEOWALL 13x1 V (2160 X 3840) | 2160×3840 | 540×960 | 13 | 4×4 | 14, 15, 16 | 7020×960 |

Ambigüedades del PDF. No se resuelven en silencio: la tarjeta de cada layout las muestra.
- 9x1 H: la página 6 lo titula «11x1 H» y dibuja 11 celdas activas más una oscura. Se modelan 11 pantallas. Hay que confirmarlo antes de emitir.
- 5x1 H y 6x1 H: la imagen de ejemplo rotula «640x540», pero la cuadrícula dice 640x360px y 3 × 360 = 1080. Se usa 640×360, que encaja con las pantallas 16:9 de la foto «VW 5x1 H» de la página 2.
- CORDOBA-098: el PDF no indica pantallas ni disposición. 15 sale de la cuadrícula; la fila única sale de la regla de continuidad.
- «Mismo tiempo de resolución para la correcta sincronización» se refiere a Sincro VW y Sincro LOGO, que siguen en el perfil de cliente de 18 pantallas. Ningún especial es un LOGO con pieza independiente.

Funcionamiento: el reencuadre existente (recorte, contener, expandir con fondo desenfocado, foco y zoom) se aplica a la **pared física**, es decir, a todas las pantallas una al lado de otra. La previsualización muestra la pared con líneas de corte y números, y la entrega con cada celda numerada y las sobrantes tachadas. FFmpeg remuestrea a 25 fps con `fps=25`, compone la pared una sola vez, la divide y recorta cada pantalla del mismo maestro:
- **Exportar entrega**: 1 MP4 a la resolución de la tabla, como pide el PDF. Usa H.264 del perfil 4K del cliente, GOP de 1 s, celdas sobrantes en negro y audio AAC si el origen lo tiene. Nombre: `<layout>-entrega-<ancho>x<alto>.mp4`.
- **Exportar por pantalla**: N MP4 en una sola pasada, sin audio, a 25 fps y con el mismo número de fotogramas. Usa H.264 nivel 4.0 y la parte proporcional, por píxeles, del bitrate de la entrega. Nombre: `<layout>-<n>de<N>-<ancho>x<alto>.mp4`.

Se reutilizan el exportador WASM y los límites existentes: 100 MiB de origen, presupuesto de 96/192 MiB, tope de 128 MiB por salida y rechazo a partir de 124 MiB. Los ajustes se guardan por id de layout, como en las otras familias, y alternar familias conserva sus selecciones.

Límites: esta página no sincroniza players. La imagen solo continúa entre pantallas si arrancan a la vez y en bucle juntos. Las paredes largas (CORDOBA-098, 14400 px) componen un fotograma intermedio grande y pueden tardar en navegadores modestos. Con `-preset ultrafast`, ffprobe identifica el H.264 como «Constrained Baseline», igual que en el resto del Adaptador. No hay biseles ni huecos entre pantallas, porque el PDF no los da.

Verificación: `test/adapter-especiales.test.mjs` cubre el catálogo y el SHA (también contra el PDF local si existe); la geometría (las celdas cubren la entrega y las pantallas cubren la pared sin solapes ni huecos); los nombres; la persistencia y el filtro por familia; y los trabajos. Con `ADAPTER_FFMPEG_TEST=1`, FFmpeg nativo convierte un maestro de 2 s en N pantallas: ffprobe confirma resolución, H.264, 25/1, 50 fotogramas y duración idéntica, además de la entrega con AAC. En Chrome se exportaron 5 MP4 de 640×360 y la entrega de 1280×1080 de VW 5x1 H con FFmpeg WASM. ffprobe dio 50 fotogramas y 2,000 s en cada pantalla, y apilar las 5 pantallas reconstruye la pared continua.

## Proyectos: ajustes generales + los propios de cada proyecto

Encargo de Carlos, 5-oct-2026. Cada proyecto tiene los **ajustes generales**: la biblioteca de 42 tamaños, los cuatro formatos de proporción, los tamaños personalizados y las campañas de redes, display y móviles. Además tiene **sus ajustes propios**, si existen. Antes solo Altadis tenía ajustes propios, cableados en el código como «perfil de cliente».

**Selector Proyecto.** Está arriba del panel ☰ Tamaños y es bilingüe ES/EN. Ofrece «General (sin proyecto)», luego los proyectos con ficha marcados con ★ y el número de formatos propios, y después el resto de proyectos activos de Yokup. Al elegir uno:
- se ven la biblioteca general y sus formatos propios;
- «Perfil de formatos» (▤) ofrece la biblioteca general, la familia del proyecto y sus videowalls segmentados, solo si la ficha los trae;
- sus campañas salen las primeras en «Campañas completas»;
- las notas del proyecto aparecen en ▤.

Un proyecto sin ficha usa solo la biblioteca general. El estado bajo el selector dice qué se está viendo y si la lista de Yokup llegó en vivo o es la copia guardada. La familia que antes se llamaba «cliente» ahora es «proyecto», y no se pierde ninguna función: Altadis conserva sus 18 estándar, 6 MyBlu y 5 ESPECIAL, su campaña, la compatibilidad 4K y los 25 fps.

**URL.** `?proyecto=<id>` abre ese proyecto y la página mantiene el parámetro al cambiar de proyecto; General lo quita. También acepta los alias de la ficha: `?proyecto=altadis` abre `altadis-estancos-bcn`. Un id que no está en Yokup cae en General y lo avisa. Sin parámetro, se vuelve al último proyecto elegido (`pixeria.adapter.proyecto`).

**Fuente de proyectos.** La lista sale de `GET https://api.yokup.com/projects`: es pública, tiene `Access-Control-Allow-Origin: *` y es la misma que usan las misiones (`project_id`). El Adaptador la pide en vivo, con un límite de 4 s y sin credenciales. Si falla, usa `adaptaciones/proyectos/yokup.json`, una copia con solo id, nombre y estado, generada por script. No se usan secretos.

**Persistencia.** General conserva la clave de siempre, `pixeria.adapter.v1`. Cada proyecto usa `pixeria.adapter.v1.proyecto.<id>`. Los tamaños personalizados son de la biblioteca general: se comparten y viven en la clave de General. Las preferencias de Altadis guardadas antes de las fichas (perfil `cliente`/`altadis`/`especiales` e ids `cliente-*`/`altadis-*` en la clave general) se copian una sola vez a la clave del proyecto Altadis, sin borrar nada. Quien estaba en Altadis vuelve a Altadis.

### Ficha de proyecto

`adaptaciones/proyectos/<id-yokup>.json`, uno por proyecto, con el **id exacto de Yokup** como nombre de archivo:

| Campo | Qué es |
|---|---|
| `version` | `1` |
| `id`, `nombre`, `alias` | id de Yokup; nombre corto; slugs extra aceptados en `?proyecto=` |
| `hereda` | siempre `"general"`: la ficha suma, nunca sustituye, la biblioteca general |
| `fuente` | `titulo` (obligatorio), `archivo`, `sha256`, `documentacion`, `nota` |
| `formatos.estandar` | lista de `{id, nombre, custom:[ancho, alto], uso, useEn, fps?, myblu?}`, o `{archivo, clave}` hacia un JSON de transcripción dentro de `adaptaciones/` |
| `formatos.especiales` | videowalls segmentados (forma de `perfil-cliente-especiales.json`): lista o `{archivo, clave}` |
| `ajustes` | `metodo` (auto/cover/contain/blur), `compatibilidad` (universal/fhd/uhd) de sus formatos, `fps`, `codec` (`h264`), `familia` con la que se abre |
| `familias` | etiquetas ES/EN de «Perfil de formatos» para la familia propia y los videowalls |
| `campanas` | `{id, es, en, descripcionEs, descripcionEn, incluye}`; `incluye` = `todos`, `estandar`, `especiales`, `myblu` o lista de ids propios |
| `notas` | requisitos de entrega ES/EN para ▤ |

Altadis es la primera ficha: `proyectos/altadis-estancos-bcn.json`. Yokup no tiene un proyecto `altadis`; su proyecto Altadis, el que usan sus misiones, es `altadis-estancos-bcn` («Altadis · Estancos Barcelona 9»). Por eso la ficha usa ese id y declara `altadis` como alias. La ficha **referencia** `perfil-cliente-18.json` y `perfil-cliente-especiales.json`, que siguen intactos byte a byte, con su procedencia y SHA del PDF. Los ids de formato `cliente-NN` y `cliente-esp-N` no cambian, para no romper preferencias guardadas.

`adaptaciones/proyectos/index.json` (fichas existentes con recuentos) y `yokup.json` (lista de Yokup) los genera `scripts/adaptador-proyectos.py`:

```
scripts/adaptador-proyectos.py                 # regenera index.json
scripts/adaptador-proyectos.py --yokup         # además renueva yokup.json desde la API
scripts/adaptador-proyectos.py --check         # sale 1 si index.json está desfasado o un id no está en yokup.json
scripts/adaptador-proyectos.py --check --yokup # además compara yokup.json con Yokup en vivo
```

### Cómo añadir un proyecto

1. Crea el proyecto en Yokup si no existe y copia su id exacto, el de `/misiones`.
2. Si es nuevo en Yokup, ejecuta `scripts/adaptador-proyectos.py --yokup`.
3. Copia `adaptaciones/proyectos/_plantilla.json` a `adaptaciones/proyectos/<id>.json`.
4. Rellena `id`, `nombre`, `fuente`, los formatos, los `ajustes`, las `familias`, las `campanas` y las `notas`. Da a los formatos ids que empiecen por el del proyecto, para que no choquen con la biblioteca. Si la fuente es un PDF largo, transcríbelo aparte y apúntalo con `{archivo, clave}`, como Altadis.
5. Ejecuta `scripts/adaptador-proyectos.py` para regenerar `index.json`.
6. Ejecuta `node --test test/adapter-proyectos.test.mjs`. Valida el esquema de todas las fichas: que el nombre de archivo coincida con el id, que el id exista en la lista de Yokup, que ningún id pise la biblioteca general, la geometría de los videowalls, los 25 fps de los segmentados y las campañas. También comprueba que `index.json` está al día.
7. Abre un PR. Al publicarse, el proyecto sale marcado con ★ en el selector.

Verificación: `test/adapter-proyectos.test.mjs` cubre:
- el esquema;
- que Altadis sea idéntico a main: SHA de las dos transcripciones y el cargador antiguo, comparado formato a formato en ES y EN; campaña de 29 formatos; etiquetas;
- la herencia de la biblioteca general;
- que un proyecto de Yokup sin ficha use solo la general;
- la lista de Yokup;
- `?proyecto=` con id, alias y desconocido;
- la persistencia separada;
- la migración de preferencias antiguas.

`test/adaptador-proyectos.browser.cjs` (Playwright, con un servidor local y la verja simulada en `/auth/session`) recorre en el navegador:
- General;
- Altadis por alias;
- `pixeria-alsea`, proyecto sin ficha;
- la migración desde una clave antigua;
- inglés sin conexión con Yokup.

Además, guarda capturas a 1440 y 390 px.


## Imágenes

Encargo de Carlos, 5-oct-2026. El Adaptador también adapta **imágenes fijas**. Motivo: Carlos eligió el último contenido generado en el Stock, la imagen «Un anuncio de café humeando…» (`1791230658801-jnv969`, JPG de 1280×720), y no aparecía porque la lista solo admitía `type === 'video'`.

**Lista de origen.** La caja 1 («Contenido Stock») lista vídeos e imágenes juntos. Las imágenes (`type` image) entran si son JPG, PNG o WebP (y, desde «Formatos de entrada», GIF, SVG, HEIC y AVIF): lo decide el MIME del índice y, si falta, la extensión o la URL. Quedan fuera las entradas sin formato reconocible (`bin`) y las URL que no son https. El orden es por fecha, el más reciente primero, sea imagen o vídeo: `createdAt` o, si falta, el sello del id; en caso de empate, el orden del índice. Por eso el último contenido generado es siempre el primero de la lista. Cada imagen lleva la marca **Imagen** / **Image**; si el índice no trae miniatura, la imagen hace de miniatura. El filtro por cliente (`/marca`), el combo de hashtags y la preselección de la coincidencia más reciente funcionan igual. El contador dice «N vídeos e imágenes listos», «N imágenes listas» o «N vídeos listos», según lo que se ve. El filtro y el orden viven en `adaptaciones/stock-fuentes.js`, un script clásico sin DOM que también cargan los tests.

**Fuente local.** «Subir desde tu equipo» acepta vídeo o imagen (JPG, PNG o WebP; ahora también GIF, SVG, HEIC y AVIF), con el mismo límite de 100 MB.

**Previsualización.** La imagen sustituye al vídeo en el escenario del paso 1; para una imagen no se muestran ⏯ ni el sonido. La línea de información y la tarjeta «Imagen original» dicen `ancho×alto · imagen fija`. El reencuadre es el del vídeo (recorte, contener, expandir con fondo desenfocado, foco y zoom) en todas las tarjetas: formatos de proporción, biblioteca, formatos del proyecto y videowalls segmentados, con la pared física y la entrega. Las tarjetas PNG (display e impresión) también tienen método, foco y zoom en Avanzado, tanto para vídeo como para imagen.

**Exportación.** Cada botón dice qué saldrá:
- **Display e impresión:** «Exportar PNG», como hasta ahora, con 150 ppp en impresión. Con una imagen, las tarjetas de display ofrecen también **JPG** (calidad 90), más ligero para las redes de display. Impresión sigue solo en PNG.
- **Redes, digital, formatos del proyecto (Altadis) y especiales:** «Exportar MP4 · N s». Es un MP4 H.264 a 25 fps con la imagen fija, sin audio. La duración se elige en la barra del paso 2 («MP4 · imagen fija»): de 1 a 60 s enteros, 10 por defecto, y se recuerda en el navegador (`pixeria.adapter.still`). En los videowalls, «Exportar entrega» y «Exportar por pantalla» también indican la duración.

El MP4 sale del mismo pipeline FFmpeg WASM, por la misma cola y con los mismos límites: presupuesto de 96/192 MiB, tope de 128 MiB por salida y rechazo a partir de 124 MiB. `stillJob` (`adapter-core.mjs`) toma el trabajo de vídeo de cualquier formato, entrega o lote por pantalla y solo cambia esto:
- la entrada: `-loop 1 -framerate 25 -t N -i input.png`;
- la imagen se pasa a RGB y se aplana su alfa sobre negro (`format=rgba,premultiply=inplace=1,format=rgb24`), que es lo que muestra el canvas;
- `-r 25` siempre;
- quita el audio (`-an`);
- añade `-tune stillimage` y `-color_range tv`.

El grafo de reencuadre es el mismo carácter a carácter. `-color_range tv` convierte de verdad a rango limitado: un JPEG pasado tal cual saldría `yuvj420p` (rango completo), que muchos players muestran lavado. FFmpeg recibe la imagen tal como la pinta el navegador, con la orientación EXIF aplicada y los mismos píxeles que el previo: se rasteriza una vez por fuente a PNG. Si el navegador no puede (límites de canvas), usa el archivo original con su extensión. El motor (`adapter-export.js`) escribe la entrada con el nombre que pide el trabajo (`input.png`), porque el demuxer image2 necesita la extensión para aplicar `-loop 1`. El plan técnico (Experto) enseña la orden real con `-loop 1`.

**Stock.** Los MP4 hechos desde una imagen se publican al Stock como cualquier adaptación (`/stock-publish`, `type: video`). Llevan además la etiqueta `imagen-fija`, «imagen fija · N s» en el prompt, la duración elegida en `validacion.duracion` y el póster del propio MP4. Los PNG y JPG no se publican, igual que los PNG hechos desde vídeo: el proxy `/stock-publish` solo admite MP4.

**Ficha técnica.** Con una imagen la ficha muestra:
- **Imagen:** resolución, aspecto, orientación, duración «Imagen fija» y formato (JPEG, PNG o WebP). El formato sale del MIME y se confirma con la firma de los primeros bytes, que se leen por Range.
- **Archivo:** peso y MIME.
- **Audio:** «No · imagen fija».
- **Origen:** origen, fuente, alta y cliente, como con los vídeos.

La fuente remota se carga con `?cors=1` (`corsURL`, PR #67). Las miniaturas de imagen de la lista usan la misma URL en modo CORS para compartir caché. La ficha quita ese parámetro para reconocer el contenido del índice, también con los vídeos.

**Bilingüe.** Toda la interfaz nueva existe en ES y EN. El paso 1 se llama «Contenido» / «Content» y el botón de vuelta dice «← Cambiar imagen» / «← Change image» cuando la fuente es una imagen.

**Límites.**
- La imagen es fija: no hay animación, zoom progresivo (Ken Burns) ni audio añadido.
- El bitrate es el del perfil (ABR), igual que con vídeo. Con una imagen fija es más de lo necesario, pero respeta el techo de cada player.
- GIF, SVG, HEIC y AVIF: ver «Formatos de entrada».
- Una imagen enorme que el navegador no pueda rasterizar se pasa a FFmpeg tal cual. Si además tiene rotación EXIF, el MP4 podría no coincidir con el previo.
- Importar por URL (caja 2) sigue siendo solo para vídeo.

**Verificación.** `test/adapter-imagenes.test.mjs` cubre:
- el filtro del índice con imágenes y vídeos, sobre la forma real de la entrada del café;
- el orden por fecha;
- el plan imagen → MP4: dimensiones, 25 fps aunque el plan diga otra cosa, duración y límites de 1–60 s, sin audio y el mismo reencuadre;
- los especiales;
- la carga útil del Stock.

Con `ADAPTER_FFMPEG_TEST=1`, FFmpeg nativo convierte un JPG y un PNG con alfa en MP4 (cover, blur y contain; 1080×1920 y 300×250). ffprobe confirma H.264, 25/1, `yuv420p` de rango limitado, N×25 fotogramas, la duración y que no hay audio. También comprueba que la mitad transparente sale negra y que el lote por pantalla da 50 fotogramas por pantalla. Con `STOCK_INDEX=<index.json>` se valida además el índice real.

`test/adaptador-imagenes.browser.cjs` usa Playwright con la verja simulada en `/auth/session` y el índice real del Stock. Elige la imagen más reciente y comprueba la ficha, la URL `?cors=1`, el canvas sin contaminar y las tarjetas reencuadradas. Después exporta un PNG de 300×250 (firma e IHDR), un JPG y un MP4 9:16 de 3 s con FFmpeg WASM. ffprobe da 1080×1920, H.264, 25/1, 75 fotogramas, 3,000 s y sin audio. La publicación al Stock se intercepta: no se publica nada. Repite la elección a 390 px y en inglés y guarda capturas a 1440 y 390 px:

```
python3 -m http.server 9187 --bind 127.0.0.1 &
BASE=http://127.0.0.1:9187 SHOTS=/dir PW=/ruta/playwright-core node test/adaptador-imagenes.browser.cjs
```

## Formatos de entrada: GIF, SVG, HEIC y AVIF, y copiar y pegar

Encargo de Carlos, 5-oct-2026. Además de vídeo y de JPG, PNG y WebP, el Adaptador acepta **GIF** (estático o animado), **SVG**, **HEIC/HEIF** y **AVIF**, del Stock, del equipo, pegados con ⌘V / Ctrl+V o soltados en el paso 1. La detección vive en `adaptaciones/formatos-entrada.js`, un script clásico sin DOM que también cargan los tests (como `stock-fuentes.js`); los decodificadores del navegador, en `adaptaciones/fuentes-especiales.mjs`.

**Detección.** Manda el MIME (del índice o del archivo); si falta o es genérico, la extensión del nombre o de la URL. En archivos locales se confirma con la firma de los primeros bytes: JPEG, PNG, WebP, `GIF8`, `<svg` y, en ISO BMFF, la marca `ftyp` (`avif`/`avis` → AVIF; `heic`, `heix`, `mif1`… → HEIC). Así un HEIC sin tipo, que es lo que suele dar Finder, entra igual.

**GIF.**
- Se recorre el archivo entero (sin decodificar el LZW): fotogramas, retardos y bloque `NETSCAPE2.0`. Es **animado** si tiene más de un fotograma; con datos truncados basta la cabecera NETSCAPE. Un solo fotograma, aunque traiga NETSCAPE, se ve estático y se trata como imagen fija. *Desviación justificada:* «NETSCAPE o más de un fotograma» llevado al pie de la letra convertiría en vídeo un GIF de un fotograma, con un MP4 de una décima.
- Los retardos de 0 o 1 centésima valen 100 ms, como en Chrome, Firefox y el demuxer gif de FFmpeg (`min_delay` 2, `default_delay` 10): la vista previa, la ficha y el MP4 usan la misma duración.
- **Vista previa en bucle.** Con WebCodecs `ImageDecoder` (Chrome, Edge, Firefox recientes) el GIF se pinta en un lienzo propio (`#src-anim`), fotograma a fotograma con sus propios retardos. Sin `ImageDecoder` (navegadores sin WebCodecs de imagen, como Safari), FFmpeg WASM lo pasa a un MP4 intermedio que el `<video>` reproduce en bucle; la ficha dice cuál se usó. ⏯ pausa y reanuda; no hay botón de sonido.
- **Exportación.** El MP4 sale siempre del GIF original, no del intermedio: `animJob` (`adapter-core.mjs`) lee el GIF una vez (`-ignore_loop 1`), lo aplana sobre negro como una imagen fija, clona el último fotograma, remuestrea a 25 fps y corta en `round(duración × 25)` fotogramas (`tpad,fps=25,trim=end_frame=N`). El MP4 dura un bucle, ±20 ms por la rejilla de 25 fps, sea cual sea la versión de FFmpeg. H.264, 25 fps, rango limitado y sin audio; mismo grafo de reencuadre, también en videowalls (entrega y por pantalla). PNG y JPG sacan el fotograma que se ve. Publicar en el Stock funciona igual (MP4, `validacion.duracion` = duración del GIF).
- La ficha dice «GIF animado» o «GIF estático» y, si es animado, fotogramas y fps de media, duración de un bucle, bucles (infinito, N o sin bloque), cómo se previsualiza y qué se exporta.

**SVG.**
- Tamaño base: `width`/`height` absolutos (px, pt, pc, mm, cm, in, Q); si falta uno, se deduce del `viewBox`; si faltan los dos, el `viewBox`; sin nada, 300 × 150 (el tamaño por defecto de CSS). Los porcentajes no cuentan como tamaño.
- **Rasterizado por formato.** `svgRaster` calcula la escala que el reencuadre aplica al origen en cada salida (recorte: la mayor; contener y expandir: la menor; × zoom) y se rasteriza a ese tamaño, no una vez: un SVG de 160 × 90 sale a 3414 × 1920 para un 9:16 recortado y a 2362 × 1329 para el póster. El MP4 recibe un PNG por formato (la línea de la cola dice el tamaño) con un tope de 4096 × 4096 px (16,7 Mpx) y 8192 px de lado; por encima, FFmpeg escala. Las previsualizaciones usan rásteres en saltos de √2 en una caché de 16.
- **Seguridad.** El SVG solo se trata como texto (`svgConTamano` cambia `width`/`height` y añade `viewBox` y `xmlns` si faltan) y se carga como imagen desde un blob: el navegador no ejecuta sus scripts ni carga recursos externos. Nunca se inserta en el DOM. El e2e lo comprueba con un `<script>` dentro del SVG.
- Los SVG remotos se piden con `corsURL` (`?cors=1`). Un SVG que dependa de fuentes o imágenes externas puede verse distinto o no dibujarse: se avisa.

**HEIC/HEIF.**
- Si el navegador lo abre (Safari), se usa la vía nativa. Si no, se descarga bajo demanda **libheif-js 1.23.5** (`libheif-wasm/libheif-bundle.mjs`, ES module con el `.wasm` dentro), desde jsDelivr y con la versión fijada, como `@ffmpeg/core`. Antes de ejecutarlo se comprueba su SHA-256 (`095194187be00d3e36335b8ad7f5552d70655e5e2159486d7d36cd4daa47bba9`).
- **Peso:** 2 043 959 B sin comprimir; jsDelivr lo sirve con brotli (≈ 0,63 MB) o gzip (≈ 0,72 MB). Una vez por sesión.
- **Licencia:** LGPL-3.0 (libheif-js y libheif; incluye libde265, también LGPL-3.0). Se carga sin modificar, como biblioteca aparte y sustituible, sin enlazarla en nuestro código. No se aloja en el repositorio.
- Se decodifica la imagen principal a PNG en el navegador; desde ahí es una imagen fija más. La ficha dice «HEIC» y la decodificación usada: nativa o `libheif-js 1.23.5 · WASM` (LGPL-3.0).
- Si falla, un mensaje claro: no se pudo descargar el decodificador, no coincide con la versión fijada, supera 100 MB o el archivo no se pudo decodificar, con la salida práctica (abrirlo en Safari o exportarlo a JPG).

**AVIF.** Decodificación nativa (Chrome, Edge, Firefox y Safari recientes). Si el navegador no puede, se dice así y se propone actualizarlo o convertir a JPG/PNG. Un AVIF animado se trata como imagen fija.

**Lista del Stock.** `stock-fuentes.js` admite los MIME `image/gif`, `image/svg+xml`, `image/heic`, `image/heif` y `image/avif` y sus extensiones. El índice real (5-oct-2026) tiene 8 GIF (`image/gif`), además de JPG, PNG y WebP; ningún SVG, HEIC ni AVIF todavía: entrarán cuando aparezcan. La marca de la lista dice GIF, SVG, HEIC o AVIF en lugar de «Imagen». La subida local los acepta (`accept` con MIME y extensiones), con el mismo límite de 100 MB.

**Copiar y pegar.**
- En el paso 1, ⌘V / Ctrl+V pega una captura de pantalla, una imagen copiada de otra web o un archivo copiado en Finder (`clipboardData.files` o `items` de tipo archivo). Un vídeo pegado como archivo también entra. Lo pegado pasa por «Subir desde tu equipo» (mismo límite, misma ficha, origen «Pegado · nombre»); una captura, que llega como `image.png`, se renombra `pegado-AAAAMMDD-HHMMSS.png`.
- Texto con una URL: si es de imagen o de vídeo, se usa como fuente remota con `corsURL`; si es de YouTube, Instagram, TikTok, X, Vimeo… (o una página sin extensión de medio), va al importador de la caja 2. Si no hay archivo ni texto, se mira el `<img src>` del HTML copiado.
- Pista visible en la caja 2 («o pega una imagen con ⌘V», Ctrl+V fuera del Mac) y aviso accesible (`#paste-status`, `role=status`, `aria-live=polite`): «Imagen pegada: …», «Imagen por URL: …» o por qué no se puede usar.
- No interfiere con los campos de texto: con el foco en un input (hashtag, URL…) ⌘V pega texto como siempre. Fuera del paso 1 no hace nada.
- Arrastrar y soltar archivos o una URL sobre el paso 1 hace lo mismo, con el borde de la zona resaltado.

**Bilingüe.** Toda la interfaz nueva existe en ES y EN (`/en/adaptaciones/`), con la misma UX cuadrática: nada nuevo en la barra superior; el GIF y el SVG se ven en el mismo escenario y la ficha del paso 1.

**Límites.**
- Las imágenes remotas de otros sitios dependen de su CORS: si no lo permiten, se pide descargarla y subirla, o copiarla y pegarla.
- La rejilla de 25 fps cuantiza los retardos del GIF (cada fotograma dura un múltiplo de 40 ms) y la duración (±20 ms).
- El MP4 intermedio sin `ImageDecoder` descarga el motor de vídeo (≈ 32 MB) la primera vez y es solo para ver: la exportación lee el GIF.
- HEIC: solo la imagen principal; sin secuencias, ráfagas ni Live Photos. AVIF y WebP animados: imagen fija.
- SVG: por encima de 4096 × 4096 px por formato el MP4 se reescala (p. ej. paredes de 14 400 px con recorte).

**Verificación.**
- `test/adapter-formatos.test.mjs`: detección por MIME, nombre y URL; firmas (incluidos HEIC con `mif1` y AVIF con `avif`); recorrido de GIF hechos a mano (animado, estático, un fotograma con NETSCAPE, sin NETSCAPE, truncado, retardos 0/1 → 100 ms, bucles) y fotograma visible en cada instante; medidas del SVG (unidades, `viewBox`, comentarios), reescritura como texto y `svgRaster` a varias resoluciones con topes y saltos de √2; portapapeles con archivos, `items`, HEIC sin tipo, vídeo, archivo no admitido, `text/uri-list`, texto, HTML y nada; la lista del Stock; el plan `animJob`/`animPreviewJob`; libheif fijado (con `ADAPTER_NET_TEST=1`, descarga y SHA-256). Con `ADAPTER_FFMPEG_TEST=1`, FFmpeg nativo convierte un GIF de 12 fotogramas con retardos desiguales (2,05 s) en MP4 de 1080×1920, 300×250 y 1920×1080: ffprobe da H.264, 25/1, 51 fotogramas y 2,05 ± 0,04 s, sin audio; y la vista previa intermedia dura lo mismo.
- `test/adaptador-formatos.browser.cjs` (Playwright, verja simulada en `/auth/session`, publicación al Stock interceptada; los ficheros se crean con ffmpeg y `sips`): pegar una captura con `ClipboardEvent` + `DataTransfer` (y no hacerlo con el foco en un campo), pegar la URL de una imagen del Stock (`?cors=1`) y una de YouTube (importador); SVG con `<script>` que no se ejecuta, raster nítido a 1280×720 frente al ampliado, PNG 300×250 y póster 2362×3543, MP4 9:16 de 1 s; GIF animado con `ImageDecoder` (6 fotogramas distintos en bucle, ficha), JPG del fotograma y MP4 9:16 (ffprobe: 1080×1920, 25/1, 23 fotogramas, 0,92 s), GIF estático; GIF sin `ImageDecoder` (MP4 intermedio con FFmpeg WASM); AVIF nativo; HEIC con libheif WASM en Chrome headless; 390 px y inglés. Guarda capturas a 1440 y 390 px:

```
python3 -m http.server 9191 --bind 127.0.0.1 &
BASE=http://127.0.0.1:9191 SHOTS=/dir PW=/ruta/playwright-core node test/adaptador-formatos.browser.cjs
```
