# Idioma de los controles / UI control language

ES: Creator, Adapter, Audio, Music, Images, Video, Assets y Stock siguen el idioma de la página. Las rutas `/en/` muestran etiquetas, desplegables, opciones y ayudas de interfaz en inglés, incluidos los controles que se regeneran al cambiar de motor o proyecto. Assets conserva `/en/crear/` sin devolver al editor castellano.

EN: Creator, Adapter, Audio, Music, Images, Video, Assets and Stock follow the page language. `/en/` routes show English UI labels, dropdowns, options and help, including controls regenerated when changing engine or project. Assets stays at `/en/crear/` rather than returning to the Spanish editor.

## Tutorial / Walkthrough

ES: Elige ENG en Idioma o escribe `/language ENG` en Experto. Abre Stock: el tipo muestra **Images**, su ayuda **Filter by type**, el orden **Sort**, **Name** y **Date**. Abre las demás secciones, cambia de motor y revisa las opciones. Para volver al castellano elige ESP o `/idioma ESP`: **Imágenes**, **Filtrar por tipo**, **Ordenar**, **Nombre**, **Fecha**.

EN: Select ENG in Language or enter `/language ENG` in Expert. Open Stock: the type shows **Images**, its help **Filter by type**, and sorting shows **Sort**, **Name** and **Date**. Visit the other sections, change engine and review the options. Choose ESP or `/idioma ESP` to return to Spanish.

## Contrato / Contract

`assets/ui-locale.js` localiza únicamente copia conocida de interfaz. Antes de traducir una opción sin atributo `value`, conserva su valor original. No cambia IDs, parámetros de API, preferencias, claves, historial CLI ni contenido del usuario. Los títulos de piezas, prompts, comentarios, etiquetas, nombres de clientes, circuitos y distribuciones conservan su idioma original, incluso dentro de una web inglesa.

`assets/ui-locale.js` localizes only known UI copy. An option without an explicit `value` retains its original value before its label is translated. IDs, API parameters, preferences, keys, CLI history and user content remain unchanged. Asset titles, prompts, comments, tags, client names, circuits and layout names retain their original language, including on an English page.

ES: No requiere un nuevo comando ni modifica herramientas de generación, exportación, programación o publicación. El contrato `uiLocale` de `/mcp/catalogo.json` documenta las ocho secciones. EN: No new command or change to generation, export, scheduling or publishing tools. The `uiLocale` contract in `/mcp/catalogo.json` documents all eight sections.

## Verificación / Verification

Prueba de regresión: `UI_BASE_REF=<commit de retorno> NODE_PATH=<jsdom instalado> node --test scripts/test-ui-locale.cjs`. Comprueba las ocho rutas, valores/orden de opciones, IDs, entradas editables, traducción dinámica y castellano sin cambios. La revisión pública se registra separadamente de las pruebas locales; se requiere una sesión autorizada de Google o el acceso oficial de agentes (`/auth/agente`), sin cambiar la configuración de acceso.

Regression check: `UI_BASE_REF=<rollback commit> NODE_PATH=<installed jsdom> node --test scripts/test-ui-locale.cjs`. Covers eight routes, option values/order, IDs, editable content, dynamic translation and unchanged Spanish. Public review is recorded separately from local tests with an authorized Google session or the official agent entry (`/auth/agente`), without changing the access configuration.
