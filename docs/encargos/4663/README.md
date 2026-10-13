# Encargo #4663 · consola Experto redimensionable

Oráculo (consejero Walt), OraculoMBP14 · 13-oct-2026.
Solo rama y preview por orden expresa de Carlos. Ningún despliegue de producción.

En la preview, abre Experto en la esquina superior derecha. Aparece una entrada de 48 px.
Arrastra el borde superior para ajustar el alto; doble clic pliega y recupera el último alto guardado.
El borde permite también flechas, Inicio, Fin y Enter. Al enviar una orden se despliega la respuesta.
En escritorio se superpone; en móvil reserva espacio al final para que el contenido sea accesible.
Se limita a la mitad del área visible y acompaña el teclado virtual.

Son comandos web; no ejecuta una shell del sistema ni requiere una aplicación de escritorio.
La altura se recuerda por navegador y dominio; no se sincroniza entre Pixeria y Studio.
La piel y el motor compartidos dependen de admiranext.com. No se modifican en esta entrega.

Pruebas: Playwright con Chrome headless, ES/EN, 1440 y 390 px: apertura plegada,
entrada completa sin recortar, arrastre, doble clic, memoria tras recarga, controles de teclado,
respuestas, historial, salida de texto segura y acceso al contenido móvil. 10 pruebas unitarias de marca/CLI.

[Tutorial oficial exportado](tutorial-4663.mp4): animación explicativa de 15 segundos,
1080×1920, H.264/AAC; no es una grabación de pantalla y no tiene locución (sonido sintetizado).
[Brief y guion](tutorial-4663-brief.json).
Capturas reales del navegador: [plegada](cli-folded-en-1440.png) y [desplegada](cli-expanded-en-1440.png).
