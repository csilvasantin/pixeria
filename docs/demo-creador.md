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
