# Adaptar y recrear dentro del Creativo

Comandos del modo Experto y de `/admirito creativo`:

- `/adaptar imagen horizontal`
- `/adaptar imagen vertical`
- `/adaptar video horizontal`
- `/adaptar video vertical`
- `/recrear imagen horizontal`
- `/recrear imagen vertical`
- `/recrear video horizontal`
- `/recrear video vertical`

Enter o ↑ prepara la acción; el botón Adaptar o Recrear con IA inicia el trabajo. El panel Detalle permite elegir Archivo, originales guardados en este navegador o Stock. Por defecto se propone el original guardado más reciente o una importación posterior del tipo solicitado. Se muestra siempre su nombre, medidas y destino. Las dos vistas indican su resolucion en pixeles (por ejemplo, Original 1080 x 1920 px y Resultado 1920 x 1080 px), tambien durante la vista previa y tras recuperar el resultado. Horizontal es 1920 × 1080 (16:9); vertical es 1080 × 1920 (9:16).

## Adaptar

Mantiene completo el original, centrado, sin recortarlo ni estirarlo. Rellena el espacio restante con una copia ampliada, difuminada y oscurecida. PNG para imágenes; MP4 H.264/AAC para vídeo, con su audio y duración originales. Reutiliza la geometría y el motor FFmpeg en un Web Worker del Adaptador. No llama a IA ni consume créditos de generación.

Imágenes fijas PNG, JPEG, WebP o AVIF; vídeos MP4, MOV o WebM. Límite 100 MB, 64 megapíxeles y 3 minutos por vídeo; se rechaza un original incompatible antes de procesarlo. No se usa el límite de tamaño de FFmpeg para truncar silenciosamente el vídeo.

## Recrear con IA

Imagen fija o fondo fijo para vídeo. Amplía el entorno que falta con Gemini 2.5 Flash Image mediante el endpoint de edición ya existente (`/image/edit`), con autenticación de sesión. El panel identifica el motor y una imagen de pago; el servicio no ofrece cotización exacta. Se inicia exclusivamente con Recrear con IA. Si el original ya tiene la proporción de destino, no se habilita esa generación.

La referencia es un lienzo al tamaño de destino, con el original en su posición exacta y márgenes grises a completar. Se envía la proporción 16:9 o 9:16 y una instrucción para continuar perspectiva, luz, texturas y colores. Se rechazan respuestas sin imagen o con una proporción incompatible. Se superpone después el original intacto, conservando sus textos y detalles. La continuidad del entorno generado debe revisarse visualmente antes de Guardar en Stock; no se promete identidad perfecta de las zonas inventadas. En vídeo se toma un fotograma a 1 segundo (o a la mitad si dura menos de 2 segundos), se amplía el entorno con IA y se monta como fondo fijo detrás del vídeo original completo, con su audio y duración. No es ampliación temporal de cada fotograma ni genera movimiento nuevo en los márgenes; la interfaz lo explica junto al botón antes de consumir crédito. No hay generación de música en estos comandos.

## Guardado y repetición

IndexedDB `admira-creativo-transforms` conserva el original y el resultado como blobs independientes. SHA-256 de los bytes + acción + tipo + orientación identifica el trabajo; renombrar un archivo no duplica la operación. La transición atómica prepared → rendering evita dos envíos desde pestañas simultáneas. Recargar recupera el resultado; un envío pagado ambiguo queda bloqueado y no se reintenta automáticamente. La persistencia pertenece a este navegador y origen, no a otros dispositivos ni a navegación privada.

A la izquierda aparece el original y a la derecha una composición en directo desde que se elige. En vídeo la vista previa reproduce el original silenciado y pinta el mismo encaje a resolución reducida (360 px) mientras FFmpeg exporta aparte. No muestra fragmentos ya codificados: se identifica como Vista previa y el avance indica Exportando vídeo. Al terminar la derecha se sustituye por el MP4 real, con audio; ambas vistas siguen el tiempo de reproducción del resultado.

Guardar en Stock es explícito después de revisar. A su derecha, Recrear con IA parte de la fuente original, no del archivo difuminado, y comienza la generación tras mostrar motor y consumo junto al botón. Volver a pulsarlo para el mismo original, acción y orientación recupera el trabajo existente. El fondo IA se guarda como un blob separado antes de montar el vídeo; si falla la codificación, Reanudar montaje reutiliza ese fondo sin repetir la llamada pagada. Publicación reclamada atómicamente, externalRef estable, etiquetas del origen/cliente y salida separada; recargar no duplica Stock. Si se pierde su respuesta, se conserva la descarga local sin repetir POST. Los encargos de voz/música y las importaciones tienen almacenes independientes.

## Verificación

Pruebas de los ocho comandos, encaje en ambas orientaciones, audio/duración, exclusión atómica, respuesta ambigua, publicación única y recuperación de montaje con el mismo fondo IA. Prueba real de Chrome: PNG y MP4 H.264 horizontal de un original vertical con sonido, dimensiones, bordes originales y recuperación de blobs. La prueba de superposición de IA usa un fondo simulado; no acredita una generación pagada real.
