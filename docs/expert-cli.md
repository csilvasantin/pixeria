# Consola web del modo experto

El botón Experto abre una entrada de 48 px dentro de la web. No necesita aplicación de escritorio ni instalación.

- Arrastra el borde superior para ajustar la altura (máximo: la mitad del área visible).
- Doble clic en el borde o el botón ▴/▾ pliega y despliega. El borde también admite flechas, Inicio, Fin y Enter.
- Cada entrada al modo experto comienza plegada. Al desplegar recupera la última altura arrastrada, guardada en `localStorage` (`pixeria_cli_height`; la réplica adapta el prefijo según marca.json). La preferencia es por navegador y dominio.
- El documento tiene su propia zona de desplazamiento por encima de la consola, también en móvil y cuando cambia el área visible por el teclado.
- Una orden muestra su resultado desplegando la consola. ↑/↓ recorre el historial de esta página.

Comandos: `help`, `clear`, `echo <texto>`, `date`, `status`, `version`, `history` y `open <sección>`. `help` enumera las secciones admitidas; las respuestas usan el idioma de la página. Son comandos de navegación e inspección de la web, no una shell del sistema operativo. No se ejecuta JavaScript introducido por el usuario.

`assets/site-nav.js` carga el mismo componente en las tres familias de panel experto. Los contenidos anteriores se conservan en la página. Admira Studio genera los mismos assets aplicando las sustituciones de su `marca.json`.

Prueba de navegador (servidor estático LOCAL):

```sh
python3 -m http.server 8463 --bind 127.0.0.1
PLAYWRIGHT_MODULE=/ruta/a/playwright node test/expert-cli.browser.cjs
```

La prueba simula únicamente la sesión del servidor local. Las comprobaciones y capturas de producción requieren una sesión Google autorizada real.

## /demo: la web se enseña sola (encargo #4685)

`/demo` (o `demo`) lee el guion de [`/demo/`](../demo/index.html) y recorre cada punto en autopiloto: un cursor coge el ratón, rellena la interfaz real, y un rótulo con barra de progreso dice en qué punto va. Por defecto dura un minuto por punto, y cada punto puede tener su propia duración. `Esc` la para, `→` pasa al siguiente punto y `←` vuelve al anterior. Si el punto está en otra página, la abre y sigue por ella: el estado va en `sessionStorage` (`pf_demo_run`) y `site-nav.js` recarga el motor.

- `/demo list` numera los puntos del guion · `/demo N` lanza solo el punto N · `/demo stop`.
- El guion es HTML legible: añadir, quitar o reordenar `<li>` en `demo/index.html` cambia la siguiente `/demo`. El formato está en el comentario de esa página.
- Los pasos `señala` mueven el ratón y marcan el clic **sin pulsar**. Se usan en los botones que generan con IA, para que ensayar no gaste crédito. `clic` pulsa de verdad.
- El motor (`assets/demo-motor.js`) no depende de la marca. Para xpaceos.com o clearchannel.tv, publica su `/demo/` con la misma estructura (o apunta a otro guion con `<meta name="pf-demo-guion" content="/ruta/">`) y conecta `window.PFDemo.comando(arg, escribir)` a su consola.

Prueba: `PLAYWRIGHT_MODULE=… DEMO_TEST_ORIGIN=http://127.0.0.1:8463 node test/demo-motor.browser.cjs` (con `DEMO_VIDEO_DIR=<dir>` graba la demo completa).
