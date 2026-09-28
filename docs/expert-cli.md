# Consola web del modo experto

El botón Experto abre una entrada de 48 px dentro de la web. No necesita aplicación de escritorio ni instalación.

- Arrastra el borde superior para ajustar la altura (máximo: la mitad del área visible).
- Doble clic en el borde o el botón ▴/▾ pliega y despliega. El borde también admite flechas, Inicio, Fin y Enter.
- Cada entrada al modo experto comienza plegada. Al desplegar recupera la última altura arrastrada, guardada en `localStorage` (`pixeria_cli_height`; la réplica adapta el prefijo según marca.json). La preferencia es por navegador y dominio.
- El documento tiene su propia zona de desplazamiento por encima de la consola, también en móvil y cuando cambia el área visible por el teclado.
- Una orden muestra su resultado desplegando la consola. ↑/↓ recorre el historial de esta página.

Comandos: `help`, `clear`, `echo <texto>`, `date`, `status`, `version`, `history`, `open <sección>` y `demo` (también `/demo`). `help` enumera las secciones admitidas; las respuestas usan el idioma de la página. `demo` lanza en vivo dos locuciones con el mismo motor de voz que Audio y dos canciones cortas con estilo, voz y nombre del cliente, una detrás de otra. Cada pieza enseña la hora, el avance y, al terminar, un reproductor y el enlace de Stock (en las canciones el enlace es el vídeo). Si una falla, lo dice y sigue. Son comandos de la web, no una shell del sistema operativo. No se ejecuta JavaScript introducido por el usuario.

`assets/site-nav.js` carga el mismo componente en las tres familias de panel experto. Los contenidos anteriores se conservan en la página. Admira Studio genera los mismos assets aplicando las sustituciones de su `marca.json`.

Prueba de navegador (servidor estático LOCAL):

```sh
python3 -m http.server 8463 --bind 127.0.0.1
PLAYWRIGHT_MODULE=/ruta/a/playwright node test/expert-cli.browser.cjs
```

La prueba simula únicamente la sesión del servidor local. Las comprobaciones y capturas de producción requieren una sesión Google autorizada real.
