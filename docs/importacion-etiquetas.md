# Importación y etiquetas de búsqueda

En Stock → Importar URL, Vídeo aparece seleccionado por defecto; Audio permite pedir solo la pista de sonido. El formato elegido se conserva durante esa sesión del diálogo. Una fuente incompatible o no disponible muestra el error del proveedor, sin inventar un vídeo.

Comentarios admite lenguaje natural: `music top songs 1982`. Al publicar se combinan las etiquetas manuales, el título, los comentarios, la descripción si la fuente la aporta y hasta tres fotogramas reales del vídeo. Se normaliza `music` a `música`; años escritos como `1982` se conservan. Las importaciones admiten hasta24etiquetas de búsqueda, además de la orientación medida. Si no se pueden decodificar fotogramas o falla el clasificador, sigue disponible la inferencia de años y vocabulario musical del texto.

Es un muestreo visual, no análisis completo del vídeo ni reconocimiento de la pista sonora. La IA puede equivocarse: las etiquetas resultantes se pueden revisar y editar en Stock. La descripción solo se utiliza cuando la fuente la entrega; no se promete recuperar todas las descripciones de todas las plataformas.

La búsqueda combina palabras y equivalencias: `music 1982`, `música 1982` y `#musica #1982` encuentran la misma pieza sin exigir que esas palabras aparezcan juntas.

Las etiquetas inferidas son para buscar. Los destinos de emisión se guardan por separado: los hashtags que escribes en Comentarios o las etiquetas manuales de cliente/local/pantalla. Reconocer una marca dentro del vídeo no crea una dirección automática por hashtag. Las playlists y reglas configuradas explícitamente por etiquetas de contenido siguen usando esas etiquetas. Los destinos desconocidos siguen sin ampliar el reparto.

Reimportar un binario idéntico verificado en el servidor conserva ID, título, comentario editorial e historial. Enriquece las etiquetas de búsqueda y preserva el destino anterior, sin crear una copia ni reprogramar la pieza. Una simple pista de hash del cliente no permite modificar esos datos.
