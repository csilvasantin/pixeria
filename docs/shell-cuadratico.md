# Shell cuadrático de Pixeria / Four-band shell (FLT-101334)

**Regla: toda página nueva usa el shell.** Ninguna página de pixeria.com (admira.studio) trae su propia cabecera ni su propia navegación: todas llevan la misma barra de 4 bandas que la portada. Lo mismo que en admira.app (`clearchannel-tv/docs/galaxy-shell.md`).

## Qué es

La interfaz cuadrática de la portada (`index.html`) en cuatro bandas:

- **Barra superior** (`header.pf-topbar`): a la izquierda ☰ Opciones + «Pixeria» (enlace al inicio); en el centro las secciones (Audio, Música, Imágenes, Video, TikTok, Publicidad, Anonimizador, Ideas, Assets, Stock); al fondo a la derecha ▤ Avanzado justo antes de ⌘ Experto. El orden lo fijó Carlos (29-sep-2026): no se cambia.
- **☰ Opciones** (raíl `.rail-left`): las secciones de Pixeria con su descripción y el sello del release.
- **▤ Avanzado** (raíl `.rail-right`): radar, arquitectura, documentación y concepto.
- **⌘ Experto** (franja inferior): la consola web (`assets/expert-cli.js`, ver `docs/expert-cli.md`), con `/marca` para la marca blanca (`docs/marca-blanca.md`).

En las páginas interiores no hay idioma ni Contacto en la barra (decisión de producto: el contacto sigue en el pie). La portada y `en/` conservan los suyos.

### Quién monta qué

| Pieza | Papel |
|---|---|
| `assets/site-nav.js` | El shell de las interiores. Convierte la cabecera de la página en `.pf-topbar` (`canonicalHeader`), pinta las secciones, inyecta los raíles Opciones/Avanzado (`ensureHomeRails`, clase `body.pix-nav-home-rails`), monta Experto (`#pixNavExpertLayer` + `expert-cli.js`), engancha la marca blanca y publica la altura real de la barra en `--pf-topbar-h`. |
| `assets/cuadratura.css` | Estilos de la barra y los raíles, y el bloque **Shell universal**: fija en la barra la tipografía y los colores de la portada y la aísla del CSS de cada página. |
| `assets/cuadratura.js` | En la portada, `en/` y `_cuadopen` monta la cuadratura artesanal (`.cuad`). En las interiores no hace nada (sale al ver `pix-nav-home-rails`), pero se carga igual para que todas las páginas compartan el mismo código. |

## Cómo adopta el shell una página

Patrón de `admira-xp.html`:

```html
<head>
  …tu CSS (styles.css, workspace.css, <style>…)…
  <link rel="stylesheet" href="/assets/cuadratura.css?v=<sello>">   <!-- después de TODO el CSS propio -->
  <script defer src="/assets/site-nav.js?v=<sello>"></script>
</head>
<body>
  <!-- Cuadratura: ocultar los raíles al abrir <body> (sin parpadeo) según localStorage -->
  <script>(function(){var b=document.body,m={pixeria_pf_left:'pf-left-off',pixeria_pf_right:'pf-right-off',pixeria_pf_bottom:'pf-bottom-off'};try{for(var k in m){if(localStorage.getItem(k)!=='1')b.classList.add(m[k]);}}catch(e){for(var j in m){b.classList.add(m[j]);}}})();</script>
  <header class="site-header">                       <!-- o class="topnav" -->
    <a class="brand" href="/" aria-label="Pixeria inicio"><span>Pixeria</span></a>   <!-- .brand, hijo DIRECTO -->
    <nav class="nav" aria-label="Secciones de Pixeria">…</nav>                         <!-- o .primary-nav -->
  </header>
  <main>…contenido…</main>
  <script defer src="/assets/cuadratura.js?v=<sello>"></script>
</body>
```

- La cabecera **tiene** que llevar la marca como hijo directo (`.brand`, o `<div class="brand"><a class="brand-link">`) y un `<nav class="nav">` o `.primary-nav`: sin ellos `canonicalHeader` no convierte la barra (le pasaba a `404.html`). Los enlaces del `<nav>` los reescribe `site-nav.js`; los de la página son el respaldo sin JavaScript.
- El `<main>` envuelve el contenido: ahí llegan los enlaces de la franja Experto y lo que respetan los raíles.
- Las páginas `quad-ui` (`audio.html`, `musica.html`, `imagenes.html`, `video.html`) usan `nav.quad-top` con `data-quad-toggle`, `.quad-brand` y `.quad-links`: `site-nav.js` convierte `.quad-top` en la misma `.pf-topbar`.
- `?v=` lo pone `scripts/sellar.py`: no a mano.

### Reglas de convivencia

- **Una sola barra.** Nada de navegaciones ni selectores de idioma propios en la página. La banda `nav.admira-nav` del kit admira-design ya no se ve en ninguna página: la ocultan `workspace.css` y `styles.css` (`display:none !important`), además de `cuadratura.css` con `pf-has-frame`.
- **Cabeceras de contenido.** Un `<header>` que es el título de la página se queda, con su CSS acotado a su clase (`header.tester-head`, `header.page-head`, `header.topbar` de `tool/`), nunca `header{…}` a secas.
- **Alturas.** Nada de `100vh - Npx` ni `top:88px` pensados para la cabecera vieja: `var(--pf-topbar-h, 70px)`. La barra mide 70 px en escritorio y 94 px en móvil (dos filas); `site-nav.js` la mide con `ResizeObserver` y los raíles ya empiezan debajo.
- **Capas.** Raíles 160, barra 180, consola experta 190, paneles flotantes 1200. Los modales y avisos propios van por encima (≥ 1300; los de `crear/` usan 99998–1000000). Las líneas CRT de `tester/` (z-index 100, sin eventos) quedan bajo la barra.
- **Misma barra en todas.** El bloque «Shell universal» de `cuadratura.css` fija familia, cuerpo y colores de la barra y de la marca, y anula en sus botones las reglas genéricas de la página (`button[aria-pressed="true"]` de `tester/` los pintaba de verde lleno). Con marca blanca manda `marca-blanca.css` (todo va bajo `:root:not([data-mb-marca])`).
- **Puertas de acceso.** El shell no toca la verja: el bloque `GATE-INICIO … GATE-FIN`, `auth-gate.js`, `backoffice/backoffice-auth.js` y `functions/_middleware.js` siguen igual. En local, `?gate=off` solo vale donde ya existía.

## Guardián

`test/shell-cuadratico.test.cjs` recorre todos los `.html` del repo. Cada uno carga `site-nav.js` (defer, en el `<head>`), `cuadratura.css` (después del CSS propio) y `cuadratura.js`, los tres con el sello vigente de `index.html`, tiene `<main>` y una barra montable (cabecera canónica o `quad-ui`); o figura en `SHELL_EXCEPTIONS` con su motivo. Una página nueva sin shell hace fallar el test, y también una excepción que ya no existe o que sí carga el shell. Además vigila que ninguna página adoptada vuelva a `calc(100vh - Npx)`.

## Páginas

**Con shell (57 de 73).**

| Grupo | Páginas |
|---|---|
| Portada y variantes (cuadratura artesanal) | `index.html`, `en/index.html`, `_cuadopen.html`, `en/_cuadopen.html` |
| Secciones (ya lo llevaban) | `admira-xp.html`, `anonimizador.html`, `avatar.html`, `concepto.html`, `director.html`, `ideas.html`, `plataforma.html`, `publicidad.html`, `stock.html`, `clearchannel/`, `radar/` |
| `quad-ui` (barra propia que `site-nav.js` convierte) | `audio.html`, `musica.html`, `imagenes.html`, `video.html` |
| Adoptadas en FLT-101334 | `404.html`, `backoffice/` (+ `crear/`, `labs/`, `tool/`), `calendario/`, `campanas/`, `crear/`, `crear-campana/`, `documentacion/`, `help/`, `hilomusical/`, `hilomusical.html`, `labs/`, `mcp/`, `megafonia/`, `megafonia.html`, `privacidad.html`, `segmentado/`, `segmentado.html`, `tester/`, `tool/`, `flags/australia/` |
| Inglés, igualadas a su versión española | `en/admira-xp.html`, `en/anonimizador.html`, `en/audio.html`, `en/avatar.html`, `en/concepto.html`, `en/crear-campana/`, `en/director.html`, `en/imagenes.html`, `en/musica.html`, `en/plataforma.html`, `en/privacy.html`, `en/publicidad.html`, `en/radar/`, `en/stock.html`, `en/video.html` |

Qué cambió al adoptarlas:

| Página | Cambio |
|---|---|
| `404.html` | La cabecera no tenía `<nav>` y no se convertía: ahora sí. Altura `calc(100vh - var(--pf-topbar-h) - 50px)`. |
| `tester/` | Cabecera canónica + `<main>`. Su `<header>` de título pasa a `header.tester-head` con el CSS acotado. |
| `hilomusical.html`, `megafonia.html`, `segmentado.html` | Sin shell hasta ahora: cabecera canónica y `<main class="tool-main">`; el relleno pasa del `<body>` al `<main>` para que la barra quede pegada arriba. |
| `help/` | Cabecera canónica y `<main>`; un trozo suelto del comentario de la verja se pintaba como texto encima de todo (ahora es comentario). |
| `flags/australia/`, `mcp/` | Cabecera canónica (`flags/`) y `<main>` (`mcp/`). Pie acotado. |
| `documentacion/` | Índice pegajoso `top: calc(var(--pf-topbar-h) + 18px)` y anclas `scroll-margin-top: calc(var(--pf-topbar-h) + 22px)`. |
| `crear-campana/`, `en/crear-campana/`, `hilomusical/`, `megafonia/`, `segmentado/` | Héroe a pantalla completa `calc(100vh - var(--pf-topbar-h))`. |
| `stock.html` | `cuadratura.css` pasa detrás de `viewer.css` y `editor.css`. |
| Resto | `cuadratura.css`, script sin parpadeo y `cuadratura.js` (la barra ya se montaba). |

### Excepciones (16)

| Página | Motivo |
|---|---|
| `idea.html` | Redirección inmediata a `/concepto.html`; no pinta nada. |
| `en/crear/index.html` | Redirección inmediata a `/crear/`; no pinta nada. |
| `xpacios/index.html` | Redirección a xpaceos.com (Xpacios se mudó a XpaceOS). |
| `xpacios/crear/index.html` | Ídem. |
| `xpacios/crear/phone.html` | Ídem. |
| `xpacios/grok/index.html` | Ídem. |
| `xpacios/xtanco-barcelona/index.html` | Ídem. |
| `xpacios/xtanco-valencia/index.html` | Ídem. |
| `signage.html` | Player del Pixer Feed a pantalla completa (overflow oculto) para las pantallas: una barra encima cortaría la emisión. |
| `xtore.html` | Player del Pixer Feed a pantalla completa para tienda. |
| `en/signage.html` | Ídem (inglés). |
| `en/xtore.html` | Ídem (inglés). |
| `campanas/sabiasque-tabaco/bucle.html` | Bucle de la campaña a pantalla completa: lo que emite la pantalla y lo que se previsualiza en el iframe de `/campanas/`. |
| `campanas/sabiasque-tabaco/slide.html` | Fragmento: cada pieza que el bucle carga en su iframe. |
| `xpacios/aulestia-i-pijoan/index.html` | Una de las dos rutas públicas sin sesión (`functions/_middleware.js`): mapa friends and family. La barra llevaría a un estudio cerrado con login de Google. |
| `xpacios/cafebreria/ci/index.html` | La otra ruta pública: ficha de cada aparato que se abre con un QR en el móvil. Ídem. |

`_cuadopen.html` y `en/_cuadopen.html` no son excepción: son la portada con la cuadratura completa y ya cumplen.

### Pendiente conocido

- `tool/` y `backoffice/tool/` cargan JetBrains Mono de Google Fonts; el resto del sitio no la descarga y usa la monoespaciada del sistema. La barra declara la misma familia en todas, pero en esas dos se ve con la fuente real.
- `en/audio.html` no es `quad-ui` (la española sí). Las dos montan la misma barra; convertirla es otra tarea.
- La barra es `position:sticky` pero se va con el scroll: el `overflow-x:hidden` del `<body>` (`styles.css`/`workspace.css`) lo convierte en contenedor de scroll. Pasa igual en la portada y en `admira-xp.html`; no lo cambia esta tarea.

---

**Rule: every new Pixeria page uses the shell.** Load `/assets/cuadratura.css` after the page CSS, `/assets/site-nav.js` (defer) and `/assets/cuadratura.js`, give the page a `header.site-header` (or `.topnav`) with a direct `.brand` child and a `nav.nav`, and wrap the content in `<main>`. Use `var(--pf-topbar-h)` for heights and keep own modals above z-index 1300. 57 of the 73 pages carry the shell; the 16 exceptions (redirects, full-screen players, an iframe fragment and the two public no-session routes) are listed above and in `SHELL_EXCEPTIONS` of `test/shell-cuadratico.test.cjs`, which fails when a page skips the shell.
