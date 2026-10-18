# El Creativo · importar a Stock

Dentro de `/admirito creativo`, escribe `/importar URL` y pulsa Enter o ↑. Pegar una única URL en su compositor inicia la importación. También admite `/admirito creativo importar URL` y `/importar URL` directamente en Experto de Studio. `/importar` sin URL enseña la ayuda.

Ejemplos:

```
/importar https://example.com/video.mp4
/importar https://www.youtube.com/watch?v=ID audio
```

La importación guarda en el Stock habitual de Admira Studio y devuelve «Ver en Stock». Admite audio, vídeo e imagen directos si el servidor permite su descarga desde el navegador. Para YouTube, Vimeo, Instagram, TikTok y X utiliza el importador existente. Su disponibilidad es independiente de la sesión de Suno y de la cola de canciones. Si el importador no responde se conserva la URL y se ofrece continuar; no se afirma que el contenido se haya guardado.

Formato por defecto: vídeo para enlaces sociales, audio para archivos de audio. Puedes añadir `audio` o `video` después de una URL social. En archivos directos se conserva el tipo multimedia recibido. Máximo 100 MB, igual que la subida local del Stock. Se mantienen la etiqueta de cliente activo, las dimensiones medidas y el flujo habitual de subida por partes.

El asistente conserva los encargos de locución/música al entrar y salir de la importación. El historial de importación usa IndexedDB separado, con identidad por URL normalizada y formato. Dos pestañas reclaman una sola descarga/publicación. Recargar un resultado terminado abre la misma entrada de Stock; no vuelve a publicarlo. Una respuesta incierta al iniciar descarga o al publicar se conserva sin reenvío automático. El usuario puede consultar Stock antes de decidir otra acción. Con un identificador de descarga confirmado, continuar usa consultas GET para recuperar ese mismo trabajo.

Las rutas `/creativo-import/health|start|status|get` requieren sesión y validan origen. Solo reenvían al importador primario/respaldo ya existentes; no admiten destinos arbitrarios. El archivo se sirve como stream. No se cambian ni distribuyen credenciales de los proveedores y no hay generación IA en el comando.
