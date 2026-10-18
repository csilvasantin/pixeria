# Adaptar y recrear dentro del Creativo

Comandos del modo Experto y de `/admirito creativo`:

- `/adaptar imagen horizontal`
- `/adaptar imagen vertical`
- `/adaptar video horizontal`
- `/adaptar video vertical`
- `/recrear imagen horizontal`
- `/recrear imagen vertical`

Enter o ↑ prepara la acción; el botón Adaptar o Recrear con IA inicia el trabajo. El panel Detalle permite elegir Archivo, originales guardados en este navegador o Stock. Por defecto se propone el original guardado más reciente o una importación posterior del tipo solicitado. Se muestra siempre su nombre, medidas y destino. Horizontal es 1920 × 1080 (16:9); vertical es 1080 × 1920 (9:16).

## Adaptar

Mantiene completo el original, centrado, sin recortarlo ni estirarlo. Rellena el espacio restante con una copia ampliada, difuminada y oscurecida. PNG para imágenes; MP4 H.264/AAC para vídeo, con su audio y duración originales. Reutiliza la geometría y el motor FFmpeg en un Web Worker del Adaptador. No llama a IA ni consume créditos de generación.

Imágenes fijas PNG, JPEG, WebP o AVIF; vídeos MP4, MOV o WebM. Límite 100 MB, 64 megapíxeles y 3 minutos por vídeo; se rechaza un original incompatible antes de procesarlo. No se usa el límite de tamaño de FFmpeg para truncar silenciosamente el vídeo.

## Recrear imagen

Solo imagen fija. Amplía el entorno que falta con Gemini 2.5 Flash Image mediante el endpoint de edición ya existente (`/image/edit`), con autenticación de sesión. El panel identifica el motor y una imagen de pago; el servicio no ofrece cotización exacta. Se inicia exclusivamente con Recrear con IA. Si el original ya tiene la proporción de destino, no se habilita esa generación.

La referencia es un lienzo al tamaño de destino, con el original en su posición exacta y márgenes grises a completar. Se envía la proporción 16:9 o 9:16 y una instrucción para continuar perspectiva, luz, texturas y colores. Se rechazan respuestas sin imagen o con una proporción incompatible. Se superpone después el original intacto, conservando sus textos y detalles. La continuidad del entorno generado debe revisarse visualmente antes de Guardar en Stock; no se promete identidad perfecta de las zonas inventadas. No hay recreación de vídeo ni generación de música en estos comandos.

## Guardado y repetición

IndexedDB `admira-creativo-transforms` conserva el original y el resultado como blobs independientes. SHA-256 de los bytes + acción + tipo + orientación identifica el trabajo; renombrar un archivo no duplica la operación. La transición atómica prepared → rendering evita dos envíos desde pestañas simultáneas. Recargar recupera el resultado; un envío pagado ambiguo queda bloqueado y no se reintenta automáticamente. La persistencia pertenece a este navegador y origen, no a otros dispositivos ni a navegación privada.

Guardar en Stock es explícito después de revisar. Publicación reclamada atómicamente, externalRef estable, etiquetas del origen/cliente y salida separada; recargar no duplica Stock. Si se pierde su respuesta, se conserva la descarga local sin repetir POST. Los encargos de voz/música y las importaciones tienen almacenes independientes.

## Verificación

Pruebas de comandos, encaje en ambas orientaciones, audio/duración, exclusión atómica, respuesta ambigua y publicación única. Prueba real de Chrome: PNG y MP4 H.264 horizontal de un original vertical con sonido, dimensiones, bordes originales y recuperación de blobs. La prueba de superposición de IA usa un fondo simulado; no acredita una generación pagada real.
