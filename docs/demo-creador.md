# Demo Creador · Sneaker Xtore / Creator demo

## Español

En Creador, pulsa **Demo Creador · campaña nueva** o escribe `/demo creador` en Experto. Desde Store abre el mismo recorrido de Studio. También puedes abrir https://admira.studio/creador/?demo=creador&lang=es . Cada ejecución crea una identidad y semilla nuevas, un concepto, titular, paleta y composición animada para Sneaker Xtore. El producto reutiliza la ilustración de NEXT STEP; no se presenta como una nueva fotografía o generación IA.

El recorrido visible avanza cada ocho segundos: **Brief → Concepto → Creatividades → Adaptación → Gemelo digital**. Cada paso se puede seleccionar directamente. Pausar detiene el reloj y el avance; Continuar los reanuda; Siguiente avanza un paso. El final espera la señal del gemelo antes de indicar campaña aplicada. Usa 360 o 3D para comparar la misma campaña, y Abrir gemelo completo para navegar por Entrada, Centro y Fondo.

Comandos: `/demo creador nueva`, `pausa`, `reanudar`, `siguiente`, `estado`, `stop`. Mientras está activo también `/demo pausa`, `/demo reanudar`, `/demo siguiente`, `/demo estado`, `/demo stop`. Escape detiene. Reiniciar crea otra campaña; volver a un paso conserva la misma. `/demo sneakers` y `/demo` en Creador conservan NEXT STEP; las cinco demos anteriores, la marca blanca y el historial CLI siguen disponibles.

**Adaptación** ofrece siete maestros y trece PNG a dimensiones nativas: LCD, Entrada, cinco Jordan, tres segmentos LED alrededor de la puerta, tira, columna e iPad. Se recortan del maestro de la pared; no se descarga un MP4 nuevo en este modo. Guardar contrato descarga JSON con semilla, procedencia, mapas, estado de los pasos y enlaces reproducibles. El movimiento es una composición canvas en el navegador y el gemelo; no un archivo de vídeo exportado.

El historial demo conserva las últimas treinta campañas en este navegador y origen, clave `admira.creator-demo.history.v1`, separado de los borradores de Creador, versiones del taller, Stock y playlists. El enlace con semilla reproduce esa campaña; `/demo creador` o Nueva campaña siempre crea otra. Si el navegador no permite guardar, descarga el contrato. Una campaña demo no equivale a aprobación de producción.

Contratos: `admira.creator-demo.v1`; semilla de 32 caracteres hexadecimales; `creator-core.mjs` y `creator-render.mjs` idénticos en Studio/Pixeria y Store. Gemelo: `https://www.admira.store/xpacios/sneakerstore/?creator=<seed>&lang=es&scene=entrada`; `view=jordan` abre 3D. La integración iframe confirma `admira:creator-ready` y acepta pausa/reanudar únicamente del iframe padre y orígenes Studio/Pixeria exactos, con la misma semilla. Detener retira el iframe; el gemelo libera sus recursos al salir.

MCP Pixeria real: https://mcp-pixeria.admira.store/mcp . `creador_demo({seed?,language?:"es"|"en"})` devuelve concepto reproducible, mapas, pasos, controles y enlaces; solo plan, sin render, historial remoto, lanzamiento del navegador, publicación o gasto. `demos_listar` conserva las cinco demos y añade Creador en `extra_demos`. `campana_instalacion` conserva su contrato de taller, distinto del contrato demo. MCP XpaceOS: https://mcp.admira.store/help?topic=demo-creador .

Demo local de composición, sin consultas de IA por ejecución, cobros, publicación Stock, programación física o cambios de playlists. Medidas especiales y proyección 360 aproximadas; verificar resoluciones, legibilidad y sincronización antes de instalación. Consejo consultado: Wozniak y Lucas aconsejaron conservar recorrido, controles e historial demo y distinguir ensayo de publicación.

## English

In Creator, choose **Creator demo · new campaign** or enter `/demo creator` in Expert. `/demo creador` is also accepted. Store opens the same Studio journey. https://admira.studio/creador/?demo=creador&lang=en . Every run creates a new identity and seed, concept, headline, palette and animated composition for Sneaker Xtore. The product reuses NEXT STEP artwork; this is not a new AI-generated product photo.

The visible journey advances every eight seconds: **Brief → Concept → Creatives → Adaptation → Digital twin**. Select any step directly. Pause freezes the clock and progression; Resume continues; Next moves one step. The final step waits for the twin acknowledgement before reporting the campaign applied. Compare the same campaign in 360 and 3D, or open the full twin to visit Entrance, Centre and Rear.

Commands: `/demo creator new|pause|resume|next|status|stop`. Spanish aliases work. While active, generic `/demo pause|resume|next|status|stop` controls this journey. Escape stops. Restart creates a new campaign; revisiting a step keeps the same one. Existing NEXT STEP, five Studio demos, white label and CLI history remain.

Adaptation offers seven masters and thirteen native PNGs: LCD, entrance, five Jordan panels, three rear LED segments around the door, strip, column and iPad. Panels are cropped from their common wall master. This mode does not export new MP4s. Save contract downloads JSON with seed, provenance, maps, shown steps and reproducible links. Live movement uses browser/twin canvas composition.

The separate `admira.creator-demo.history.v1` browser history keeps the latest thirty demos per origin. It preserves Creator drafts, workshop versions, Stock and playlists. A seeded URL reproduces the campaign; each command or New campaign creates another. Storage failure is reported; download the contract to retain the campaign. Demo previews do not imply production approval.

Shared contract `admira.creator-demo.v1`, 32 lowercase hexadecimal seed. Studio/Pixeria and Store share identical recipe/render modules. Twin URL uses `creator=<seed>`, `scene=entrada` for 360 or `view=jordan` for 3D. iframe ready/control messages verify exact origin, parent source and matching seed. Stop removes the iframe and releases its resources.

Real Pixeria MCP `creador_demo({seed?,language?:"es"|"en"})` returns a reproducible concept, maps, steps, controls and URLs: plan only, no render, remote history, browser launch, publication or spend. `demos_listar` retains the five demos and lists Creator under `extra_demos`. Existing `campana_instalacion` workshop contract remains separate. XpaceOS public help: https://mcp.admira.store/help?topic=demo-creador .

Local demo composition; no per-run AI calls, charges, Stock publication, physical scheduling or playlist changes. Special geometry and 360 projection are approximate. Check resolutions, legibility and playback synchronisation before physical use. Council consultation: Wozniak and Lucas advised preserving the journey, controls and demo history, with clear rehearsal/publication evidence.

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
