# Etiquetas al importar y al crear

Carlos, 7-oct-2026: «añade un campo de etiquetas al importar y al crear». Antes las etiquetas sólo se podían poner
después, desde el Stock; al importar había un comentario y al crear con IA no se enviaba ninguna.

## Dónde está

- **Importar** (ventana «Importar desde URL» / «Archivos locales → Stock»): campo **Etiquetas** bajo «Comentarios». Vale
  para la importación por URL y para los ficheros locales. Se vacía cada vez que se abre la ventana: las etiquetas no se
  arrastran de una importación a la siguiente.
- **Crear** (locución, música, imagen, vídeo y comparadores): campo de etiquetas justo encima de «📌 Publicar en Stock»
  de cada resultado. Al publicarse, el campo queda bloqueado mostrando lo que se guardó.

## Cómo se escriben

Separadas por comas (así una etiqueta puede llevar espacios: `starbucks, hilo musical`) o, sin comas, por espacios
(`#starbucks #otoño`). `#` es opcional y siempre separa. Diez como mucho, de hasta 80 caracteres.

## Para qué sirven

| Etiqueta | Efecto |
|---|---|
| Cliente — `#starbucks` (o `#alsea`) | La pieza es de ese cliente: otro cliente no la ve (`docs/vista-por-cliente.md`). |
| Centro — `#starbucks_paseodegracia_103` | Se emite sola en ese centro: lo visual en sus pantallas, el audio en sus altavoces. |
| Pantalla — `#starbucks_paseodegracia_103_pantalla1` | Se emite sola en esa pantalla, añadida a su playlist. |
| Cualquier otra | Tema para buscar y para las playlists por etiquetas de admira.tv. |

Con un cliente activo (cuenta asignada, `/marca ver-como` o `/marca <cliente>`) el campo nace con su etiqueta, para que
lo que sube quede a su nombre; se puede borrar.

Los nombres de centros y pantallas se consultan en el gemelo con `/inventario idIoT`. Escribir el hashtag en el
comentario, el título o el texto sigue funcionando: el Stock también los lee de ahí.

Código: `app.js` (`parseEtiquetas`, `etiquetasSugeridas`, `pubTagsHTML`, `campoEtiquetasImport`). Pruebas:
`node --test test/etiquetas-campo.test.mjs`.


## Orientación automática al importar / Automatic import orientation

ES: El importador mide cada imagen o vídeo y añade vertical + portrait cuando alto > ancho, u horizontal + landscape cuando ancho > alto. Vale para archivos locales, subidas por partes, vídeos importados por URL y la caja de importación del Adapter. Conserva las otras etiquetas; corrige las de orientación incompatibles. Cuadrados: cuadrado, sin portrait/landscape. Audio y metadatos ilegibles: sin clasificación automática de orientación. Reimportar el mismo contenido conserva identidad e historial y completa la orientación medida; no migra el catálogo entero.

EN: The importer measures each image or video and adds vertical + portrait when height > width, or horizontal + landscape when width > height. Covers local files, multipart uploads, URL-imported videos and the Adapter import box. Other tags stay; conflicting orientation tags are corrected. Square media: cuadrado, without portrait/landscape. Audio and unreadable metadata receive no automatic orientation. Reimporting identical content preserves identity and history and enriches measured orientation; the whole catalogue is not migrated.

Contrato / Contract: `POST https://api.admira.store/stock/publish`, `dimensions: {width, height}` (enteros positivos, máximo 65535). Se guarda como `ancho`, `alto`, `orientacion` y etiquetas en Stock. `validacion.ancho/alto` del máster tiene prioridad. La medición no es una validación de calidad y no genera `validacion.ok`. No requiere un comando CLI. / No CLI command required; measurement does not assert media quality.
