# Altadis · adaptación IA y formatos aplicados en Estancos

## Español

Abre [Altadis en Admira Studio](https://www.admira.studio/adaptaciones/?proyecto=altadis). El proyecto `altadis-estancos-bcn` conserva **24 formatos planos y MyBlu + cinco videowalls segmentados**, sin modificar las transcripciones `perfil-cliente-18.json` y `perfil-cliente-especiales.json`. IDs `cliente-NN` y `cliente-esp-N` estables. La ficha, recetas, selección, foco, zoom y preferencias anteriores siguen disponibles.

1. Elige un vídeo o imagen del Stock o sube tu archivo. Pulsa **Adaptar**.
2. En **Adaptación IA · aplicar en Estancos**, escoge formato y estanco. El previo representa una aplicación virtual del contenido en esa tienda.
3. Opcionalmente describe el ambiente y pulsa **Generar fondo IA**. Usa `/auth/api-token` y el motor existente `https://api.admira.store/image/edit` (Gemini); requiere sesión y puede consumir crédito del proveedor. Se envía un fotograma o imagen de referencia reducido, nunca el vídeo completo. Puedes cancelar; el timeout es 90 s. Un error mantiene el contenido anterior y no se anuncia como generación completada.
4. El fondo generado es **estático**, ajustado a la geometría exacta de la pared. Se superpone el contenido original mediante escalado y encaje; no se regeneran sus productos, textos ni logos. El fondo necesita revisión visual. No es expansión generativa temporal del vídeo ni resolución nativa garantizada del modelo.
5. **Aplicar demo al estanco** guarda una superficie virtual adicional y la incluye en su paquete; **Retirar demo** elimina sólo esa aplicación. Las pantallas P1/P2 originales permanecen. Las asignaciones se conservan en `pixeria.adapter.aplicaciones.<proyecto>` en este navegador. No se programan players al aplicar una demo.
6. **Guardar formatos y aplicaciones** descarga `<proyecto>-formatos-aplicaciones.json`: ficha, los 29 IDs y medidas/geometrías, mapa original de estancos, aplicaciones y ajustes. Es un contrato portable para agentes; no contiene credenciales ni confirma hardware instalado. **Guardar fondo IA** descarga aparte la imagen generada; los fondos están vinculados al contenido actual en esta sesión, se descartan al cambiar fuente/proyecto o recargar. Los MP4 exportados contienen el fondo, independientemente de esa sesión.
7. Exporta desde la tarjeta o prepara el paquete de los estancos seleccionados. Para un videowall se compone **una pared física continua**, se corta cada pantalla desde ese plano y se empaqueta el atlas con celdas vacías negras. MP4 H.264, 25 fps; segmentos con igual duración. Los manifiestos identifican `virtual:true` y `estado:demo` en las aplicaciones añadidas. Stock y programación mantienen sus acciones separadas y sus controles existentes.

### Geometrías y límites

| ID | Pared física | Atlas de entrega | Pantallas |
| --- | --- | --- | --- |
| cliente-esp-1 | 3200×360 | 1280×1080 | 5 |
| cliente-esp-2 | 3840×360 | 1280×1080 | 6 |
| cliente-esp-3 | 7920×540 | 2880×1620 | 11 según diagrama; tabla dice 9 |
| cliente-esp-4 | 14400×540 | 3840×2160 | 15; disposición física inferida |
| cliente-esp-5 | 7020×960 | 2160×3840 | 13 |

Conservadas las ambigüedades del PDF: 5x1 tiene una errata en el ejemplo; 9x1 frente a 11 en el diagrama; Córdoba no especifica disposición física. Confirmar esas geometrías con Altadis antes de emitir. Los nueve estancos y sus 18 pantallas base son un mapa demo; no se inventa un parque instalado de videowalls.

Módulos fuente del repositorio `csilvasantin/pixeria`: `adaptaciones/ia-core.mjs`, `studio-adaptaciones.mjs`, `aplicaciones-core.mjs`, `especiales-core.mjs`, `estancos-core.mjs`. Admira Studio se genera mediante `marca.json` + `sync.sh --aplicar` desde `origin/main` del repositorio `csilvasantin/pixeria`; no editar el espejo a mano.

MCP real compartido: `https://mcp-pixeria.admira.store/mcp`. **altadis_formatos {}** devuelve el contrato y tutorial, sólo lectura. **fondo_adaptacion_ia {image,ancho,alto,brief?}** genera un fondo estático con autenticación de flota existente, devuelve imagen MCP y `rendered:false, render_required:true`; no publica ni emite. El editor compone y renderiza. `adaptacion_plan` sigue siendo sólo planificación; no confundirlo con MP4 producido.

## English

Open [Altadis in Admira Studio](https://www.admira.studio/en/adaptaciones/?proyecto=altadis). The `altadis-estancos-bcn` project preserves **24 flat/MyBlu formats and five segmented walls** with stable IDs and unchanged PDF transcriptions.

1. Choose Stock content or upload a file; click **Adapt**.
2. Select a format and shop under **AI adaptation · apply in Shops**. The shop view is virtual.
3. **Generate AI background** optionally uses your scene brief and a reduced reference frame/image, with your authenticated session and the existing Gemini `/image/edit` engine. Provider credit may be used. Cancel is available; timeout is 90 seconds. Errors preserve the original and are not reported as success.
4. The AI background is static and fitted to exact physical-wall dimensions. The original is scaled and composited in front; its products, lettering and logos are not regenerated. Review the background. This is not temporal video outpainting or a guarantee of native model resolution.
5. **Apply shop demo** saves an additional virtual surface in this browser, adding it to the shop package. **Remove demo** preserves P1/P2. No player is scheduled by this action.
6. **Save formats and placements** downloads the portable JSON contract with all 29 formats, geometries, source shop map, virtual assignments and settings. Save the AI background separately; backgrounds belong to the current content/session and clear on source/project changes or reload. Exported MP4 files embed the background permanently.
7. Export a format or prepare selected shop packages. Compose one physical wall before cutting all screens and delivery atlas. H.264, 25 fps; all segments share duration; unused atlas cells remain black. New manifest rows explicitly identify virtual demo placements. Stock publication and real scheduling remain separate actions.

The table above preserves original wall/atlas measurements and PDF ambiguities (5x1 typo; 9 vs 11 screens; inferred Córdoba physical layout). Nine shops and 18 base screens are demo data; installed wall hardware remains unconfirmed.

Shared real MCP: `altadis_formatos {}` is read-only; `fondo_adaptacion_ia {image,ancho,alto,brief?}` requires existing fleet authentication and returns an image with rendering still required. Neither publishes nor emits. The web editor renders; `adaptacion_plan` remains plan-only. Canonical implementation is in repository `csilvasantin/pixeria`; Studio is generated by its mirror contract.

## Estado verificado y continuación / Verified state and continuation

**7-oct-2026 · OraculoMacMini · MacMini.** Publicado en `https://admira.studio/adaptaciones/?proyecto=altadis`. Generación real Gemini completada con una imagen neutra de Stock (`1791230658801-jnv969`, café sin texto) y fondo de madera cálida. Vista del `cliente-esp-2` aplicada y guardada en `altadis-bcn-001` (Estanc Gran de Gràcia 61); se recupera al abrir una página nueva, también en inglés. Contrato descargado comprobado: 29 formatos, nueve estancos y una aplicación virtual. El fondo se guarda aparte; no es persistencia global del contenido ni emisión física.

Validación: 35 pruebas del adaptador, incluidas codificación FFmpeg real de atlas/segmentos y ZIP; 17 pruebas del MCP; ocho pruebas de autenticación del motor. La exportación pública FFmpeg/WASM del navegador no se ha comprobado de extremo a extremo. Se verificó el contrato público del MCP y la generación web; la generación MCP de pago no se ejecutó por separado.

Referencias: commit `8b733d52` · adaptación IA y contratos Altadis (repositorio `csilvasantin/pixeria`); commit `099d8ab` · Studio Altadis IA en Estancos; commit `63e3679` · contratos y fondo IA MCP; commit `7f58e58` · verificar firma propia de Studio (pixer-worker). El motor comprueba los tokens de Studio en su verificador de origen fijo `https://admira.studio/auth/verify`; el Origin por sí solo no autoriza. Credenciales no se guardan en los contratos. La revisión automática rechazó el despliegue web del repositorio `csilvasantin/pixeria`: fuente incorporada en Git, Studio publicado independientemente. Los cambios concurrentes de vista por cliente se han preservado.

Siguiente aceptación de hardware: confirmar las ambigüedades del PDF con Altadis, identificar controladores/superficies reales y resolver sincronización/programación antes de emitir. No sustituir el mapa demo por inventario confirmado sin evidencia.

**7 Oct 2026 · OraculoMacMini · MacMini.** A real Gemini background was generated publicly from neutral Stock coffee imagery; the 6×1 wall is visible in the virtual shop. Saved placement survives a new page and is shown in English. Downloaded JSON checked: 29 formats, nine shops, one virtual placement. AI background remains a separate session asset.

Validation: 35 adapter tests (real FFmpeg atlas/segments and ZIP), 17 MCP tests, eight image-engine authentication tests. Browser FFmpeg/WASM export was not checked end to end. Public MCP contract and web generation verified; paid MCP generation not exercised separately. Implementation references are listed above. The website rollout for repository `csilvasantin/pixeria` was rejected by automatic review; canonical code is in Git and Studio was published independently. Confirm PDF geometry and installed hardware before real scheduling or synchronized emission.


## Visitar demo / Visit demo

ES: «Visitar demo», junto a «Aplicar demo al estanco», abre el gemelo con el formato y estanco seleccionados y reproduce el contenido actual, también el fondo IA. No hace falta guardar la aplicación primero; sigue disponible después de aplicarla.

EN: “Visit demo”, beside “Apply shop demo”, opens the twin with the selected format and shop and plays current content, including the AI background. Saving a placement first is optional; the button remains available after applying it.

Tutorial ES: elegir contenido → Adaptar → seleccionar Formato y Estanco → **Visitar demo** → cerrar/Esc. Tutorial EN: choose content → Adapt → select Format and Shop → **Visit demo** → close/Esc. Vídeo/GIF se reanuda en silencio y al cerrar restaura la pausa previa. Video/GIF resumes silently and closing restores its previous paused state. Sin contenido válido el botón está desactivado / Without valid content the button is disabled.

## Ver en gemelo digital / View in digital twin

Cada tarjeta adaptada incluye «Ver en gemelo digital». Abre un estanco 3D en un diálogo, con las pantallas de ese formato y el contenido actual (también fondo IA, vídeo y GIF). Elige el estanco, gira la vista o acércate; Esc vuelve al editor. Los videowalls especiales usan la pared física, nunca el atlas de entrega; todas las pantallas comparten un fotograma. Es una simulación local de distribución, no una reproducción del local escaneado ni una programación de players. No envía el contenido, no genera IA ni guarda una aplicación al abrirlo.

Every adapted card includes “View in digital twin”. It opens a 3D shop dialog showing that format’s screens with current content (including AI background, video and GIF). Choose the shop, rotate or zoom; Esc returns to the editor. Segmented walls use physical geometry, never the delivery atlas; every screen shares one frame. This is a local layout simulation, not a scanned replica or player scheduling. Opening it does not send media, generate AI or save a placement.

Tutorial ES: elegir contenido → Adaptar → debajo del formato, **Ver en gemelo digital** → seleccionar estanco → arrastrar/flechas para girar y rueda/＋/− para acercar → **De frente** o **Vista inicial** → cerrar/Esc. Tutorial EN: choose content → Adapt → **View in digital twin** under the format → choose shop → drag/arrows to rotate and wheel/＋/− to zoom → **Front view** or **Reset view** → close/Esc. Sin fuente válida el botón está desactivado / Without valid media the button is disabled.

Contrato: `adaptaciones/gemelo-core.mjs` calcula segmentos y recortes contiguos; `gemelo-digital.mjs` muestra la simulación con Three.js r160 local (licencia MIT en `adaptaciones/vendor/three.LICENSE`). Las tarjetas estándar, sociales, personalizadas y especiales incluyen el botón; la tarjeta original no es una adaptación. Las dimensiones son nativas; las texturas de vista se reducen para el navegador. No son archivos exportados ni prueba de emisión. IDs Altadis y las nueve ubicaciones existentes se conservan; elegir estanco usa ese nombre/ID con un interior representativo, sin inventar medidas físicas del establecimiento. Fondos IA y ajustes se leen de la misma composición del editor; cerrar elimina recursos WebGL y devuelve el foco al botón. El vídeo mantiene el reloj del editor, sin un segundo audio.

Standard video wall names with `NXM` give columns/rows for a demo grid. Single surfaces retain the complete native aspect. LED cube without face metadata is shown as one flat surface, not a fabricated cube net. The PDF’s `cliente-22` (2X3 H, 2880×1080) has an inconsistent name/aspect: keep the named 2-column/3-row grid and visibly flag confirmation. Special walls preserve existing PDF ambiguities. No installed hardware or production XpaceOS state is modified.

Las rejillas estándar se deducen del nombre `NXM` como columnas/filas de demo. LED cubo sin medidas de caras se muestra plano. `cliente-22` mantiene 2 columnas/3 filas con aviso de discrepancia entre nombre y proporción. Confirmar con Altadis antes de instalar. Esta vista local no carga ni altera el estado vivo del gemelo XpaceOS.


### Verificación pública del botón / Public button verification

7-oct-2026: comprobados en Studio los botones de cada tarjeta visible, una pantalla horizontal (1920×1080), pared de seis (3840×360) y trece verticales (7020×960). Selector entre los nueve estancos, vista frontal/inicial, zoom, flechas y Esc. Imagen neutra del Stock y receta animada; vídeo de la biblioteca 365. Abrir reanuda temporalmente el vídeo/GIF del editor en silencio; al cerrar se restaura su pausa previa (sin un segundo player ni audio). El módulo WebGL carga sólo al abrir; si falta WebGL muestra error. 39 pruebas del adaptador (incluyendo FFmpeg/ZIP real y cortes del gemelo), 17 del MCP; el contrato MCP público devuelve ayuda y modo de vista ES/EN. El resto de la exportación WASM pública conserva el límite documentado anteriormente.

7 Oct 2026: public buttons checked for single landscape, six landscape and thirteen portrait screens; nine-shop selector, front/reset, zoom, arrow rotation and Esc. Neutral Stock image/animated recipe and existing 365 library video used. Opening temporarily resumes the editor's video/GIF silently; closing restores its previous paused state. No duplicate player/audio. WebGL loads on demand and failure is visible. Adapter: 39 tests (including real FFmpeg/ZIP and twin cuts); MCP: 17 tests and public ES/EN contract verified. Existing browser-WASM export verification limitation still applies.
