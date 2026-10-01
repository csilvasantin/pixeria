# Marca blanca en Pixeria / White label (FLT-101333)

Pixeria (pixeria.com, la pata «Studio crea» de admira.studio) puede vestirse con la marca de un cliente del **catálogo único** de https://www.admiranext.com/marcablanca (semillas Admira, Lumbre, BRUMELLE y Frescaria, y las marcas guardadas después, p. ej. `starbucks`). Sigue el mismo diseño, textos y reglas que admira.app (FLT-101331, `clearchannel-tv/docs/marca-blanca.md`).

## Cómo se activa

| Cómo | Efecto |
|---|---|
| `?marca=<id>` en cualquier URL con la barra de las 4 bandas | Aplica la marca y la recuerda en la pestaña (`sessionStorage` `mb:marca`, la misma clave que el cargador común y admira.app). |
| ⌘ Experto → `/marca <id>` (alias `/brand`) | Igual, sin recargar. Tab completa el comando, los ids del catálogo y `off`. |
| `?modo=marca\|nativo\|claro\|oscuro\|auto` | Modo de color (por defecto `marca`: el del cliente, claro u oscuro). |

La marca se mantiene al navegar entre páginas de la misma pestaña. Una pestaña nueva empieza sin marca.

## Cómo se vuelve a Pixeria

`/marca off` (o `/marca admira`), **«Volver a Admira»** arriba de la banda Opciones (solo aparece con marca activa) o `?marca=admira` en la URL. Se deshace en el sitio, sin recargar: variables, atributos, logo, favicon, theme-color, título y hojas cargadas; también se quitan `?marca=`/`?modo=` de la URL.

## Cómo se carga (un solo enganche)

- **`assets/site-nav.js`** (el shell común: lo cargan 52 de las 73 páginas) es el único punto de entrada. Si la pestaña pide marca (`?marca=` en la URL o `mb:marca` recordada) inserta `assets/marca-blanca.js` con **su mismo sello** (`?v=`). Si no, no carga nada: una visita normal no descarga ni un byte nuevo. La consola experta lo carga al usar `/marca` (`window.PixeriaMarca.cargar()`). Ninguna página lo enlaza a mano.
- `assets/marca-blanca.js`, con marca:
  1. **Comprueba primero** que existe: `GET https://www.admiranext.com/marcablanca/api/marcas/<id>` (CORS `*`, 8 s como mucho). 404 → no existe. Si la API no responde, prueba el JSON estático `clientes/<id>.json`, como el cargador común.
  2. Solo entonces carga `marcablanca.css` y `marcablanca.js` de admiranext.com (`data-mb-plataforma="studio"`, `data-mb-auto="false"`) y `assets/marca-blanca.css` (los ajustes de Pixeria, con el mismo sello), y llama a `MarcaBlanca.aplicar(id, {plataforma: 'studio'})`.
  3. Si algo falla, no queda nada a medias: Pixeria sigue igual y solo hay un aviso en la consola del navegador (en el CLI, un mensaje claro).
- El catálogo completo (`/marcablanca/api/marcas`) solo se pide con una marca activa o al usar `/marca`; mientras, el Tab usa la semilla.

## Qué cambia

- **Barra de las 4 bandas**: fondo de la marca casi opaco con borde inferior. Composición: [Opciones] **logo del cliente** (enlace al inicio) **│ powered by Pixeria**, en pequeño y en el gris de la marca, en el lugar de la marca de Pixeria; las secciones y los iconos Avanzado y Experto, con los colores de la marca. Bajo 600 px solo queda el logo. Si la marca no tiene logo, su nombre. El `title` del logo avisa si es una **propuesta automática** («no es la marca oficial») o una **marca ficticia de ejemplo**.
- **Bandas Opciones / Avanzado / Experto**, la consola experta, módulos, tarjetas, botones, chips, campos, tablas del Stock, pestañas de Assets, chat de Concepto, radar y bloques editoriales de la portada: superficies, bordes, radios y textos de la marca.
- **Variables de Pixeria** (`--bg --panel --panel-2 --ink --muted --line --line-bright --matrix --matrix-deep --xp --image --video --audio --music --cyan --gold --green --coral --glow`): pasan a la marca. El puente común de `marcablanca.css` ya traduce las de studio; `marca-blanca.css` las vuelve a fijar con los textos corregidos.
- **Legibilidad (AA)**: `marca-blanca.js` calcula tokens `--mbx-*` (texto, texto suave, marca, acento, ok, aviso, error, texto sobre marca y sobre acento, y los colores por tipo de contenido): toma el color de la marca si contrasta ≥ 4,5:1 con el fondo, la superficie y la superficie alternativa; si no, el siguiente candidato y, en último caso, negro o blanco. Starbucks es una marca **clara**: su verde `#006241` y su gris `#576061` se mantienen; el dorado `#C58800` no llega a AA sobre blanco y cede al verde.
- **Identidad Matrix**: la lluvia de caracteres, el tinte verde, las líneas CRT y los halos de neón no se pintan con marca.
- **Tipografía**: textos con `--mb-fuente-texto`, títulos con `--mb-fuente-titulos`, etiquetas y botones con `--mb-fuente-etiquetas`, consola y código con `--mb-fuente-mono` (el cargador carga las fuentes del catálogo).
- **Pestaña**: favicon y theme-color de la marca y título «Nombre del cliente · título de la página».

## Qué no cambia

- **Previsualizaciones**: vídeos, imágenes, miniaturas del Stock, GIF de cabecera, foto del hero, lienzos y reproductores no se recolorean (ni filtros ni mezclas). Las insignias que van encima de una miniatura conservan su aspecto.
- Las páginas sin `site-nav.js` (ver abajo).
- Algunos detalles escritos a mano en páginas largas no revisadas una a una (modales del Stock, distribuidor, backoffice) toman la marca por sus variables pero pueden conservar algún tinte verde.

## Páginas

**Con marca (52, las que cargan `assets/site-nav.js`)**, comprobadas una a una con `?marca=starbucks` en Chrome:
`index.html`, `_cuadopen.html`, `404.html`, `admira-xp.html`, `anonimizador.html`, `audio.html`, `avatar.html`, `concepto.html`, `director.html`, `ideas.html`, `imagenes.html`, `musica.html`, `plataforma.html`, `privacidad.html`, `publicidad.html`, `stock.html`, `video.html`, `backoffice/` (+ `crear/`, `labs/`, `tool/`), `calendario/`, `campanas/`, `clearchannel/`, `crear/`, `crear-campana/`, `documentacion/`, `hilomusical/`, `labs/`, `mcp/`, `megafonia/`, `radar/`, `segmentado/`, `tester/`, `tool/` y en inglés `en/` (`index`, `_cuadopen`, `admira-xp`, `anonimizador`, `audio`, `avatar`, `concepto`, `crear-campana/`, `director`, `imagenes`, `musica`, `plataforma`, `privacy`, `publicidad`, `radar/`, `stock`, `video`).
`404.html` y `tester/` no tienen barra de 4 bandas: toman colores, tipografía, favicon, título y «Volver a Admira», pero no hay logo en barra (y `tester/` no tiene consola experta).

**Sin marca (21, no cargan el shell)**: `help/`, `idea.html`, `hilomusical.html`, `megafonia.html`, `segmentado.html`, `signage.html`, `xtore.html`, `en/crear/`, `en/signage.html`, `en/xtore.html`, `campanas/sabiasque-tabaco/bucle.html` y `slide.html`, `flags/australia/`, y `xpacios/` (`index`, `aulestia-i-pijoan/`, `cafebreria/ci/`, `crear/`, `crear/phone.html`, `grok/`, `xtanco-barcelona/`, `xtanco-valencia/`). Adoptar el shell en ellas es otra decisión; el día que carguen `site-nav.js` heredan la marca sin más cambios.

## Ficheros

| Fichero | Papel |
|---|---|
| `assets/site-nav.js` | Único enganche: carga `marca-blanca.js` (y la consola experta) con su sello, solo si la pestaña pide marca o se usa `/marca`. |
| `assets/marca-blanca.js` | Decide la marca, comprueba el catálogo, carga lo necesario, aplica, deshace y expone `window.AdmiraMarca` (`actual`, `conocidas`, `listar`, `activar`, `desactivar`, `analizar`). |
| `assets/marca-blanca.css` | Todo bajo `:root[data-mb-marca][data-mb-plataforma="studio"]`. Solo se descarga con marca. |
| `assets/expert-cli.js` | Verbo `/marca` (alias `/brand`), Tab y `help`. |
| `test/marca-blanca.test.cjs` | Sin marca no se carga nada; catálogo antes que nada; AA; verbo y Tab. |

## Límites conocidos

- `POST /marcablanca/api/analizar` exige mismo origen: `/marca <web>` abre el analizador de admiranext.com en otra pestaña (`?web=<url>`).
- La marca por dominio (`<cliente>.admira.studio`) del cargador común no se usa aquí: Pixeria solo se viste con `?marca=` o `/marca`.

---

**English.** Pixeria can wear a client brand from the admiranext.com/marcablanca catalogue. Turn it on with `?marca=<id>` or `/marca <id>` (alias `/brand`) in the expert console; it stays for the tab. `/marca off`, `?marca=admira` or “Back to Admira” at the top of the Options band undo it in place. `assets/site-nav.js` is the single hook: it loads `assets/marca-blanca.js` with its own stamp only when the tab asks for a brand, so a normal visit loads nothing new and never contacts admiranext.com. With a brand, the catalogue entry is checked first (8 s max); only then the common stylesheet and loader (platform `studio`, no auto start) plus `assets/marca-blanca.css` are loaded and the brand applied. The bar shows the client logo │ “powered by Pixeria”; bands, console, modules, buttons and chips take the brand colours with text colours corrected to WCAG AA; video, image and thumbnail previews are never recoloured.
