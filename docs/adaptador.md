# Adaptador y Pixie

Base #4905 · FLT-101368. Mejora de exportación y persistencia: misión Yokup #223. Publicación autorizada por Carlos el 3-oct-2026; release v.03.10.2026.r5.22:23.

Vídeo incluye el compositor de TikToks. Adaptador ocupa su anterior entrada de navegación. La ruta `/adaptaciones/` se conserva para enlaces existentes. `/en/adaptaciones/` contiene la interfaz inglesa; la ruta raíz usa español en admira.studio y dirige a inglés en pixeria.com y previews de Pages.

Elige un vídeo del índice Stock o súbelo desde tu equipo. También puedes abrir el creador de Vídeo. Selecciona formatos estándar (9:16, 16:9, 1:1, 4:5) o el perfil Altadis. Ajusta recorte, contener o expansión con fondo desenfocado, foco y zoom. Cada tarjeta muestra resolución, uso, pérdida efectiva del encuadre y una receta H.264 plegable.

El perfil Altadis contiene las 18 filas no marcadas ESPECIAL de la página 3 de «ALTADIS Resoluciones y formatos», incluyendo Shuttle Stretch (SEDE). Fuente recuperada del archivo «Resoluciones y formatos especiales .pdf» aportado por Carlos en Telegram Desktop del MacMini. SHA-256 y filas transcritas: `adaptaciones/altadis-18.json`. Mantiene las resoluciones nativas, H.264/MP4 y 25 fps. Los cinco layouts especiales segmentados no se presentan como formatos estándar: tienen su propia familia, descrita en «Especiales Altadis». Sincro VW y LOGO requieren duración coincidente; no se sincronizan players desde esta página.

La cuadrícula previsualiza los ajustes con canvas. “Exportar MP4” en una tarjeta genera esa variante; “Exportar formatos seleccionados” las procesa secuencialmente. Al acabar aparecen enlaces de descarga individuales. Los MP4 se codifican en el navegador con FFmpeg WASM, H.264 y audio AAC cuando el origen tiene audio. La expansión repite y desenfoca el propio vídeo, sin IA generativa. Foco, zoom y recorte se calculan en el mismo módulo que el encoder; puede haber pequeñas diferencias de desenfoque. El plan muestra la orden usada; bitrate y FPS de entrada son estimaciones. Los renders JTI listos son archivos reales previamente publicados en Stock, incluyendo 1:1 H.264 1080×1080 y 4:5 H.264 1080×1350, contrastados con ffprobe. No se regeneran al mover los controles. Vídeos remotos pueden fallar por CORS, retirada del asset o incompatibilidad del navegador; la subida local sigue disponible.

Pixie es una ilustración SVG local con animación CSS, sin modelos ni API de pago. Se invoca desde Experto con `/avatarDigital on` (o `/digitalAvatar on`) y se oculta con `off` o ×. Cada navegación empieza oculta; no restaura preferencias antiguas. Es una guía local con texto de ayuda, sin conversación IA ni acceso a micrófono. Respeta reducir movimiento.

El minitutorial se genera con ADmira Motion en el generador oficial admiranext.com/tiktok. Es una guía animada, no una grabación real de pantalla. El vídeo exportado y las capturas se vinculan al informe de Yokup tras verificarlos.

La preview incluye un paquete de revisión explícitamente público en `/review/4905/en/adaptaciones/` y `/review/4905/es/adaptaciones/`, con Vídeo en el mismo directorio. Se genera únicamente en un archivo temporal con `scripts/preview-4905.py`; no modifica la verja, los callbacks ni las rutas existentes. Los assets y la muestra ya son públicos. Esto permite revisar los cambios aunque el callback Google existente regrese a producción y rechace la sesión de preview.

## Exportación y ajustes guardados · misión #223

Los ajustes se guardan automáticamente en localStorage, separados por ID de formato: método, foco X/Y, zoom, selección, compatibilidad y familia estándar/Altadis. Se restauran después de cargar los 18 formatos. Cambiar de familia conserva sus ajustes y selecciones. “Restablecer ajustes” vuelve al perfil estándar. No se guardan archivos ni URLs blob: al recargar hay que volver a elegir el archivo local. Al navegar con BFCache la fuente conservada sigue disponible. Si el almacenamiento está bloqueado se avisa y el editor sigue funcionando.

El origen tiene un límite de 100 MiB. El encoder single-thread descarga bajo demanda unos 32 MB de @ffmpeg/core 0.12.10 desde jsDelivr; el wrapper MIT @ffmpeg/ffmpeg 0.12.15 está fijado y alojado en el repositorio. El vídeo local no se envía a ese CDN. Para impedir intermediarios enormes en pantallas panorámicas, cover y blur recortan el origen antes de escalar. El presupuesto estimado admite 96 MiB por variante y 192 MiB por lote; si se excede, se pide un clip más corto, menor perfil o menos formatos. Hay además un tope real de 128 MiB por salida y se rechazan resultados desde 124 MiB para no ofrecer archivos truncados. Son límites de esta versión local, no garantías de consumo de RAM.

Durante el trabajo se congelan fuente y controles; Cancelar interrumpe descarga/worker y conserva variantes terminadas. Las descargas duran mientras siga abierta la página y se reemplazan al iniciar otra exportación o cambiar la fuente. Las fuentes Stock necesitan permiso CORS. Rendimiento 4K y vídeos largos dependen del equipo; no se acredita compatibilidad uniforme con Safari o móviles. No hay edición por capas, texto independiente, expansión IA ni sincronización de players.

Validación: cuatro pruebas Node, incluida FFmpeg nativa para cover/contain/blur con y sin audio; prueba IAB de los cuatro formatos estándar con fuente de 2 s, descarga y ffprobe (resolución, H.264/AAC, 25 fps y duración); persistencia tras recarga y cancelación verificadas en la interfaz. La batería signage tiene una aserción previa obsoleta de cache-busting (`20260902-r3`) frente a la versión sellada actual; no se modifica el Tester en esta entrega. Revisión cruzada aprobada para PR.

Minitutorial oficial: `docs/media/minitutorial-adaptador-exportacion.mp4`, plan en el JSON contiguo. ADmira Motion, 1080×1920, unos 15 segundos: es una guía animada preparada durante la revisión del Adaptador, no una grabación de pantalla. Incluye ubicación, ajuste, exportación, guardado y límites. Audio de base, sin locución humana. Se verifican los tres momentos del vídeo y su contenedor antes de vincularlo a Yokup.

Publicación: misión Yokup #233. Se conserva el tutorial exportado y verificado en la revisión. El intento de actualizar su portada desde el generador oficial anunció descarga, pero no se pudo recuperar un archivo nuevo en esta sesión; el guion actualizado se conserva y el informe de publicación declara esa limitación. El vídeo enlazado corresponde a la exportación real anterior, con la etiqueta «en revisión».

## Biblioteca de tamaños · misión Yokup #238

El panel **Tamaños** permite buscar por nombre o medidas (`300 × 250`, `300x250`), filtrar orientación y marcar tamaños por categoría: redes, digital, display e impresión. Buscar o filtrar no modifica la selección. Las campañas añaden 8 tamaños sociales, 23 display (incluidos tres banners móviles y tres regionales de Polonia) o 3 móviles a la selección existente. Se pueden quitar tamaños desde su tarjeta o quitar todos. Los perfiles Biblioteca y Altadis conservan sus selecciones y ajustes al alternar.

Los presets con medidas mantienen dimensiones nativas; la compatibilidad de reproducción regula los cuatro formatos de proporción originales. Los tamaños propios se añaden en Digital: medidas pares 64–3840 px, máximo 8,3 Mpx y 12 presets guardados por navegador. La selección, medidas propias, foco, zoom y método sobreviven a la recarga; el archivo local debe elegirse otra vez.

Redes y digital exportan MP4. Display e impresión exportan PNG del fotograma actual, con el mismo reencuadre del previo; pausa para elegir el fotograma. Impresión incluye densidad PNG de 150 ppp, RGB, sin sangrado, CMYK ni PDF de imprenta. No hay remaquetación de textos/capas, áreas seguras automáticas, traducción ni generación IA. No se garantiza aceptación por las redes publicitarias: los presets son medidas de referencia. Display avisa si el PNG supera 150 KB; el usuario debe revisar las condiciones de su destino. Referencia display: [Google Ads, tamaños y restricciones](https://support.google.com/google-ads/answer/1722096).

Verificación: ocho pruebas con FFmpeg real, catálogo, búsqueda, validación de preferencias/custom y pHYs/CRC de PNG a150ppp. En el navegador se verificaron campañas, filtro sin perder selección, PNG300×250 y A41240×1754 generados, custom500×500 persistente y MP4 generado, cambio Altadis18↔Biblioteca3. La automatización del navegador integrado no permitió recuperar nuevas descargas; no se afirma haber inspeccionado nuevos archivos PNG/MP4 del navegador. Las pruebas del encoder y la metadata PNG se verificaron por separado.

Minitutorial creado en el generador oficial de [ADmiraNeXT](https://www.admiranext.com/tiktok/). Es una guía animada, no una grabación de pantalla. El MP4 exportado fue recuperado y verificado con ffprobe (H264/AAC, 1080×1920, 15.139s) y tres fotogramas a2,6,12segundos. Vídeo: [minitutorial-adaptador-tamanos.mp4](media/minitutorial-adaptador-tamanos.mp4). SHA256 8ca9f62050fba84bf9bd545542f5f0fcd6eeff4d3ecb9cd6f7c167976dfa935e. Guion y parámetros conservados en [minitutorial-adaptador-tamanos-plan.json](media/minitutorial-adaptador-tamanos-plan.json), con ubicación, uso, resultado y límites. El tutorial anterior corresponde a exportación MP4, no documenta la nueva biblioteca.

## Especiales Altadis

Tercera familia del selector «Perfil de formatos», junto a Biblioteca y Altadis 18, en español y en inglés. Contiene las 5 filas marcadas ESPECIAL en la página 3 del mismo PDF (SHA-256 `16a17b2f…5239f7`). Están transcritas en `adaptaciones/altadis-especiales.json`. La geometría y los trabajos FFmpeg están en `adaptaciones/especiales-core.mjs`.

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
- «Mismo tiempo de resolución para la correcta sincronización» se refiere a Sincro VW y Sincro LOGO, que siguen en Altadis 18. Ningún especial es un LOGO con pieza independiente.

Funcionamiento: el reencuadre existente (recorte, contener, expandir con fondo desenfocado, foco y zoom) se aplica a la **pared física**, es decir, a todas las pantallas una al lado de otra. La previsualización muestra la pared con líneas de corte y números, y la entrega con cada celda numerada y las sobrantes tachadas. FFmpeg remuestrea a 25 fps con `fps=25`, compone la pared una sola vez, la divide y recorta cada pantalla del mismo maestro:
- **Exportar entrega**: 1 MP4 a la resolución de la tabla, como pide el PDF. Usa H.264 del perfil 4K de Altadis, GOP de 1 s, celdas sobrantes en negro y audio AAC si el origen lo tiene. Nombre: `<layout>-entrega-<ancho>x<alto>.mp4`.
- **Exportar por pantalla**: N MP4 en una sola pasada, sin audio, a 25 fps y con el mismo número de fotogramas. Usa H.264 nivel 4.0 y la parte proporcional, por píxeles, del bitrate de la entrega. Nombre: `<layout>-<n>de<N>-<ancho>x<alto>.mp4`.

Se reutilizan el exportador WASM y los límites existentes: 100 MiB de origen, presupuesto de 96/192 MiB, tope de 128 MiB por salida y rechazo a partir de 124 MiB. Los ajustes se guardan por id de layout, como en las otras familias, y alternar familias conserva sus selecciones.

Límites: esta página no sincroniza players. La imagen solo continúa entre pantallas si arrancan a la vez y en bucle juntos. Las paredes largas (CORDOBA-098, 14400 px) componen un fotograma intermedio grande y pueden tardar en navegadores modestos. Con `-preset ultrafast`, ffprobe identifica el H.264 como «Constrained Baseline», igual que en el resto del Adaptador. No hay biseles ni huecos entre pantallas, porque el PDF no los da.

Verificación: `test/adapter-especiales.test.mjs` cubre el catálogo y el SHA (también contra el PDF local si existe); la geometría (las celdas cubren la entrega y las pantallas cubren la pared sin solapes ni huecos); los nombres; la persistencia y el filtro por familia; y los trabajos. Con `ADAPTER_FFMPEG_TEST=1`, FFmpeg nativo convierte un maestro de 2 s en N pantallas: ffprobe confirma resolución, H.264, 25/1, 50 fotogramas y duración idéntica, además de la entrega con AAC. En Chrome se exportaron 5 MP4 de 640×360 y la entrega de 1280×1080 de VW 5x1 H con FFmpeg WASM. ffprobe dio 50 fotogramas y 2,000 s en cada pantalla, y apilar las 5 pantallas reconstruye la pared continua.
