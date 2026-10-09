# Cinco subdemos preparadas para Neo

Pack de Admira Studio / Pixeria, contrato **version 1** acordado con Neo por MCP (#5301 y #5303). Está preparado para incorporar; no se ha publicado en la web ni sustituye el editor de Neo.

| Orden | Clave del editor | Contenido | Resultado del ensayo |
|---|---|---|---|
| a | `studio/voz` | Guion, idioma español, voz cercana y reproducción | Locución castellana propia, creada con TTS gratuito |
| b | `studio/musica` | Ambiente, estilo blues y formato instrumental | Música de cafetería del Stock, 30.77 s |
| c | `studio/imagen` | Producto, escenario, luz y prompt | Creatividad de café del Stock, JPEG 1280×720 |
| d | `studio/video` | Imagen de entrada, movimiento, creación y espera | Vídeo IA de café del Stock, 8.04 s; el flujo opcional nuevo crea 5 s |
| e | `studio/adaptar` | Fuente, elección de formatos, encuadre y exportación | Cuatro MP4 exportados localmente y medidos: 1920×1080, 1080×1920, 1080×1080, 1920×540 |

Un minuto por subdemo; cinco minutos para el recorrido completo. El caso común es una cafetería ficticia, con muestras identificadas como preparadas. Las piezas reutilizadas no se atribuyen a una generación nueva ni a un prompt que no las produjo.

## Ficheros para incorporar

- `demo/studio.subdemos.json`: catálogo versionado `{version:1, plataforma:"studio", subdemos:[...]}`. IDs `voz`, `musica`, `imagen`, `video`, `adaptar`; letras a–e. `url`, `muestra.url` y `variantes[].url` son HTTPS absolutos. Variantes `{formato:"1080x1920",url,...}`.
- `demo/studio-v1/`: las cinco subdemos por separado, para revisar o versionar individualmente.
- `demo/studio-guion.html`: guion compatible con el motor anterior `[data-demo]` y acciones `di`, `espera`, `escribe`, `elige`, `señala`, `clic`. No incorpora ni sustituye el motor.
- `demo/studio-seleccion.subdemos.json`: selección importable `{proyectos:[...]}` con las cinco claves. Importar **después** de que el editor haya cargado el catálogo; la importación actual solo mueve selecciones.
- `demo/studio-preview.html`: revisión local de las cinco muestras y sus guiones.
- `assets/demos/studio-v1/`: ocho piezas multimedia locales, cinco imágenes de portada y metadatos con procedencia, medidas y hashes SHA-256.
- `_headers`: CORS público para el manifest y estos medios, para lectura desde el editor de admiranext.com. No contiene credenciales ni modifica la autenticación de las APIs.

El manifest apunta a URLs finales de admira.studio. Esas URLs nuevas estarán disponibles **al incorporar y publicar el pack**. Para el espejo pixeria.com, Neo puede reemplazar el origen por `https://www.pixeria.com`; los paths son idénticos. La preview local resuelve esos paths contra el servidor local, sin depender de que estén publicados.

## Activación en Experto y avatar

Ambas entradas deben enviar el texto al mismo resolvedor, usando la plataforma del host actual. `admira.studio`, `www.admira.studio`, `pixeria.com` y `www.pixeria.com` comparten la plataforma `studio`. Los números son locales a esa plataforma, no índices del catálogo global de la suite.

| Número | Comando por nombre | Clave |
|---|---|---|
| `/demo 1` | `/demo locucion` | `studio/voz` |
| `/demo 2` | `/demo musica` | `studio/musica` |
| `/demo 3` | `/demo imagen` | `studio/imagen` |
| `/demo 4` | `/demo video` | `studio/video` |
| `/demo 5` | `/demo adaptar` | `studio/adaptar` |

`/demo help` lista estas cinco demos, sus números y nombres. `/demo` sin argumento muestra la misma ayuda. Se aceptan mayúsculas, espacios exteriores y tildes (`locución`, `música`, `vídeo`); `voz`, `formatos` y `adaptacion` son aliases adicionales. Una entrada desconocida indica `/demo help` y no inicia otra demo.

`activacion` y `aliases` del manifest contienen este contrato. `demo/studio-comandos.mjs` exporta `resolverDemo(texto, manifest, hostname)`: devuelve ayuda, la clave y el objeto de subdemo, o una entrada desconocida/otra plataforma. Es un módulo de referencia preparado para integrar; no está conectado todavía a la consola o al avatar de producción. El motor de Neo puede reutilizarlo o mantener un resolvedor común equivalente. En otros hosts, cada plataforma aporta su propio catálogo y numeración.

Al incorporar el manifest, conservar `steps`, `muestra`, `guion` y `muestra.variantes` como objetos y listas; no convertirlos a cadenas. El resolvedor selecciona una muestra, no ejecuta `ejecucion_real_opcional`.

## Ejecución del editor

Usar `muestra` para el ensayo. `steps` opcionales solo consultan muestras ya existentes o calculan un plan técnico; la locución propia ya está en el pack y no requiere llamada MCP. La muestra de adaptación del pack contiene cuatro exportaciones exactas; las muestras genéricas del MCP contienen una pareja 365 anterior con proporciones nominales y no deben reemplazar estos cuatro archivos.

`ejecucion_real_opcional` guarda los ejemplos para explicar o hacer una creación real a petición. **No ejecutarlo al importar ni al reproducir el ensayo.** Música/imagen/vídeo pueden consumir crédito; el vídeo es asíncrono con `request_id` y `clip_estado`, y su flujo existente archiva el resultado en la biblioteca. La exportación MP4 de la interfaz `/adaptaciones/` también guarda archivos en Stock: el ensayo solo señala `#export-all` y reproduce las exportaciones locales preparadas. El único clic del guion abre la elección de formatos (`#btn-adaptar`).

El motor anterior no sabe renderizar los medios de `muestra`: Neo debe incorporarlos a su panel de resultados. El HTML conserva las acciones existentes; no inventa una acción MCP sin soporte.

## Verificación y reproducción

```sh
python3 scripts/verificar-studio-subdemos.py
node scripts/verificar-studio-comandos.mjs
python3 -m http.server 8769 --bind 127.0.0.1
# Abrir http://127.0.0.1:8769/demo/studio-preview.html
```

El verificador comprueba contrato, orden, campos/selecciones actuales, rutas, pasos sin gasto, CORS, códecs, medidas exactas y hashes de las variantes. Las ocho piezas se midieron con ffprobe. La preview se comprueba en escritorio y móvil, con metadatos de audio/vídeo disponibles y sin errores JavaScript.

`scripts/preparar-studio-formatos.py` reproduce las cuatro exportaciones desde `video-fuente.mp4`, sin proveedor de IA. Preserva audio AAC, H.264, yuv420p, 30 fps y píxeles cuadrados. Vertical y cuadrado recortan al centro; la barra contiene la imagen completa con bandas laterales. El original es 1280×720: el escalado a 1920 no crea detalle nuevo. Si se regeneran ficheros con otra versión de ffmpeg, revisar hashes y refrescar los metadatos del manifest.


## Campañas por instalación / Installation campaigns

[Taller, tutorial y contrato ES/EN](/docs/campanas-instalacion.md). Abrir Creador → Ejemplo Sneakers Store / Adapter → Open Sneakers Store workshop. MCP `campana_instalacion {campaign_json?,direction?}` valida y calcula planes; no renderiza ni publica / validates and plans; no render or publication. La CLI anterior sigue disponible / Existing CLI remains available.


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
