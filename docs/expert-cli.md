# Consola web del modo experto

El botón Experto abre una entrada de 48 px dentro de la web. No necesita aplicación de escritorio ni instalación.

- Arrastra el borde superior para ajustar la altura (máximo: la mitad del área visible).
- Doble clic en el borde o el botón ▴/▾ pliega y despliega. El borde también admite flechas, Inicio, Fin y Enter.
- Cada entrada al modo experto comienza plegada. Al desplegar recupera la última altura arrastrada, guardada en `localStorage` (`pixeria_cli_height`; la réplica adapta el prefijo según marca.json). La preferencia es por navegador y dominio.
- La consola se superpone al contenido (Carlos, 3-oct-2026): es una franja fija abajo, con fondo y sombra, que no envuelve el documento ni le cambia altura, márgenes ni desplazamiento. Sube con el teclado del móvil (`--pf-cli-keyboard`). Cada página entra con ⌘ cerrado. Ver `docs/shell-cuadratico.md`, «Paneles superpuestos».
- Una orden muestra su resultado desplegando la consola. ↑/↓ recorre el historial de esta página.

Comandos: `help`, `clear`, `echo <texto>`, `date`, `status`, `version`, `history` y `open <sección>`. `help` enumera las secciones admitidas; las respuestas usan el idioma de la página. Son comandos de navegación e inspección de la web, no una shell del sistema operativo. No se ejecuta JavaScript introducido por el usuario.

`/marca <id|off|web>` (alias `/brand`; también sin barra) viste Pixeria con una marca blanca del catálogo de admiranext.com/marcablanca: `/marca lumbre` la aplica tras comprobarla en el catálogo, `/marca off` vuelve a Admira, `/marca` sola dice cuál está activa y lista las disponibles, y `/marca starbucks.es` abre el analizador (`https://www.admiranext.com/marcablanca/?web=<url>`) en otra pestaña. Los comandos admiten la barra inicial (`/help`). **Tab** completa el comando, los ids del catálogo (y `off`) tras `/marca` y las secciones tras `open`; con varias opciones las enseña en la consola. Ver `docs/marca-blanca.md`.

`assets/site-nav.js` carga el mismo componente en las tres familias de panel experto, con el mismo sello (`?v=`) que el propio `site-nav.js`. Los contenidos anteriores se conservan en la página. Admira Studio genera los mismos assets aplicando las sustituciones de su `marca.json`.

Prueba de navegador (servidor estático LOCAL):

```sh
python3 -m http.server 8463 --bind 127.0.0.1
PLAYWRIGHT_MODULE=/ruta/a/playwright node test/expert-cli.browser.cjs
```

La prueba simula únicamente la sesión del servidor local. Las comprobaciones y capturas de producción requieren una sesión Google autorizada real.

## Anonimizador demo · Anonymizer demo

ES: Abre https://www.pixeria.com/anonimizador. Se carga por defecto visitor-green-v1, una persona ficticia con original y ejemplos 8, 16 y 32 bits. No necesita cámara, subida, generación ni publicación en Stock. Descargar guarda cada variante. Usar mi foto abre el flujo anterior; Usar ejemplo recupera la demo. La transformación de una foto real no garantiza anonimización irreversible.

EN: Open https://www.pixeria.com/en/anonimizador.html. visitor-green-v1 loads by default: a fictional person with an original and 8, 16 and 32-bit examples. No camera, upload, generation or Stock publication is required. Download saves each variant. Use my photo opens the existing workflow; Use example restores the demo. Transforming a real photo does not guarantee irreversible anonymization.

Tutorial ES: 1. Compara las cuatro tarjetas. 2. Pulsa Enviar al Xpacio. 3. Abre https://www.xpaceos.com/admira-xp/ y entra en una tienda. 4. Activa /clientes on y elige Good, Better o Best. Se añade UN visitante: Good usa su sprite 8-bit; Better y Best interpretan su ficha de ropa, pelo y colores con sus modelos, no muestran una foto plana idéntica. Las imágenes 16/32 también viajan como recursos del personaje. La demo no incluye caminata Matrix/64-bit. La visibilidad inicial de la tienda sigue en OFF.

Tutorial EN: 1. Compare the four cards. 2. Click Send to Xpace. 3. Open https://www.xpaceos.com/admira-xp/ and enter a store. 4. Enable /customers on and choose Good, Better or Best. ONE visitor is added: Good uses its 8-bit sprite; Better and Best interpret its outfit/hair/palette profile using their models, rather than displaying an identical flat photo. The 16/32 images also travel as character assets. This demo does not include Matrix/64-bit walking. Store visibility still starts OFF.

MCP: https://mcp-pixeria.admira.store/mcp → anonymizer_demo {action:"info"} returns assets and instructions. {action:"send",screen:"optional-target"} requires the existing authenticated fleet key and queues the prepared visitor. {action:"status",id:"npc_..."} checks receipt. ES: No confundir queued con entrega. EN: queued is not delivery. consumed:true is the Xpace software acknowledgement, not proof of physical screen playback. Without a target the existing visitor queue is shared by open twins; provide screen when targeting one. Never announce arrival merely because send returned ok.

API: POST https://api.admira.store/twin/spawn with image (8-bit data URL), persona (fictional original), npc16, npc32 (PNG data URLs), demo_id:"visitor-green-v1", name and optional screen. GET /twin/persona?id=… returns demo, ready, style, npc16 and npc32. This allowlisted preset supplies the style without paid generation. /twin/spawn/status?id=… returns consumed. Existing personal-photo generation remains unchanged.

Assets: https://www.pixeria.com/assets/anonymizer-demo/{original.jpg,8-bit.png,16-bit.png,32-bit.png}. Artistic 8/16/32-bit labels describe visual style, not file color depth. Generated with imagegen from a fictional adult, dark wavy hair, forest-green cardigan, ivory T-shirt, charcoal trousers and white sneakers. Source prompt: front-facing full-body studio photo, neutral background, no logos. Variant prompts: same outfit and pose, transparent background; coarse chibi NES sprite, detailed SNES pixel sprite, early PlayStation low-poly 3D character respectively. Generation originals retained locally; optimized assets are checked into Pixeria.

## /marca y la vista por cliente

Una cuenta asignada a un cliente por la identidad central de AdmiraNeXT no cambia de cliente con `/marca`: la orden le dice a qué cliente está asignada. Con varios clientes, `/marca <cliente>` elige entre los suyos. Detalle en `docs/vista-por-cliente.md`.


## Orientación automática al importar / Automatic import orientation

ES: El importador mide cada imagen o vídeo y añade vertical + portrait cuando alto > ancho, u horizontal + landscape cuando ancho > alto. Vale para archivos locales, subidas por partes, vídeos importados por URL y la caja de importación del Adapter. Conserva las otras etiquetas; corrige las de orientación incompatibles. Cuadrados: cuadrado, sin portrait/landscape. Audio y metadatos ilegibles: sin clasificación automática de orientación. Reimportar el mismo contenido conserva identidad e historial y completa la orientación medida; no migra el catálogo entero.

EN: The importer measures each image or video and adds vertical + portrait when height > width, or horizontal + landscape when width > height. Covers local files, multipart uploads, URL-imported videos and the Adapter import box. Other tags stay; conflicting orientation tags are corrected. Square media: cuadrado, without portrait/landscape. Audio and unreadable metadata receive no automatic orientation. Reimporting identical content preserves identity and history and enriches measured orientation; the whole catalogue is not migrated.

Contrato / Contract: `POST https://api.admira.store/stock/publish`, `dimensions: {width, height}` (enteros positivos, máximo 65535). Se guarda como `ancho`, `alto`, `orientacion` y etiquetas en Stock. `validacion.ancho/alto` del máster tiene prioridad. La medición no es una validación de calidad y no genera `validacion.ok`. No requiere un comando CLI. / No CLI command required; measurement does not assert media quality.


## Campañas por instalación / Installation campaigns

ES: `/campana` abre el taller Sneakers Store: elementos editables, tres direcciones, cinco mapas con juntas/puerta, revisión y exportación nativa por pantalla. Guardar/abrir JSON conserva el diseño y exige nueva revisión al importar.

EN: `/campaign` opens Sneakers Store workshop: editable elements, three directions, five maps with joints/doorway, review and native screen exports. Saved JSON preserves design and requires fresh review on import.

[Tutorial y contrato ES/EN · ES/EN tutorial and contract](/docs/campanas-instalacion.md). MCP real: `campana_instalacion` calcula planes, no render ni publicación / returns plans, no render or publication.


## NEXT STEP

/demo en Creador o /demo sneakers abre /campanas/next-step/. /demo sneakers pausa|reiniciar|recorrer|parar. /demo in Creator or /demo sneakers opens /campanas/next-step/. /demo sneakers pause|restart|tour|stop. [Tutorial ES/EN](/docs/next-step.md). No hardware scheduling or draft/playlist writes.


## Demo Creador / Creator demo

/demo creador crea otra campaña Sneaker Xtore y muestra todos los pasos hasta el gemelo 360/3D. /demo creator makes a new Sneaker Xtore campaign and shows the full process. [Tutorial y contrato ES/EN](https://admira.studio/docs/demo-creador.md).

## Modo completo con IA

Escribe **`/demo creador todo`** (alias `/demo creator full`) o pulsa **Crear campaña completa con IA** en https://admira.studio/creador/?demo=creador&mode=full&lang=es . Cada petición explícita crea una identidad nueva y genera **una imagen original con Imagen 4** y **un vídeo nuevo de cinco segundos con Grok Imagine Video a partir de esa misma imagen**. Los originales se guardan en la biblioteca/Stock. Necesita la sesión existente de Studio/Pixeria y utiliza crédito de sus proveedores.

Brief → Concepto → Imagen + vídeo IA → Adaptación → Gemelo 360. Se muestran instrucciones IA, imagen recibida, estado real del proveedor, request_id y registro con horas. No se avanza por un porcentaje simulado: el vídeo sólo está listo cuando `archived:true` devuelve su URL de biblioteca. El gemelo sólo se anuncia aplicado después de cargar ambos medios y recibir `admira:creator-ready`.

La fotografía y el vídeo alternan en las composiciones de las siete instalaciones y trece pantallas. Texto independiente, maestro Jordan y hueco LED conservados. Los recortes PNG se exportan a dimensiones nativas. El MP4 original IA se puede abrir desde **Vídeo IA · 5 s**; este modo no exporta trece MP4 adaptados. Las adaptaciones animadas se reproducen en canvas dentro del gemelo 360/3D. No cambia playlists, programación ni emisión física.

`pausa`, `reanudar`, `estado`, `stop` y Escape controlan el recorrido. Una petición ya enviada puede terminar aunque se pause o detenga la demo. El historial recupera una campaña y sus resultados sin generar otra; recargar tampoco inicia otra generación. Los trabajos viven en IndexedDB `admira.creator-full`, registro de campañas en `admira.creator-demo.history.v1`, separados de borradores. Si se pierde la respuesta de un POST, se muestra `request-result-unknown` y no se repite automáticamente. Un request_id conocido permite reanudar consultas. **Nueva campaña con IA** solicita otra generación y otra semilla; no sustituye los medios de una anterior.

Contrato `admira.creator-full.v1`: semilla, prompts, modelos, IDs/URLs de imagen y vídeo, request_id, fases y eventos. El enlace 360 incorpora `creator=<seed>&mode=full&image=<stock_id>&video=<stock_id>`; medios ausentes o que no decodifican bloquean la aplicación. Las URLs aceptadas pertenecen a la biblioteca Admira, sin claves en URLs ni en contratos. El modo gratuito `/demo creador` conserva su composición local y su producto NEXT STEP reutilizado.

API web autenticada del mismo origen: POST `/creator-ai/image`, POST `/creator-ai/archive`, POST `/creator-ai/video`, GET `/creator-ai/status?request_id=…`. Verifica la sesión y firma un token corto en servidor con la identidad real de la sesión. Sólo admite estas acciones y parámetros limitados; no expone secretos de proveedor/flota. Reutiliza `/imagen/generate`, `/stock/publish` y `/xai/video` existentes.

MCP real: `creador_demo({mode:"full",language:"es"})` **planifica**, no genera ni abre navegador. Para agentes, ejecución explícita autenticada: `crear_imagen` → `creador_imagen_guardar` (data URL recibida, semilla y título) → `clip_desde_imagen` (stock_id recién devuelto) → `clip_estado` hasta `archived:true`. Ni el plan ni un request_id prueban generación completa o emisión física.

## Full AI mode

Run **`/demo creator full`** (alias `/demo creador todo`) or click **Create full campaign with AI** at https://admira.studio/creador/?demo=creador&mode=full&lang=en . Each explicit request creates a new identity and generates **one original Imagen 4 image** and **one new five-second Grok Imagine Video clip from that exact image**. Originals are archived in the library/Stock. Uses the existing Studio/Pixeria session and provider credit.

Brief → Concept → AI image + video → Adaptation → 360 twin. Prompts, received image, actual provider state, request_id and timestamped events are visible. Video completion requires `archived:true` and a library URL. Twin application is confirmed only after both media decode and the `admira:creator-ready` acknowledgement arrives.

The image and video alternate across seven shared compositions and thirteen screens, with independent copy, the Jordan master and LED doorway retained. Native PNG crops and the original five-second AI MP4 are available. Animated adaptations play in canvas in the 360/3D twin; this mode does not export thirteen adapted MP4s. Physical scheduling and playlists remain unchanged.

Pause/resume/status/stop and Escape control the walkthrough. Issued provider requests may continue while paused or stopped. History and reload recover results without generating again. Jobs use IndexedDB `admira.creator-full`, metadata uses separate demo history. Lost POST replies show `request-result-unknown` without automatic repetition; known request_id resumes polling. New AI campaign explicitly requests new assets and a new seed.

Contract `admira.creator-full.v1` includes seed, prompts, models, source asset IDs/URLs, request_id, phases and timestamped events. Twin links carry `creator=<seed>&mode=full&image=<stock_id>&video=<stock_id>`. Missing/undecodable media block application. Authenticated same-origin `/creator-ai/{image,archive,video,status}` reuses existing Imagen/Stock/xAI APIs, signing a short server token for the current session identity. Provider/fleet secrets never reach the browser or contract.

Real MCP `creador_demo({mode:"full",language:"en"})` is **plan only**. Explicit authenticated execution: `crear_imagen` → `creador_imagen_guardar` → `clip_desde_imagen` with the freshly returned stock_id → `clip_estado` until `archived:true`. A plan or request_id is not a completed render or physical delivery. Free `/demo creator` retains its local composition and reused NEXT STEP artwork.
