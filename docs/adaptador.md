# Adaptador y Pixie

Base #4905 · FLT-101368. Mejora de exportación y persistencia: misión Yokup #223. Publicación autorizada por Carlos el 3-oct-2026; release v.03.10.2026.r5.22:23.

Actualización 9-oct-2026: las imágenes completan horizontal ↔ vertical en **1 Clásico**; **2 Formatos especiales** conserva los formatos del proyecto y otros tamaños. Véase [Clásico en el paso 1](#clásico-en-el-paso-1--classic-in-step-1). EN: still-image landscape/portrait adaptation is completed in step 1; step 2 keeps project and additional sizes.

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

El panel **Tamaños** (☰ Opciones) permite buscar por nombre o medidas (`300 × 250`, `300x250`), filtrar orientación y marcar tamaños por categoría: redes, digital, display e impresión. Buscar o filtrar no modifica la selección. Cada grupo tiene una casilla tri-estado (redes 8, digital 6 más los tamaños propios, display 23, impresión 5): si el grupo está entero, un clic lo desmarca; si está vacío o a medias, lo marca entero. El estado parcial se ve (casilla con guion, contador «3/8») y se anuncia (`aria-label` con «3 de 8 marcados» y la acción del próximo clic; región `#group-status` al cambiar). Al lado, el rótulo dice qué hará el clic: «Marcar los 8» / «Desmarcar los 8». Con búsqueda u orientación activas, el control actúa solo sobre lo visible y el rótulo lo dice: «Marcar 5 visibles». Funciona con ratón, Espacio y Enter, y el foco vuelve a la casilla tras redibujar el panel. «Todos los tamaños» / All sizes es el mismo control sobre todo lo que muestra el panel (los 42 de la biblioteca, o los propios del proyecto). En un proyecto con ficha, los grupos son los de su familia: en Altadis, estándar 18, MyBlu 6 y especiales · videowalls 5. La selección por grupos se guarda como el resto. Lógica pura en `format-catalog.mjs` (`sizeGroups`, `selectionState`, `toggleSelection`, `selectionAction`); tests: `node --test test/adapter-grupos.test.mjs` y, en el navegador, `BASE=http://127.0.0.1:9197 SHOTS=/dir PW=/ruta/playwright-core node test/adaptador-grupos.browser.cjs`. Las campañas sustituyen la selección de la biblioteca: redes 8, display 23 o móviles 3 (300×50, 320×50 y 320×100). El botón Adaptar / Adapt genera esa lista en la cola, con progreso N/total; cada pieza queda descargable y, si es MP4, se sube al Stock. Se pueden quitar tamaños desde su tarjeta o quitar todos. Los perfiles Biblioteca y de cliente conservan sus selecciones y ajustes al alternar.

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

## Estancos y circuito

Encargo de Carlos (6-oct-2026) para los 9 estancos Altadis de Barcelona. Hay dos piezas: el paquete por estanco y la publicación al circuito.

### Datos

- La ficha `adaptaciones/proyectos/altadis-estancos-bcn.json` apunta a `estancos: {archivo: "estancos/altadis-estancos-bcn.json"}`.
- Ese JSON contiene el circuito (`altadis_bcn`), la fuente y el mapa de pantallas a formatos. También contiene los 9 estancos, cada uno con:
  - `id`, `orden`, `nombre`, `slug`, `direccion`;
  - `expendeduria`, con su número y su fuente, o `null`;
  - `osm` y `coords`;
  - `pantallas[]`, cada una con `id`, `screen`, `nombre`/`nameEn`, `ubicacion`, `ancho`, `alto` y el `formato` de la ficha.
- Los estancos y sus pantallas se copian de la semilla canónica del circuito: `clearchannel-tv/data/circuitos/circuito-altadis-bcn-9.seed.json`, commit `3d39ba3`.
  - Esa misma lista está en Yokup (proyecto `altadis-estancos-bcn`) y en `brain.digitalavatar.ai/locations`.
  - Son los `shop=tobacco` de OpenStreetMap más cercanos a Carrer del Planeta 7. Se eligieron para la demo, así que son **demo**: Altadis no ha confirmado ni su parque real ni sus medidas.
  - Cada estanco tiene dos pantallas: P1 vertical de 1080×1920 en el escaparate y P2 horizontal de 1920×1080 en el mostrador. No hay LED ni videowalls registrados.
- **El mapa de pantallas a formatos no existe en ningún sistema.** Se deriva así (`mapa.estado = "derivado"`):
  - por resolución exacta y uso de la ficha: P1 → `cliente-01` VERTICAL (tótem / escaparate) y P2 → `cliente-02` HORIZONTAL (mostrador);
  - `cliente-04` SINCRO LOGO también mide 1920×1080, pero no se usa.
  - Cuando Altadis confirme sus pantallas, se cambia `formato` en el JSON. Puede ser cualquier id de la ficha, también `cliente-esp-N` o MyBlu. El test de esquema comprueba que existe y que las medidas cuadran.
- `test/adapter-estancos.test.mjs` valida el esquema:
  - la versión y el proyecto de la ficha;
  - que cada estanco tenga al menos una pantalla;
  - que cada formato referenciado exista en la ficha y mida lo que dice la pantalla;
  - que no haya ids, slugs ni `screen` repetidos, y que `screen` sea `<estanco>-<pantalla>`.
- `validateFicha` acepta `estancos: {archivo}` siempre que el archivo quede dentro de `adaptaciones/`.

### Interfaz (proyecto Altadis activo)

- En ☰ Tamaños, debajo de Proyecto, aparece la sección **Estancos**:
  - los 9 estancos con dirección, número de expendeduría y, por cada pantalla, su medida y su formato;
  - la casilla «Todos los estancos»;
  - la casilla «Publicar el lote en el Stock»;
  - el botón «Preparar paquete · N estancos · M formatos».
- La elección se recuerda por proyecto en `pixeria.adapter.estancos.<proyecto>`.
- «Preparar paquete» necesita un contenido elegido en el paso 1. Al pulsarlo:
  1. Pasa al perfil del proyecto y marca **exactamente** los formatos de esas pantallas. Desmarca los demás formatos propios; la biblioteca general no se toca.
  2. Los exporta en la cola de siempre. Cada formato se codifica **una sola vez**; los videowalls salen en su archivo de entrega.
- El panel **Paquete por estanco** agrupa el resultado por estanco:
  - por cada pantalla muestra el archivo, el tamaño y, si se ha publicado, el número del Stock;
  - cada estanco tiene su botón ZIP, y hay otro botón «ZIP · todos».
- El ZIP se genera en el navegador con fflate 0.8.2, que se baja de jsDelivr. Antes de ejecutarlo se comprueba su SHA-256 (`FFLATE` en `estancos-core.mjs`).
  - Va sin deflate, porque MP4 y PNG ya están comprimidos, y con fecha fija: el mismo lote da el mismo ZIP.
  - Rutas: `<estanco>/<pantalla>-<formato>-<ancho>x<alto>.mp4|png`, por ejemplo `altadis-bcn-003-n275-torrent-de-l-olla/p1-vertical-cliente-01-1080x1920.mp4`. Si varios estancos usan el mismo archivo, se copia en cada uno.
  - En la raíz va `manifest.json`, con una entrada por pantalla: estanco, pantalla, `screen`, formato, medidas, archivo, duración, bytes, SHA-256, fuente y, si se publicó, `stock {id, num, externalRef}`.
- Si una línea falla o se cancela, el paquete queda «incompleto» y lo dice.

### Publicar al Stock

- Con la casilla marcada, el lote se publica al terminar. El botón «Publicar en el Stock» lo repite o lo reintenta.
- Va por el mismo `/stock-publish` de las adaptaciones (`publishAdaptation` con `extra`). Las piezas de más de 8 MB suben antes por partes (ver «Subida por partes al Stock»); mientras suben, el estado del panel dice «Stock: subiendo <formato> · N %».
- Se publica **una pieza por fuente y formato**:
  - El mismo MP4 sirve a la misma pantalla de todos los estancos del lote.
  - El Stock ya deduplica por contenido (SHA-256): si se suben bytes iguales, devuelve la pieza existente sin cambiarle las etiquetas.
- Etiquetas:
  - `altadis`, `adaptación`, el id del formato y `pantalla-<id>`;
  - `estanco-<id>` por cada estanco, si caben.
  - El worker admite 10 etiquetas de 30 caracteres y añade la de calidad y la de orientación. Si no caben, va `estancos-todos` o `estancos-N`.
  - El reparto exacto estanco × pantalla va en `comment`, que se puede buscar con `/stock/list?q=altadis-bcn-003`, y en el manifiesto.
- `externalRef` estable: `pixeria:altadis-estancos-bcn:<fuente>:<formato>`.
  - La fuente es `stock-<id>` para un contenido del Stock, o `sha256-<16 hex>` de los bytes del archivo, o de la URL si es remota.
- **Sin duplicados**: antes de subir una pieza se mira su `externalRef` en el índice del Stock (`PixeriaStock.porRef`) y en el registro de este navegador (`pixeria.adapter.stock-refs`).
  - Si ya está, se anota «ya estaba» y no se sube.
  - El registro del panel distingue publicada, ya estaba, reutilizada (mismo contenido) y error.
- El Stock solo acepta MP4 desde el Adaptador. Los PNG van únicamente en el ZIP.

### Subida por partes al Stock (8-oct-2026)

Un MP4 de 30 s a ~18 Mbps (el bitrate lo marcan las especificaciones de Altadis y no se toca) pesa ~70 MB. En base64 dentro del JSON de `/stock-publish` eran ~97 MB que la función parseaba y volvía a serializar: el isolate pasaba de 128 MB y Cloudflare respondía 503 «Worker exceeded resource limits». Fallaba todo lo que pasaba de unos 40 MB.

- Hasta 8 MB (`PARTS_THRESHOLD`) se sigue publicando en base64, como siempre.
- Por encima, `publishAdaptation` sube el MP4 **crudo y en trozos** y después publica con `r2Staged` en vez de `base64`. El Stock guarda la misma entrada por los dos caminos (metadatos, etiquetas, motor, título, comentario, póster, `validacion`, `quality`, `dimensions`, `externalRef` y la URL `https://stock.admira.store/stock/<id>/asset.mp4`).
- Rutas (`functions/stock-upload/[accion].js`, que reenvía a `api.admira.store/stock/upload/*` con las mismas cabeceras que `/stock-publish`):
  - `POST /stock-upload/start` `{type, motor, mime, size}` → `{ok, key, uploadId, partSize, maxParts}`.
    - `type` es `video`, `audio` o `image`, y `mime` es de la misma familia (`video/*`, `audio/*`, `image/*`) o `application/octet-stream`.
    - `motor` es `adaptador`, `yt-dlp`, `import` o `local`.
    - `size` es un entero de hasta 2 GB, el tope del Worker. Cada cliente aplica el suyo (ver abajo).
  - `PUT /stock-upload/part?key=&uploadId=&n=` con el trozo crudo y `Content-Length` (≤ 25 MB) → `{ok, partNumber, etag}`. La función lo reenvía como stream: nunca lo lee a memoria.
  - `POST /stock-upload/complete` `{key, uploadId, parts:[{partNumber, etag}]}` → `{ok, key, size}`. El Worker comprueba que el fichero mide lo anunciado en `start` (400 `size-mismatch` si no).
  - `POST /stock-upload/abort` `{key, uploadId}`.
  - Después, `POST /stock-publish` con los metadatos de siempre y `r2Staged: key`.
- El cliente (`adaptaciones/stock-publish.mjs`, `uploadInParts`) sube 2 trozos a la vez y reintenta cada uno hasta 3 veces si falla la red o responde 408, 429 o 5xx. Si un trozo o el cierre fallan, aborta la subida.
- Mientras sube, la nota de la cola dice «Guardando en el Stock… N %».
- Mismo perímetro que `/stock-publish`: nada de `externalId`, `catalogo` ni claves fuera de `uploads/`. `/stock-publish` admite además `thumbnail`, solo si es una URL `https` de hasta 500 caracteres (la miniatura de YouTube de las importaciones).
- Lo que se cierra y no llega a publicarse lo borra el Worker a las 24 h.
- Pruebas: `node --test test/stock-subida-partes.test.mjs`. Cubren los trozos, los reintentos, el abort, la función que reenvía el trozo sin leerlo y `/stock-publish` con `r2Staged`.

#### Los demás caminos al Stock (9-oct-2026)

Las otras tres subidas en base64 pasan a la misma regla: base64 hasta 8 MB y, por encima, por partes. Las del navegador usan el cliente común de `adaptaciones/stock-publish.mjs` (`uploadInParts` y `stockSource`); no hay una segunda copia.

| Camino | Por encima de 8 MB | Tope |
|---|---|---|
| Caja 2 del Adaptador (`adaptaciones/importar.js`, `alStock`) | `stockSource` → `/stock-upload/*` → `/stock-publish {r2Staged}` | 500 MB, como el Adaptador |
| Stock de pixeria.com (`app.js`, `publishToStock`): «Archivos locales → Stock», importación por URL (yt-dlp) y el botón 📌 de reintento | `subirPorPartesSiToca` → `uploadInParts` → `/stock-publish {r2Staged}`, por el proxy del propio dominio | 2 GB, el del Worker. Ya subía episodios de ese tamaño y no se baja |
| CLI `scripts/stock-subir.py` | `/stock/upload/init·part·complete` y `/stock/publish {r2Staged}`, directo al Worker | 2 GB, el del Worker |

- **app.js.**
  - Va por partes solo con los motores `local` y `yt-dlp`, y con un fichero en el navegador (`blob:` o `meta.blob`).
  - El resto (generaciones de otros motores, `data:` pequeñas, `sourceUrl`) sigue igual: hasta 8 MB, base64 directo al Worker.
  - Ya no queda la subida por partes directa al Worker (28-ago), que solo entraba por encima de 70 MB.
  - El progreso sigue en la barra del diálogo de importar, en el texto de estado y en el botón 📌 («⏳ subiendo… N %»).
  - Si el sitio no tiene `/stock-upload`, el error lo dice y remite a `scripts/stock-subir.py`.
- **admira.studio.**
  - El espejo publica estas mismas Pages Functions. `sync.sh` cambia `www.pixeria.com` por `www.admira.studio`, así que su proxy manda `Origin: https://www.admira.studio`.
  - El Worker no mira `Origin` en `/stock/upload/*` ni en `/stock/publish`; solo lo mira en `/stock/site-capsule`, que es de admira.academy. Además, admira.studio está en su lista de CORS. Funciona igual que en pixeria.com y en los previews.
- **stock-subir.py.**
  - Cada trozo se lee del disco a bloques de 1 MB mientras se envía, con `Content-Length` y sin chunked. Nunca tiene en memoria el fichero ni el trozo entero.
  - Reintenta cada trozo hasta 3 veces (esperas de 1 s y 2 s) si falla la red o el Worker responde 408, 429 o 5xx; si no, aborta. Mantiene la cabecera de navegador (sin ella, Cloudflare responde 403 1010).
  - `--max-mb` (8 por defecto) marca dónde empieza la subida por partes.
  - Si un Worker no tuviera la subida por partes, cae al plan B de siempre: base64 hasta 70 MB y, por encima, recodificar el vídeo con ffmpeg.
- Pruebas: `node --test test/stock-subida-partes-callers.test.mjs` (cliente común, `publishToStock` de app.js e `importar.js`, ejecutados en `vm`) y `python3 test/stock-subir.test.py` (Worker falso en 127.0.0.1; `test/stock-subir-py.test.mjs` lo lanza dentro de `node --test`).

### Programación de players

Encargo de Carlos (6-oct-2026): la programación la hace **una función de servidor en pixeria.com, con modo de prueba**. El navegador nunca ve el secreto de admira.tv.

**Contexto (investigado el 6-oct-2026):**

- **Qué reproduce cada player.** Todos los players reales abren `https://www.admira.tv/canal.html?screen=<id>`. Ese canal combina tres fuentes:
  - la lista por defecto de la pantalla, en `admira.tv/api/playlist` (KV `ACCESS`);
  - la parrilla de `api.admira.store/grid/day`, que se reserva con `/grid/book` o `/grid/rundown` y la clave `GRID_KEY`;
  - el modo sincronizado.
- **Quién puede escribir.** Desde pixeria.com solo se puede escribir con `POST admira.tv/api/playlist` y el secreto `STOCK_NOTIFY_KEY` (en admira.tv es el secreto del mismo nombre; acepta la cabecera `X-Notify-Key` o el campo `secret`). «Asignar al circuito…» de `stock.html` lo sigue pidiendo con `prompt()`; el Adaptador ya no lo necesita.
- **Las pantallas de Altadis no existen en el sistema de players:**
  - las 18 pantallas `altadis-bcn-00N-p1-vertical` / `-p2-horizontal` no están en `/grid/screens`;
  - ningún player las abre y sus listas por defecto están vacías;
  - el gemelo de XpaceOS lee un `demo.json` estático.
  - Mientras sea así, la prueba las marca como inexistentes y **no se puede programar** (ni en la interfaz ni en el servidor).

**Formato de admira.tv** (`admira-tv/functions/api/playlist.js`, `cleanItem`). Un POST por pantalla, que **sustituye** su lista por defecto entera:

```json
{"screen": "altadis-bcn-003-p1-vertical", "name": "altadis-estancos-bcn · Estanc nº 275 · Torrent de l'Olla",
 "source": "adaptador altadis-estancos-bcn", "rev": 42,
 "items": [{"id": "<stockId>", "stockId": "<stockId>", "title": "…", "sub": "<estanco> · <pantalla>",
            "lane": "publicidad", "seconds": 10, "asset": "https://stock.admira.store/stock/<id>/asset.mp4",
            "assetType": "video", "tags": ["altadis-estancos-bcn", "altadis_bcn", "altadis-bcn-003", "pantalla-p1-vertical", "cliente-01", "adaptador"]}]}
```

- La clave va en la cabecera `X-Notify-Key`, nunca en el cuerpo ni en la URL. admira.tv firma la lista con `updatedBy: "pixeria-stock · adaptador altadis-estancos-bcn"`.
- Máximo 200 piezas por lista; `seconds` de 2 a 600; `asset` en https. `rev` solo se envía si la lista ya tenía revisión: si alguien la cambió entre la prueba y el POST, admira.tv responde 409.

**Function `functions/players-programar.js`** · `POST /players-programar`:

- **Sesión.** La misma verja de la cookie firmada (`__Host-pixeria_session`, con `aud` del dominio, lista y versión de sesión) mediante `sessionInfo` de `functions/_auth.js`. Vale también la sesión de agente. Sin sesión, 401. Además exige `Content-Type: application/json` y, si llega `Origin`, que sea el propio.
- **Entrada:** `{modo: 'prueba'|'real', proyecto: 'altadis-estancos-bcn', piezas: [{estanco, pantalla, screenId, stockId|url, formato, duracion}], firma?}`.
- **Validación estricta** (400 con la lista `errores`):
  - proyecto conocido: el JSON `adaptaciones/proyectos/estancos/altadis-estancos-bcn.json` se importa en el build (`import … with {type: 'json'}`), no se copia;
  - estanco y pantalla del JSON, `screenId` = `screen` de esa pantalla y `formato` = el suyo;
  - URL `https://stock.admira.store/…` exacta (sin puerto ni usuario) y, si viene `stockId`, de ese asset;
  - `duracion` de 2 a 600 s, sin piezas repetidas y como máximo 50 piezas.
  - Un `stockId` se busca en el índice público del Stock (`stock.admira.store/stock/index.json`): de ahí salen el título y, si las trae, las medidas, que tienen que coincidir con las de la pantalla.
- **`modo: 'prueba'`** no escribe nada fuera. Hace solo lecturas:
  - `GET api.admira.store/grid/screens` para saber si cada `screenId` existe hoy;
  - `GET admira.tv/api/playlist?screen=…` para saber qué tiene ahora cada lista;
  - `HEAD` de cada asset del Stock.
  - Devuelve el plan exacto (por pantalla, el `payload` que se enviaría y cuántas piezas sustituye), `inexistentes`, `assetsNoDisponibles`, `secretoConfigurado`, quién y cuándo, y `firma` (SHA-256 de los payloads).
- **`modo: 'real'`:**
  - sin `env.STOCK_NOTIFY_KEY` → 503 «falta configurar el secreto en el proyecto Pages»;
  - sin la `firma` de una prueba de este mismo lote → 409 `prueba-pendiente`;
  - con pantallas inexistentes o assets que el Stock no sirve → 409 y no escribe nada;
  - si todo cuadra, un POST por pantalla con `X-Notify-Key` y la respuesta por pieza (`ok`, `rev` o `error`), con quién (email de la sesión) y cuándo. 200 si todo fue bien; 502 si alguna pantalla falló.
- **Logs** (`console.log`, evento `players_programar`): modo, email, fecha, proyecto, pantallas y resultado. Nunca el secreto.

**Interfaz.** En el panel «Paquete por estanco», sección «Programación de players» (ES/EN, dentro del contenido, nada en la barra):

- Las piezas salen del lote publicado en el Stock (`programPieces` en `estancos-core.mjs`): una por estanco × pantalla, con `stockId`, `url` del Stock y la duración del archivo. Los PNG no van al Stock y no se programan. Sin publicar, el panel lo dice.
- «Probar programación (sin cambios)» llama al modo prueba y pinta, por pantalla, si existe, qué recibiría y qué tiene ahora.
- «Programar N players de M estancos» está deshabilitado mientras no haya una prueba de **ese** lote (`loteKey`), haya pantallas inexistentes o assets no servidos, o falte el secreto. Pide confirmación explícita (sustituye la lista por defecto) y llama al modo real con la `firma`.
- «Registro de programación» guarda cada prueba y programación con hora, quién y el resultado por pantalla. Después de programar hay que volver a probar.

**Secreto (lo pone Carlos; nadie más lo lee ni lo escribe).** El valor es el mismo `STOCK_NOTIFY_KEY` de admira.tv (la clave del Stock). Hay que instalarlo en los dos proyectos Pages, porque admira.studio es el espejo generado y ejecuta la misma function:

```
npx wrangler pages secret put STOCK_NOTIFY_KEY --project-name pixeria
npx wrangler pages secret put STOCK_NOTIFY_KEY --project-name admira-studio
```

Hasta que esté puesto, la prueba funciona y avisa con `secretoConfigurado: false`, y el modo real responde 503.

**Espejo admira.studio.** `sync.sh` cambia `pixeria.com` por `admira.studio`, así que el `aud` de la cookie cambia igual al crearla y al leerla, y `sessionInfo` sigue valiendo. El nombre `__Host-pixeria_session` va en minúscula y no se sustituye. La function no añade identificadores con «Pixeria» delante; el User-Agent `PixeriaAdaptador/1.0` ya está protegido en `marca.json`. Un test aplica las sustituciones al código y lo comprueba.

**Qué falta y quién decide:**

- **Carlos:** poner el secreto en los dos proyectos Pages (comandos de arriba).
- **Operaciones de admira:** dar de alta las 18 pantallas en `/grid/config` con `circuit: "altadis_bcn"`. Hasta entonces, la prueba sale con 18 inexistentes y no se programa nada.
- **Altadis:** confirmar el parque real y sus medidas.

### Pruebas

- `node --test test/adapter-estancos.test.mjs` cubre:
  - el esquema;
  - la selección de estancos y sus formatos exactos;
  - los nombres y el manifiesto;
  - el ZIP con fflate local (variable `FFLATE`; si no está, el test se salta) y `unzip -l`;
  - el payload del Stock con etiquetas y `externalRef`, sin duplicados.
- `test/adaptador-estancos.browser.cjs` usa Playwright, con la verja simulada en `/auth/session`, `/stock-publish` interceptado y cualquier escritura a `admira.tv/api/playlist` o `api.admira.store/grid|signage` bloqueada y contada como fallo. Recorre esto:
  1. Elige dos estancos, prepara el paquete y comprueba que salen exactamente `cliente-01` y `cliente-02`.
  2. Comprueba que se publican 2 piezas con sus etiquetas y su `externalRef`, y que al volver a publicar no se sube nada.
  3. Descarga el ZIP del estanco y comprueba las rutas, el manifiesto, los SHA-256 y ffprobe con H.264 a la medida de cada pantalla.
  4. Descarga el ZIP global (4 archivos y el manifiesto).
  5. A 390 px y en inglés comprueba «todos» y que no hay desbordamiento horizontal.
- `node --test test/players-programar.test.mjs` cubre la function con `fetch` simulado: sesión válida (agente y Google), sin sesión, entrada no válida, modo prueba sin escrituras, `stockId` resuelto con el índice, modo real con la cabecera `X-Notify-Key` (nunca en el cuerpo ni en los logs), firma y pantallas inexistentes, assets caídos, falta del secreto (503) y el espejo de marca.
- `test/adaptador-programar.browser.cjs` usa Playwright con `/auth/session`, `/stock-publish` y `/players-programar` simulados, y cualquier escritura a admira.tv o a la parrilla contada como fallo:
  1. A 1440 px: dos estancos publicados, «Programar» deshabilitado sin prueba; la prueba enseña 4 pantallas inexistentes y sigue deshabilitado; con las pantallas dadas de alta se habilita, cancelar la confirmación no programa y aceptarla llama al modo real con la firma.
  2. A 390 px y en inglés: la prueba, sin desbordamiento horizontal, y la sesión caducada.

```
python3 -m http.server 9193 --bind 127.0.0.1 &
BASE=http://127.0.0.1:9193 SHOTS=/dir PW=/ruta/playwright-core node test/adaptador-estancos.browser.cjs
BASE=http://127.0.0.1:9193 SHOTS=/dir PW=/ruta/playwright-core node test/adaptador-programar.browser.cjs
```

## Crear (formatos extremos)

Encargo de Carlos (6-oct-2026). En algunos formatos, adaptar es deformar o recortar destrozando la pieza: un banner ultralargo 3840×540 (7:1) desde un 16:9, un rascacielos 160×600 o los videowalls 9x1, 13x1 y CORDOBA-098 de Altadis. Ahí no se adapta: se **crea** un formato nuevo con el mismo contenido. Hay tres recetas locales y gratuitas, sin IA ni servicios externos. El código está en `adaptaciones/crear-core.mjs`, un módulo puro que usan la vista previa, el plan FFmpeg y los tests.

### Cuándo una tarjeta pasa a «Crear»

- Para cada formato se calcula la desproporción `r = max(a_src/a_dst, a_dst/a_src)`, con `a = ancho/alto`. En los videowalls segmentados se usa la pared física, no el archivo de entrega.
- Si `r ≥ UMBRAL_CREAR` (constante en `crear-core.mjs`, **3,5**; 16:9 → 9:16, con r ≈ 3,16, sigue en «Adaptar»), la tarjeta pasa a «Crear». El título muestra la etiqueta **CREAR · <receta>**, y el *tooltip* da el valor de r. Con r < 3,5 todo sigue como antes.
- 16:9 ↔ 9:16 da r ≈ 3,16: con el umbral en 3,5 no lo cruza, así que un vídeo horizontal en la tarjeta vertical 9:16 (o en `cliente-01` de Altadis) sigue en «Adaptar». 1:1 (1,78) y 4:5 (2,22) tampoco cambian.
- Una **receta explícita en la ficha del proyecto** también pasa la tarjeta a «Crear», aunque r < 3,5 (ver «Proyectos: receta por defecto por formato»).
- Cada tarjeta tiene el selector **[Adaptar | Crear]**. El botón activo en automático lleva la marca «· auto». Pulsar el otro botón fuerza esa acción solo en esa tarjeta, y la elección se guarda. En Avanzado, «Acción» vuelve a **Auto** y explica la decisión, por ejemplo «Auto · Crear (r = 4; umbral 3,5)».
- En «Crear», la tarjeta muestra las tres recetas (**Tira · Barrido · Rótulo**). El botón de exportar dice «Crear MP4 · N s». El método (recorte, contener o expandir) es de «Adaptar» y queda desactivado; el foco y el zoom siguen contando.

### Las tres recetas

Todas se calculan en el navegador. La vista previa en canvas usa las mismas funciones que generan el filtro de FFmpeg: geometría, trayectoria y desplazamiento. El MP4 sale por el pipeline FFmpeg WASM de siempre, en H.264 a 25 fps. Funcionan con vídeo y con imagen: JPG, PNG, WebP, AVIF, HEIC, GIF estático, GIF animado y SVG. El SVG se rasteriza a la resolución que pide la receta.

1. **Tira de momentos** (`tira`). Divide el formato en 3–5 piezas a lo largo de su lado largo. Las piezas no se solapan, tienen medidas pares y pueden llevar una separación fina opcional.
   - El número de piezas sale de `round(r)`, limitado entre 3 y 5: 4 en 3840×540 desde 16:9 y 5 en un rascacielos. Se puede fijar en Avanzado.
   - Con **vídeo**, cada pieza es el fotograma central de su tramo, alineado a 25 fps. FFmpeg lee la misma entrada N veces con `-ss`; la vista previa captura esos instantes con un `<video>` oculto. La opción **«Cada pieza reproduce su tramo en bucle»** hace que cada pieza reproduzca su tramo `[i·L, (i+1)·L)`. En ese caso el MP4 dura un tramo (L = D/N) y el player lo repite.
   - Con **imagen o GIF animado**, cada pieza es un recorte con zoom (1,6 por defecto, ajustable de 1 a 3) de una zona distinta, repartida a lo largo del lado largo del contenido.
   - Las piezas aparecen en cascada con un fundido corto (`fade` con alfa). La tira no lleva audio.
2. **Barrido** (`barrido`). El contenido se escala lo justo para llenar el formato sin deformar, multiplicado por el zoom de la tarjeta. Una ventana del tamaño del formato recorre el sobrante de extremo a extremo con un paneo suave (coseno). En 3840×540 desde 16:9, el paneo es vertical; en un rascacielos, horizontal. El otro eje queda en el foco.
   - **Duración:** la del clip, la elegida para una imagen fija o un bucle del GIF.
   - **Ajustes:** recorrido de ida o de ida y vuelta, sentido normal o inverso, y segundos del paneo (0 es toda la pieza; con menos segundos el paneo es más rápido y, en ida, se queda en el extremo).
   - **Precisión:** FFmpeg hace dos recortes. El primero es par y en el espacio del contenido, para no crear intermedios gigantes en paredes de 14 400 px. El segundo se hace tras escalar, con 2 px de precisión en la salida. Las expresiones usan `n` (número de fotograma) y los mismos números redondeados que la vista previa.
   - Conserva el audio del vídeo.
3. **Rótulo en movimiento** (`rotulo`). Un claim y, si se quiere, la miniatura del contenido o un logo recorren el banner: de derecha a izquierda en formatos apaisados y hacia arriba, en líneas, en formatos verticales.
   - **Claim:** campo ES y campo EN opcional; si están los dos, se alternan. Sin texto se usa el título del contenido.
   - **Ajustes:** velocidad (× el lado corto por segundo; 2 por defecto, es decir, 1080 px/s en 3840×540), color del texto y fondo **desenfocado** del propio contenido o **sólido** con su color.
   - **Tipografía:** la del sitio o, si hay marca blanca activa, `--mb-fuente-titulos`.
   - **Cómo se dibuja:** la tira (un periodo de icono, texto y separador, repetido) se dibuja una vez en un canvas. FFmpeg recibe ese mismo PNG como segunda entrada (`rotulo.png`) y lo superpone en `x = −2·floor(mod(v·n/25, P)/2)`. Así, el texto del MP4 es idéntico al de la vista previa.
   - El logo se sube desde Avanzado y solo vive en memoria.
   - Conserva el audio del vídeo.

### Exportación, Stock y especiales

- Mismo pipeline, cola, presupuesto de memoria (96/192 MiB), tope de 128 MiB y rechazo desde 124 MiB. El motor (`adapter-export.js`) admite archivos de entrada extra por trabajo (`extraFiles`), que se escriben y se borran en cada ejecución.
- Nombre del archivo: `<contenido>-<formato>-crear-<receta>-<ancho>x<alto>.mp4`.
- **Stock:** el MP4 se publica como cualquier adaptación, con la etiqueta extra `crear-tira`, `crear-barrido` o `crear-rotulo` y con «crear · receta …» en el prompt. En el paquete por estanco, la etiqueta va junto al formato y el `externalRef` lleva la receta (`…:cliente-01:crear-barrido`): una pieza creada no se confunde con la adaptada. Sin receta, el `externalRef` es el de siempre.
- **PNG y JPG** (display e impresión) en «Crear»: sacan un fotograma representativo. Es la tira completa, la mitad del barrido o el arranque del rótulo. Es también lo que enseña el previo con movimiento reducido antes de pulsar ▶ (ver «Previo animado»).
- **Videowalls segmentados:** la receta se compone sobre la pared física (por ejemplo, 7020×960 en el 13x1 V) en `[wall]`. Después se corta por pantalla como siempre: «Exportar entrega» y «Exportar por pantalla». Ver `atlasJob` y `segmentsJob` con `receta`.
- **Experto:** el plan técnico enseña la orden FFmpeg real de la receta. **Avanzado** resume la receta (piezas, eje del paneo, claim, velocidad y r).

### Proyectos: receta por defecto por formato

La ficha admite `"recetas": {"<formato propio>": "tira" | "barrido" | "rotulo" | "adaptar"}`. `validateFicha` comprueba que el formato sea propio de la ficha y que el valor sea válido. `projectFormats` copia la receta en el formato (`f.receta`), también en los videowalls. La plantilla trae un ejemplo.

**Cómo se combina con el umbral** (6-oct-2026). Una receta explícita de la ficha es la receta por defecto de ese formato y, en la práctica, fuerza «Crear»:

| Acción de la tarjeta | Ficha | Resultado |
|---|---|---|
| `auto` | `tira` / `barrido` / `rotulo` | **Crear** con esa receta, **aunque r < 3,5** |
| `auto` | sin receta | el umbral: Crear si r ≥ 3,5 |
| `auto` | `"adaptar"` | Adaptar (la base de la tarjeta ya es «Adaptar» forzado) |
| `adaptar` (el usuario la fuerza en la tarjeta) | cualquiera | **Adaptar** |
| `crear` (el usuario la fuerza) | cualquiera | Crear |

Lo decide `crear-core · motivoAccion(cfg, src, dst, recetaFicha)` (`accionEfectiva` es su atajo); `motivo` es `forzado`, `ficha`, `umbral` o `sin-contenido`. Sin contenido no hay receta. En la tarjeta, el botón «Crear · auto» y la etiqueta dicen «receta de la ficha del proyecto», y en Avanzado la opción Auto queda como «Auto · Crear (receta de la ficha: Barrido; r = 3)». Los ajustes del usuario por formato tienen prioridad y se guardan solo si difieren de los de la ficha: forzar «Adaptar» en una tarjeta con receta se guarda; dejarla como la ficha, no. El paquete por estanco usa la misma decisión (`creando`), así que con recetas en la ficha **crea sin preguntar**, con la etiqueta `crear-<receta>` y el `externalRef` con la receta.

**Altadis** (`altadis-estancos-bcn.json`, aprobado por Carlos el 6-oct-2026):

- **barrido:** `cliente-06` (SINCRO VW 4X1 H, 3840×540), `cliente-10` (góndola LED 64×384), `cliente-14` (VIDEOWALL 3X1 H, 2880×540), `cliente-esp-2` (6x1 H), `cliente-esp-3` (9x1 H) y `cliente-esp-5` (13x1 V).
- **tira:** `cliente-12` (VIDEOWALL 1X2 V, 540×1920), `cliente-15` (VIDEOWALL 4X1 H), `cliente-21` (VIDEOWALL 1X4 H, 960×2160) y `cliente-esp-1` (5x1 H: 5 piezas, una por pantalla de 640 px).
- **rotulo:** `cliente-09` (LED GRANADA-021, 1536×192), `cliente-18` (SHUTTLE STRETCH, 1920×158), `cliente-19` (LG STRETCH MADRID-199, 3840×600) y `cliente-esp-4` (CORDOBA-098).
- **Sin receta:** `cliente-01` y los que quedan por debajo del umbral frente a un 16:9 (`03`, `05`, `08`, `16`, `20`, `24`): adaptan como siempre.
- **`cliente-17` se queda fuera.** La propuesta lo agrupaba con `cliente-06` como pantalla «Sincro», pero en el PDF es VIDEOWALL 8X1 H (2880×640, uso «videowall»), no un formato sincronizado. Además, r = 2,53 frente a un 16:9. Si se quiere barrido ahí, basta con añadir `"cliente-17": "barrido"`.
- **Por debajo del umbral y con receta:** frente a un 16:9, solo `cliente-14` (r = 3). Crea por la ficha. El resto de formatos con receta tiene r ≥ 3,5 (de 3,6 en `cliente-19` a 15 en CORDOBA-098).

### Previo animado

Encargo de Carlos (6-oct-2026): hay que poder ver cómo quedan las animaciones antes de exportar.

- **Qué ve el usuario.** Cada tarjeta en «Crear» (también los videowalls) lleva, bajo la vista previa:
  - el botón **▶ Previsualizar animación** / **⏸ Pausar animación**;
  - una barra de tiempo fina, que se arrastra o se pulsa para ir a cualquier instante (también con el teclado, porque es un `input range`);
  - la posición y la duración, por ejemplo «0:04 / 0:10». Con piezas de menos de 3 s se muestran décimas: «0:00.4 / 0:00.5».
- **Previsualizar todas.** Junto a «Adaptar · N» aparece **▶ Previsualizar todas · N** cuando hay tarjetas en «Crear». Arranca todas a la vez desde 0, y al pulsarlo otra vez (**⏸ Pausar todas**) las detiene.
- **Reloj propio.** Cada tarjeta tiene un reloj de previsualización (`crear-core · relojPrevio`: `relojT`, `relojPlay`, `relojPausa`, `relojSeek`, `relojDuracion`). Corre en bucle sobre la duración de la receta (`duracionReceta`):
  - funciona con imagen fija, SVG, GIF animado y con el vídeo en pausa;
  - el barrido hace el paneo completo, de ida o de ida y vuelta;
  - la tira hace la cascada de aparición y, con «tramos en bucle», cada pieza reproduce su tramo;
  - el rótulo desplaza el texto.
- **Fiel al MP4.** El previo no tiene trayectoria propia. En el instante t pinta el fotograma `n = previoN(t)` = ⌊t·25⌋ y `previoFotograma(g, n)` devuelve lo que hace el filtro FFmpeg en ese n:
  - en el barrido, la ventana de `barridoVentana`;
  - en el rótulo, el desplazamiento de `rotuloDesplazamiento`;
  - en la tira, el alfa de `alphaCelda` en n/25 y, con vídeo, el instante del origen de cada pieza.
- **Cuándo se mueve solo.**
  - Con imagen, SVG, GIF o el vídeo en pausa, el previo arranca en marcha.
  - Si el vídeo se reproduce, la tarjeta sigue al vídeo como antes («Sigue al vídeo») y ▶ queda como alternativa: al pulsarlo manda su propio reloj.
  - ▶, ⏸ y la barra pasan la tarjeta a control manual. Al volver a reproducir el vídeo, todas vuelven a seguirlo.
  - Con `prefers-reduced-motion`, el previo arranca en pausa en el fotograma representativo y lo indica: «Movimiento reducido: el previo arranca en pausa. Pulsa ▶ para verlo.»
- **En vivo.** Cambiar la receta o sus ajustes (sentido, recorrido, segundos del paneo, piezas, zoom, claim, velocidad, colores) repinta el previo en el mismo instante. Si cambia la duración, el reloj conserva la posición módulo la nueva duración.
- **Rendimiento.** Un `IntersectionObserver` apunta qué tarjetas están en pantalla. Fuera de los repintados generales (cambio de ajustes o fotograma nuevo del vídeo), cada fotograma solo se repintan las tarjetas «Crear» visibles con su reloj en marcha. Antes, una imagen con alguna receta repintaba todas las tarjetas en cada fotograma.
- **Bilingüe, tema Matrix y UX cuadrática.** Los textos salen en ES/EN con `t()`. Los botones son cuadrados, con los tokens del tema (`--ac`, `--ln-hi`, `--rad`), y la barra es de 3 px con el pulgar en el color de acento. «Previsualizar todas» va en la barra de exportación, no en la superior.

### Límites

- La tira con vídeo no lleva audio, porque mezcla momentos distintos. Con tramos en bucle dura un tramo.
- La vista previa de los tramos en bucle usa un `<video>` oculto por tramo, que se resincroniza si se desvía más de 0,3 s. El MP4 es exacto; la vista previa puede ir unos fotogramas desfasada.
- Las piezas de vídeo se capturan buscando el instante con un `<video>` oculto. Si el origen no es de 25 fps, puede haber un fotograma de diferencia con `-ss`.
- El GIF animado dura un bucle, también en el barrido: un GIF de 1 s barre en 1 s.
- Rótulo: el periodo de la tira no tiene por qué dividir la duración, así que el bucle del MP4 puede dar un pequeño salto en el texto. El logo no se guarda al recargar. Una pared muy larga (CORDOBA-098) pinta una tira de unos 17 000 px.
- El flujo opcional de fondo IA estático se documenta en [Altadis · IA y Estancos](altadis-ia-estancos.md). Las recetas Crear siguen siendo locales; no hay expansión temporal generativa ni zonas seguras automáticas.
- Previo animado:
  - Los fotogramas de la tira con vídeo (momentos) se capturan la primera vez que se piden, así que una pieza puede tardar un instante en aparecer.
  - Con tramos en bucle, cada `<video>` oculto se resincroniza si se desvía más de 0,3 s mientras corre. En pausa o al buscar un instante, se ajusta al fotograma.
  - Las tarjetas fuera de pantalla no se repintan, aunque su reloj sigue corriendo.
  - El estado del previo no se guarda: al recargar, las tarjetas vuelven a su modo automático.

### Verificación

- `node --test test/adapter-crear.test.mjs` cubre:
  - la desproporción y el umbral (incluido r = 3,5 exacto y el caso 9:16);
  - el saneado de ajustes;
  - la geometría de la tira (sin solapes, pares, separación, número según r, momentos alineados, tramos, zonas dentro del contenido y distintas, cascada);
  - el barrido en 4 destinos × ida/vuelta × sentido × zoom: empieza y acaba en los extremos, es monótono, nunca sale del contenido, y la **expresión FFmpeg evaluada en JS da los mismos recortes que la vista previa en cada fotograma**;
  - el rótulo (layout, desplazamiento = velocidad × tiempo mód. periodo, misma expresión, formato vertical en líneas);
  - los planes FFmpeg de cada receta con vídeo, imagen y GIF (entradas, audio, `-color_range`, `-r 25`, duración);
  - los videowalls con receta;
  - la ficha con `recetas`;
  - la etiqueta del Stock y el `externalRef` del paquete.
- Con `ADAPTER_FFMPEG_TEST=1`, FFmpeg nativo convierte un 16:9 de 2 s (y una imagen de 3 s) a 3840×540 con cada receta. ffprobe confirma H.264, 25/1, el número de fotogramas, la duración y el audio. También comprueba:
  - que la tira con tramos en bucle dura 0,48 s;
  - que en el barrido la ventana que calcula la vista previa coincide con el fotograma del MP4 mejor que cualquier ventana desplazada ±2/±4 px;
  - que el rótulo coincide con el PNG superpuesto en el desplazamiento calculado;
  - que la pared 13x1 V con barrido da 13 pantallas de 540×960 con 50 fotogramas cada una.
- `test/adaptador-crear.browser.cjs` (Playwright, verja simulada y Stock interceptado) sube un 16:9 de 2 s y añade el 3840×540. Comprueba la etiqueta y el selector, y que la 16:9 siga en «Adaptar». Pinta y exporta las tres recetas con FFmpeg WASM (ffprobe: 3840×540, 25/1, 50 fotogramas, 2 s; audio en barrido y rótulo) y verifica las etiquetas `crear-*` del Stock. Después:
  - fuerza «Adaptar» y «Crear» y comprueba que persisten;
  - exporta una PNG fija (tira), un GIF animado (barrido) y un SVG (rótulo);
  - prueba 390 px e inglés sin desbordamiento.

  Guarda capturas a 1440 y 390 px:

```
python3 -m http.server 9195 --bind 127.0.0.1 &
BASE=http://127.0.0.1:9195 SHOTS=/dir PW=/ruta/playwright-core node test/adaptador-crear.browser.cjs
```

- Los e2e `adaptador-imagenes`, `adaptador-formatos` y `adaptador-estancos` prueban el reencuadre en 9:16 con fuentes 16:9. Ahora fuerzan «Adaptar» en esa tarjeta, o aceptan el sufijo de receta en el `externalRef` del paquete.
- **Recetas de Altadis y previo animado** (`node --test test/adapter-crear.test.mjs`):
  - **Altadis:** las 14 recetas aprobadas; cada id existe en `perfil-cliente-18.json` o `perfil-cliente-especiales.json` y cada valor es una receta; `validateFicha` limpia; `cliente-17` y los formatos por debajo del umbral, sin receta; con receta y r < 3,5, solo `cliente-14`.
  - **Receta de la ficha + umbral + forzado manual:** `motivoAccion` y `accionEfectiva`. Con cualquier contenido, el paquete crea en los 14 formatos y el `externalRef` lleva la receta.
  - **Reloj:** bucle, duración, posición, pausa, seek, cambio de duración; un bucle recorre todos los fotogramas en orden y vuelve a 0; «0:04 / 0:10».
  - **Previo = plan FFmpeg:** en más de 1000 instantes del reloj, para 3 destinos (banner, rascacielos y pared 13x1 V), 3 fuentes (vídeo, imagen y GIF) y 6 variantes de receta, el fotograma del previo coincide con las expresiones FFmpeg evaluadas en ese n (ventana del barrido y desplazamiento del rótulo) y con los `fade` y `-ss` de la tira.
- `test/adaptador-previo.browser.cjs` (Playwright):
  - **Imagen fija con barrido:** con movimiento reducido arranca en pausa y lo indica; ▶ cambia el canvas entre dos instantes y la barra avanza.
  - **Seek:** con valor exacto el mismo instante pinta el mismo fotograma, y un clic a mitad de la barra lleva a unos 5 s de 10.
  - **Ajuste en vivo:** cambiarlo actualiza el previo.
  - **Tira y rótulo:** la tira aparece en cascada (0 % → 25 % → 50 % → todo) y el rótulo se desplaza.
  - **Previsualizar todas:** arranca y pausa dos tarjetas.
  - **Vídeo:** reproduciéndose, la tarjeta sigue al vídeo; ▶ toma el reloj propio, que sigue animando con el vídeo en pausa.
  - **Altadis:** aplica las 14 recetas (`cliente-14` incluida) y deja sin receta las demás; forzar «Adaptar» se guarda; el videowall 13x1 V anima la pared y la entrega.
  - **390 px y /en/:** sin desbordamiento.
  - **Capturas y vídeo:** con `SHOTS` guarda capturas y un MP4/GIF del previo grabado con `recordVideo`.

```
BASE=http://127.0.0.1:9195 SHOTS=/dir PW=/ruta/playwright-core node test/adaptador-previo.browser.cjs
```


## Fondo IA y aplicaciones virtuales (7-oct-2026) / AI backgrounds and virtual placements

[Guía y tutorial ES/EN · Altadis IA y Estancos](altadis-ia-estancos.md). El modo desenfocado sigue sin IA; Generar fondo IA utiliza el motor autenticado de imagen y compone el original delante. / Blur remains non-generative; Generate AI background uses the authenticated image engine and composites the original in front.

## Calidad de adaptación / Adaptation quality · 8-oct-2026

ES: El editor prioriza el detalle de exportación. Reescala con Lanczos y redondeo preciso; todos los MP4 finales usan H.264 `veryfast` en vez de `ultrafast`, con los mismos límites de bitrate, resolución, FPS, GOP y memoria del perfil. Se aplica a Adaptar, Crear, entrega de videowall, archivos por pantalla y fondo IA. Los previos y las salidas PNG/JPG solicitan suavizado de alta calidad al navegador; el algoritmo de canvas depende del navegador y no es idéntico a FFmpeg. El proxy de reproducción de GIF sigue priorizando velocidad: no se usa como origen de la exportación.

EN: The editor prioritises export detail. Resizing uses Lanczos with accurate rounding; every final MP4 uses H.264 `veryfast` instead of `ultrafast`, retaining the profile's bitrate, resolution, FPS, GOP and memory limits. This covers Adapt, Create, videowall delivery, per-screen files and AI backgrounds. Previews and PNG/JPG output request high-quality browser smoothing; the browser chooses its canvas algorithm, which is not identical to FFmpeg. GIF playback proxies still prioritise speed and are never the export source.

ES: Puede tardar más. No añade resolución real a una fuente pequeña, no recupera texto perdido por un recorte y no cambia el foco ni los ajustes guardados. Para conservar una pieza completa, elige Contener o fondo desenfocado/IA y comprueba el previo de cada formato.

EN: Export may take longer. It cannot restore missing detail in a small source or text removed by cropping; focus and saved settings are retained. To preserve the whole original, use Contain or a blurred/AI background and inspect each format's preview.

Tutorial ES: Contenido → Adaptar → elegir tarjeta → Avanzado para encaje, foco, zoom y compatibilidad → revisar previo → exportar → descargar desde la cola. Experto muestra la orden que ejecuta esa exportación.

Tutorial EN: Content → Adapt → select a card → Advanced for fit, focus, zoom and compatibility → review preview → export → download from the queue. Expert shows the command used for that export.

Prueba reproducible / Reproducible test: `ADAPTER_FFMPEG_TEST=1 node --test test/adapter-quality.test.mjs`. Muestra sintética / synthetic fixture, 960×540 → 360×640, 4 s, 25 fps, 400 kbps: SSIM 0.991792 → 0.997361 frente a la referencia sin pérdidas / against a lossless reference. Es evidencia de esa muestra, no una garantía universal ni una medición de velocidad WASM / Evidence for this sample, not a universal guarantee or WASM speed measurement.

Validación / Validation: 65 pruebas pasan; una dependiente de una copia local del índice Stock se omite. FFmpeg nativo comprueba medidas, duración, audio, recetas, segmentos, imágenes y GIF. El navegador FFmpeg WASM exportó y descargó una muestra vertical H.264, 1080×1920, yuv420p, 25 fps, 50 fotogramas y 2,000 s. La revisión local no dispone de sesión Stock; guardar la muestra en Stock no se verificó. No se ha cambiado el publicador. / 65 tests pass; one requiring a saved Stock index is skipped. Native FFmpeg checks dimensions, duration, audio, recipes, segments, pictures and GIFs. Browser FFmpeg WASM exported and downloaded a vertical H.264 sample at 1080×1920, yuv420p, 25 fps, 50 frames, 2.000 s. Local review has no Stock session; publishing that sample to Stock was not verified. The publisher is unchanged.

## Anuncios reales

ES · Imágenes fijas (JPG/PNG/WebP/SVG/HEIC/AVIF rasterizados): al entrar en Adaptar, se analiza el anuncio con visión y se extraen **todos los bloques de texto publicitario**, con acentos, importes y condiciones, además del producto y la escena. La copia aparece editable; una lectura dudosa exige corregirla y confirmarla. No se traduce ni se completan palabras ilegibles automáticamente. Cambiar el texto o la fuente invalida los resultados y sus aprobaciones.

**Recomposición** separa fotografía y texto: elimina la tipografía rasterizada, comprueba la capa visual y dibuja la copia completa de nuevo con saltos de línea y márgenes seguros. **Recreación** crea una nueva fotografía a partir de la referencia cuando la desproporción supera 2, el anuncio vive dentro de un cartel/pantalla o la capa visual de la recomposición falla. No es un paneo ni un recorte llamado recreación. La referencia guía el producto y la escena; la IA puede variar detalles, por eso hay que revisar su identidad. Las palabras finales las dibuja el compositor, no el generador de imágenes.

Flujo: Contenido → Adaptar → revisar «Texto extraído» → corregir/Confirmar texto si hace falta → Crear anuncio en una tarjeta o Crear anuncios para el lote → revisar cada pieza → **Aprobar pieza** → PNG de la tarjeta o Exportar MP4. Recrear de nuevo produce un borrador nuevo; requiere otra aprobación. Se conserva el original junto a las versiones. El progreso refleja etapas y formatos terminados, sin porcentajes de generación inventados. Cancelar o cambiar de fuente descarta respuestas tardías y no exporta el recorte anterior.

El previo, el PNG y el MP4 de imagen fija usan **el mismo lienzo nativo**. El MP4 mantiene la duración elegida (1–60 s), 25 fps y ausencia de audio. El visual se contiene completo aunque el proveedor entregue otra proporción. En un videowall el texto se coloca dentro de una pantalla física y la imagen en el espacio restante; atlas y segmentos salen del mismo lienzo. Si el texto completo no cabe con el mínimo legible, la exportación se bloquea: no se trunca ni se reduce sin límite. Revisar cada pieza sigue siendo necesario; el análisis visual no certifica identidad exacta, legibilidad a distancia ni hardware real.

Si quedan letras publicitarias en la fotografía, falta el producto, la lectura es incompleta, el proveedor falla o se agota el tiempo, no se permite exportar ese resultado. La sesión existente autoriza análisis/generación con los proveedores configurados; pueden consumir crédito. No hay publicación durante el análisis o la creación del borrador. El MP4 aprobado conserva el publicador Stock existente; PNG se descarga. Vídeo/GIF conservan el motor y las recetas anteriores: **este flujo no hace OCR temporal de vídeo**.

Contrato: `POST https://api.admira.store/image/analyze`, autenticado, `{image:dataURL,action:"extract"}` → `pixeria.advertisement.v1` con `texts`, roles y cajas `[ymin,xmin,ymax,xmax]` 0–1000, `subjects`, `scene`, `uncertain`, `needsRecreation`; `action:"verify-visual"` comprueba texto residual y visibilidad del producto. MCP real: `anuncio_analizar({image})` devuelve la extracción, no un anuncio terminado. `adaptacion_plan` sigue siendo un plan técnico, nunca prueba de adaptación publicitaria. No introducir claves en argumentos. `mcp/adapter-manifest.json` publica el contrato compartido.

EN · **Real advertisements, still images.** Entering Adapt analyzes the ad and extracts every advertising copy block, including accents, prices and conditions, plus product and scene. Copy is editable; uncertain OCR must be corrected/confirmed. There is no automatic translation or completion of illegible words. Editing copy or changing source invalidates drafts and approvals.

**Recomposition** separates photograph and copy: remove rasterized typography, verify the visual, then typeset complete copy with wrapping and safe margins. **Recreation** generates a new reference-based photograph when the ratio change exceeds 2, the ad is inside a billboard/screen, or the recomposed visual fails checks. A pan/crop is not recreation. AI can vary product details: review identity. Final words are drawn by the compositor, never by the image generator.

Tutorial: Content → Adapt → check Extracted copy → edit/Confirm complete copy when needed → Create advertisement on a card or Create advertisements for the batch → review each draft → **Approve piece** → download its PNG or Export MP4. Recreate again invalidates approval. Original remains alongside variants. Progress reports stages/completed formats. Cancellation/source changes discard late responses and never export the previous crop.

Preview, PNG and still MP4 share **one native canvas**. MP4 retains chosen 1–60 s duration, 25 fps and no audio. Generated visuals use contain even when the provider ignores the requested ratio. For a video wall, copy fits inside one physical screen while the visual occupies remaining space; atlas and segments use that canvas. Full copy that cannot fit at readable minimum size blocks export; no truncation or unlimited shrinking. Review is still required; visual checks do not certify exact identity, distance readability or real hardware.

Residual advertising text, missing product, uncertain OCR, provider error or timeout blocks the result. Existing authenticated providers may consume credits. Analyzing/creating drafts does not publish. Approved MP4 retains the existing Stock publisher; PNG downloads. Video/GIF retain earlier recipes: **no temporal video OCR in this release**. Authenticated `/image/analyze` returns the shared schema above. Actual MCP `anuncio_analizar({image})` extracts copy without rendering or publishing; `adaptacion_plan` remains a technical plan, not proof of an acceptable ad.

Los fallos visuales bloquean sólo la pieza afectada; el lote continúa con los demás formatos. Las descargas PNG también requieren aprobar la pieza. / Visual failures block only the affected piece; the batch continues with the remaining formats. PNG downloads also require approving the piece.

## Recrear con IA · Recreate with AI

Avanzados → Recrear con IA → Tratamiento de la imagen → Recrear · generar el espacio que falta. Revisa los elementos importantes detectados, añade los que deban conservarse y, si quieres, indica cómo ampliar la escena. Pulsa Recrear con IA en una tarjeta o en el lote. Se genera el fondo completo para ese formato y se recompone la copia original. El producto debe quedar fuera de la zona reservada al texto. Revisa el resultado → Aprobar pieza → PNG o MP4. Cambiar tratamiento, elementos o dirección invalida las piezas y aprobaciones. Adaptar sigue siendo la opción inicial; las recetas de vídeo/GIF se conservan.

Advanced → Recreate with AI → Image treatment → Recreate · generate missing surroundings. Review detected important elements, add anything else to preserve and optionally describe how to extend the scene. Click Recreate with AI on one card or the batch. A full scene is generated for that format and the original copy is typeset separately. Products must stay outside the reserved copy area. Review → Approve piece → PNG or MP4. Changing treatment, protected elements or direction invalidates pieces and approvals. Adapt remains the initial option; video/GIF recipes are preserved.

ES: Reconstruye las zonas ausentes mediante IA con el original como referencia de escena, perspectiva, luz y producto. No es DLSS ni prueba de detalle verdadero recuperado. La generación puede alterar identidades: revisar siempre. El texto nunca se delega a la imagen generativa; se dibuja completo y medido en el lienzo nativo. El fondo ocupa todo el formato, con panel translúcido para la copia. Con texto, el verificador devuelve cajas normalizadas de productos/logos/elementos solicitados; el servidor calcula si se solapan con el área reservada. Cajas ausentes, mal formadas o solapes bloquean la pieza. Se sigue exigiendo aprobar cada pieza. Sin texto no se añade un panel vacío. Cancelar invalida respuestas tardías.

EN: Reconstructs missing surroundings with AI using the original scene, perspective, lighting and product as reference. This is not DLSS or evidence of recovered true detail. Generation may alter identity: always review. Copy is never delegated to image generation; it is typeset completely and measured in the native canvas. The visual occupies the full format, with a translucent copy panel. For copy-bearing images, verification returns normalized product/logo/requested-element boxes; the server computes overlap with the reserved area. Missing/malformed boxes or overlap block the piece. Every piece still requires approval. Images without copy get no empty panel. Cancellation invalidates late responses.

Contract: editor treatment `adapt | reconstruct` (default `adapt`); generation action `reconstruct`; optional important elements and direction, each ≤1000 characters. `POST /image/analyze` action `verify-visual` accepts optional `reservedTextZone: {x,y,w,h}` in target pixels plus `target: {width,height}`. Returns `protectedSubjects: [{label,box:[ymin,xmin,ymax,xmax]}]` normalized 0..1000, and computed `compositionSafe`. Endpoint authentication unchanged. MCP `adaptacion_plan` documents this workflow but remains plan_only, rendered:false; it does not execute reconstruction.

### Recomposición alrededor de elementos / Reflow around elements

Si un elemento importante invade el área prevista, el editor busca otra zona libre y recompone allí el texto completo. Sólo bloquea si no queda espacio legible sin tapar esos elementos.

If an important element overlaps the planned copy area, the editor finds another free area and reflows all copy there. It blocks only when no readable space remains without covering those elements.

Coordinates from verification are mapped to the actual contained image in the native canvas before choosing a safe rectangle. Copy stays inside the designated physical screen for segmented walls. The final rectangle is checked against all returned protected boxes and measured copy; no fit means export remains blocked.

ES: Si la comprobación detecta vapor en un café frío, intenta corregirlo una sola vez dentro del mismo tiempo límite. Un segundo defecto queda bloqueado; se muestra el borrador rechazado con la causa, sin aprobación ni descarga. EN: If review detects steam above an iced drink, one bounded correction is attempted within the same deadline. A second failure remains blocked; the rejected draft and reason are shown without approval or download.


## Tipografía recreada · Recreated typography

ES: Analizar anuncio extrae también los rasgos tipográficos por bloque: familia visual (condensada, redondeada, sans, serif, manuscrita o monoespaciada), peso, color, alineación, espaciado, interlineado y contorno/sombra observados. Los cambios de color o tamaño separan bloques sin duplicar palabras. Se elige una fuente libre local semejante (Anton/Oswald, Fredoka, Montserrat, Libre Baskerville, Lobster o Roboto Mono), se carga antes de medir y se conserva la jerarquía del original. No se identifica ni garantiza la fuente exacta. Si falla la carga, se bloquea la creación: no se sustituye silenciosamente. En Recrear, la copia se integra sobre la fotografía completa con un borde de contraste cuando hace falta; no se añade el gran panel crema vacío. El ajuste mantiene palabras enteras: reduce la letra o busca otra zona libre antes de aceptar una columna estrecha. Si no caben con tamaño legible, bloquea la pieza. En Avanzados → Revisar tipografía y colores puedes corregir la familia visual, el color del texto y el contorno de cada bloque. El cambio invalida la pieza: genera de nuevo y aprueba tras revisar. La zona libre prioriza un titular legible; las imágenes sin texto no reservan rectángulos ficticios. Se incorpora la familia redondeada Fredoka. El texto diminuto del envase se conserva en el producto y no se duplica como titular. La comprobación visual bloquea costuras evidentes, horizontes duplicados y paneles arbitrarios. Los análisis nuevos exigen un estilo tipográfico completo por bloque mediante salida estructurada; si falta, se bloquean. Los documentos antiguos siguen siendo legibles. Un análisis antiguo sin estilos sigue siendo válido; pulsa Volver a analizar para extraerlos. Revisa la tipografía, el texto completo y el producto antes de aprobar cada pieza. Esto recrea la composición; no amplía un recorte del anuncio.

EN: Analyze advertisement also extracts observed typography per block: visual family (condensed, rounded, sans, serif, script or mono), weight, colour, alignment, tracking, line height and observed outline/shadow. Colour or size changes split blocks without repeating words. A similar self-hosted open font (Anton/Oswald, Fredoka, Montserrat, Libre Baskerville, Lobster or Roboto Mono) loads before measurement and preserves the source hierarchy. The exact original font is neither identified nor guaranteed. Loading failure blocks creation rather than silently substituting a font. Recreate integrates copy over the complete photograph with a contrast edge when needed, without a large empty cream panel. Layout keeps words intact: it shrinks type or finds another free zone before accepting a narrow column. If readable copy cannot fit, the piece is blocked. In Advanced → Review type and colours, correct each block’s visual family, text colour and outline colour. Changes invalidate the piece: generate again, review and approve. Free-space selection prioritizes readable headlines; text-free images do not reserve phantom rectangles. Rounded lettering uses Fredoka. Tiny package labels remain on the product rather than becoming duplicate headlines. Visual checks block obvious seams, duplicated horizons and arbitrary panels. New analyses require complete observed typography per block through structured output; missing styles block analysis. Legacy documents remain readable. Old analyses without styles remain valid; click Analyze again to extract them. Review typography, complete copy and product before approving each piece. The composition is recreated rather than enlarging a crop of the ad.

Contrato / Contract: optional `texts[].typography` in `pixeria.advertisement.v1`: `family` enum, `weight` 300–900, `color` hex RGB, `align` left/center/right, `italic` boolean, `trackingEm` -0.04–0.12, `lineHeight` 1–1.5, `outlineEm` 0–0.06, `outlineColor` hex RGB, `shadow` boolean. Families map only to the local allowlisted catalogue; arbitrary CSS/URLs are rejected. Source boxes set relative headline hierarchy. Full copy remains deterministic in the native preview/export canvas; output approval and protected-product geometry checks still apply. Self-hosted font files and OFL licences: `/adaptaciones/fonts/`; source https://github.com/google/fonts/tree/main/ofl.


## Ensayo de ocho recreaciones / Eight recreation examples

ES: Cuatro imágenes horizontales pasan a 1080×1920 y cuatro verticales a 1920×1080. [Comparar originales, recreaciones y descargar las dos tandas](https://www.pixeria.com/adaptaciones/ensayos/2026-10-08/). Revisión visual inicial; no implica aprobación comercial ni entrenamiento de pesos. Una referencia MS-DOS/OSX permanece bloqueada por análisis inválido y se sustituyó por latte.

EN: Four landscape images become 1080×1920 and four portrait images become 1920×1080. [Compare originals and recreations; download both sets](https://www.pixeria.com/adaptaciones/ensayos/2026-10-08/). Initial visual review, not campaign approval or model-weight training. One MS-DOS/OSX source remains blocked by invalid analysis and was replaced with latte.

Contract: optional `packageLabels[]` retains complete observed tiny copy wholly inside a detected package (area ≤15% of package box; legal copy stays separate). It remains in scene/product context and is not typeset as a duplicate external headline. Every extraction still validates its original style and boxes.


## Campañas por instalación / Installation campaigns

ES: `/campana` abre el taller Sneakers Store: elementos editables, tres direcciones, cinco mapas con juntas/puerta, revisión y exportación nativa por pantalla. Guardar/abrir JSON conserva el diseño y exige nueva revisión al importar.

EN: `/campaign` opens Sneakers Store workshop: editable elements, three directions, five maps with joints/doorway, review and native screen exports. Saved JSON preserves design and requires fresh review on import.

[Tutorial y contrato ES/EN · ES/EN tutorial and contract](/docs/campanas-instalacion.md). MCP real: `campana_instalacion` calcula planes, no render ni publicación / returns plans, no render or publication.

Creador / Creator: categoría independiente en `/creador/` y `/en/creador/` para campañas desde cero. Adaptador / Adapter conserva las imágenes y vídeos existentes o de terceros. Guía ES/EN: [Creador y Adaptador](campanas-instalacion.md).

## Clásico en el paso 1 / Classic in step 1

ES: Con una imagen fija cargada, el paso **1 Clásico** permite completar la adaptación sin salir: **Horizontal → vertical** abre el destino estándar 9:16 y **Vertical → horizontal**, el 16:9. Una imagen cuadrada ofrece ambas opciones. Al pulsar, se analiza el original y se genera el entorno que falta para el destino, sin cambiar el tratamiento de los formatos especiales. El original se conserva completo junto a un único resultado. El análisis de texto, su corrección y confirmación, la creación o recreación y la aprobación de la pieza usan el mismo flujo de imágenes. El PNG se descarga tras aprobar; la exportación MP4 usa la duración elegida. La dirección de recreación y la tipografía están en el desplegable del propio panel. Se muestra la resolución efectiva según Compatibilidad, conservando los ajustes y las selecciones de otros formatos.

El paso **2 Formatos especiales** conserva los tamaños propios del proyecto, videowalls y otros tamaños de la biblioteca, excluyendo los dos destinos clásicos 9:16 y 16:9 de esta vista para imágenes. Sin ficha se pueden usar los otros tamaños de la biblioteca; elige un proyecto con ficha para ver sus formatos propios. Cambiar de paso conserva la revisión y las piezas del mismo origen. Cambiar la fuente cancela las operaciones anteriores y descarta sus resultados. Los vídeos y GIF mantienen su motor de adaptación actual. El botón clásico utiliza la sesión de generación existente. Con una lectura segura, genera automáticamente un borrador y recompone íntegros los titulares, precios y condiciones con sus rasgos tipográficos observados, sin una confirmación intermedia. Si el texto es dudoso o se ha editado, se detiene y muestra el panel de corrección para confirmarlo antes de generar. **Sin texto publicitario** es una decisión explícita: reclasifica lo leído como marcas, rótulos o grafitis de la fotografía, conserva las etiquetas y retoma ese destino si sigue activo. Nunca se descarta texto automáticamente. El resultado exige aprobación manual antes de exportar y no certifica una entrega física. Las pequeñas diferencias de proporción del proveedor se ajustan proporcionalmente hasta el 2%; una proporción incompatible o un recorte de un producto detectado bloquea la pieza en lugar de añadir bandas. La IA puede alterar detalles; revisa siempre el producto.

**Elementos adicionales que conservar (opcional)** empieza vacío. El producto se protege automáticamente; añade solo otros elementos que quieras mantener, sin convertir todos los objetos o soportes detectados en instrucciones explícitas. Lo escrito se conserva al volver a analizar o cancelar y se borra al cambiar la fuente. Los sujetos detectados siguen formando parte del contexto del original. Si el ajuste falla por proporción o por recorte de un elemento protegido, se muestra el candidato real bloqueado, las dimensiones recibidas y de destino y, cuando está disponible, el elemento que provoca el bloqueo. Ese borrador no se puede aprobar ni exportar.

EN: With a loaded still image, **1 Classic** completes the adaptation in place: **Landscape → portrait** selects the standard 9:16 destination and **Portrait → landscape** selects 16:9. Square images offer both options. Clicking analyzes the original and generates the missing surroundings for the destination, without changing the treatment of special formats. The complete original stays beside one result. Copy analysis, correction and confirmation, creation or recreation, and approval use the same image workflow. PNG download becomes available after approval; MP4 export uses the chosen duration. Reconstruction direction and typography are available in the panel’s expandable section. The destination shows the effective Compatibility resolution and preserves settings and other format selections.

**2 Special formats** keeps project-specific sizes, segmented walls and additional library sizes, excluding the two classic 9:16 and 16:9 destinations from this view for images. Additional library sizes remain available without a project format file; choose a project with a file for its own sizes. Switching steps retains the review and pieces for the same source. Changing the source cancels earlier operations and discards their results. Videos and GIFs retain their current adaptation engine. The classic button uses the existing generation session. Safe OCR automatically creates a draft and recomposes the complete headlines, prices and conditions with their observed typography, without an intermediate confirmation. Uncertain or edited copy pauses the flow and brings the correction panel into view for confirmation before generation. **No advertising copy** is an explicit decision: it reclassifies detected text as product markings, signs or graffiti in the photograph, retains labels, and resumes that destination only if it is still active. Copy is never discarded automatically. Manual approval is required before export; physical delivery is not certified. Small provider ratio differences receive a proportional adjustment up to 2%; incompatible proportions or cropping of a detected product block the piece rather than adding padding. AI may alter details: always review the product.

**Additional elements to preserve (optional)** starts empty. The product is protected automatically; enter only other elements you want to retain, without turning every detected object or display carrier into an explicit instruction. Your input survives reanalysis and cancellation and clears when the source changes. Detected subjects remain part of the original context. If fitting fails because of an incompatible ratio or a protected element being cropped, the real blocked candidate appears with received and target dimensions and, when available, the element triggering the block. This draft cannot be approved or exported.
