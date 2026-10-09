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

[Taller, tutorial y contrato ES/EN](/docs/campanas-instalacion.md). Abrir Adaptador → Abrir taller Sneakers Store / Adapter → Open Sneakers Store workshop. MCP `campana_instalacion {campaign_json?,direction?}` valida y calcula planes; no renderiza ni publica / validates and plans; no render or publication. La CLI anterior sigue disponible / Existing CLI remains available.
