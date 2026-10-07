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

Tutorial ES: elegir contenido → Adaptar → debajo del formato, **Ver en gemelo digital** → seleccionar estanco → arrastrar/flechas para girar y rueda/＋/− para acercar → **De frente** o **Isométrica** → cerrar/Esc. Tutorial EN: choose content → Adapt → **View in digital twin** under the format → choose shop → drag/arrows to rotate and wheel/＋/− to zoom → **Front view** or **Isometric** → close/Esc. Sin fuente válida el botón está desactivado / Without valid media the button is disabled.

Contrato: `adaptaciones/gemelo-core.mjs` calcula segmentos y recortes contiguos; `gemelo-digital.mjs` muestra la simulación con el motor compartido Xpaces y Three.js r160 local (licencia MIT); `gemelo-catalog.mjs` declara las referencias y sus montajes de ensayo. Las tarjetas estándar, sociales, personalizadas y especiales incluyen el botón; la tarjeta original no es una adaptación. Las dimensiones son nativas; las texturas de vista se reducen para el navegador. No son archivos exportados ni prueba de emisión. IDs Altadis y las nueve ubicaciones existentes se conservan; elegir estanco usa ese nombre/ID con un interior representativo, sin inventar medidas físicas del establecimiento. Fondos IA y ajustes se leen de la misma composición del editor; cerrar elimina recursos WebGL y devuelve el foco al botón. El vídeo mantiene el reloj del editor, sin un segundo audio.

Standard video wall names with `NXM` give columns/rows for a demo grid. Single surfaces retain the complete native aspect. LED cube without confirmed face metadata uses a four-face trial prism; this does not establish real cube dimensions or a delivery net. The PDF’s `cliente-22` (2X3 H, 2880×1080) has an inconsistent name/aspect: keep the named 2-column/3-row grid and visibly flag confirmation. Special walls preserve existing PDF ambiguities. No installed hardware or production XpaceOS state is modified.

Las rejillas estándar se deducen del nombre `NXM` como columnas/filas de demo. LED cubo sin medidas de caras confirmadas usa un prisma de ensayo de cuatro caras; no confirma dimensiones reales ni una red de entrega. `cliente-22` mantiene 2 columnas/3 filas con aviso de discrepancia entre nombre y proporción. Confirmar con Altadis antes de instalar. Esta vista local no carga ni altera el estado vivo del gemelo XpaceOS.


### Verificación pública del botón / Public button verification

7-oct-2026: comprobados en Studio los botones de cada tarjeta visible, una pantalla horizontal (1920×1080), pared de seis (3840×360) y trece verticales (7020×960). Selector entre los nueve estancos, vista frontal/inicial, zoom, flechas y Esc. Imagen neutra del Stock y receta animada; vídeo de la biblioteca 365. Abrir reanuda temporalmente el vídeo/GIF del editor en silencio; al cerrar se restaura su pausa previa (sin un segundo player ni audio). El módulo WebGL carga sólo al abrir; si falta WebGL muestra error. 39 pruebas del adaptador (incluyendo FFmpeg/ZIP real y cortes del gemelo), 17 del MCP; el contrato MCP público devuelve ayuda y modo de vista ES/EN. El resto de la exportación WASM pública conserva el límite documentado anteriormente.

7 Oct 2026: public buttons checked for single landscape, six landscape and thirteen portrait screens; nine-shop selector, front/reset, zoom, arrow rotation and Esc. Neutral Stock image/animated recipe and existing 365 library video used. Opening temporarily resumes the editor's video/GIF silently; closing restores its previous paused state. No duplicate player/audio. WebGL loads on demand and failure is visible. Adapter: 39 tests (including real FFmpeg/ZIP and twin cuts); MCP: 17 tests and public ES/EN contract verified. Existing browser-WASM export verification limitation still applies.

## Referencias de estancos y Best / Shop references and Best

ES: El gemelo arranca en Best e isométrica; Calidad permite volver a Better. Referencia elige automáticamente el estanco de ensayo recomendado para cada formato y permite cambiarlo sin cambiar el estanco OSM. Cinco familias cubren los 29 formatos Altadis y la sexta referencia permite un ensayo de esquina de 90°. Se conserva la geometría física y un mismo fotograma del editor para todas las pantallas, también con fondo IA. Planta, De frente, órbita, zoom y luz de día/atardecer/noche siguen disponibles. Punto de observación usa perspectiva FOV 55° con altura, distancia y lateral ajustables en metros. Las referencias son interiores representativos de ensayo, no levantamientos de los nueve locales. La vista permite revisar contenido anamórfico existente; no genera ni exporta su deformación y no emite en hardware.

EN: The twin starts in Best and isometric view; Quality lets you return to Better. Reference automatically chooses the recommended trial shop for each format and can be changed independently of the OSM shop. Five families cover all 29 Altadis formats and a sixth reference provides a 90-degree corner trial. Physical geometry and a single editor frame are retained across all screens, including the AI background. Floor/front views, orbit, zoom and day/sunset/night lighting remain available. Observation point uses 55-degree FOV perspective with adjustable height, distance and lateral offset in metres. References are representative trial interiors, not measured models of the nine shops. The preview tests existing anamorphic content; it does not generate or export its warp and does not emit to hardware.

Tutorial ES: contenido → Adaptar → Formato y Estanco → Visitar demo (o Ver en gemelo digital en la tarjeta) → Calidad Best/Better → Referencia Automática o una referencia de ensayo → Isométrica, Planta o De frente → Punto de observación para ajustar Altura, Distancia y Lateral → cerrar/Esc. Cambiar Referencia no cambia el local seleccionado; cambiar formato vuelve a elegir su referencia recomendada.

Tutorial EN: content → Adapt → Format and Shop → Visit demo (or View in digital twin on the card) → Quality Best/Better → Reference Automatic or a trial reference → Isometric, Floor plan or Front view → Observation point to adjust Height, Distance and Lateral → close/Esc. Changing Reference does not change the selected shop; changing format selects its recommended reference again.

### Punto de observación de esquina / Corner observation point

ES: En la referencia Esquina cóncava, Punto de observación mira al vértice del pliegue. La segunda cara gira −90°, sin reflejar U, que continúa hacia +Z; ambas caras miran al interior. Por defecto el ojo está a 45° con X negativo y Z positivo, con altura 1,65 m, distancia horizontal radial base de 3 m y lateral 0. El rango de Distancia es 1,5–3,6 m; Lateral desplaza el ojo en X. Pared plana y colocación legacy conservan Distancia como separación en Z. Es una vista de ensayo, sin calibración anamórfica del local.

EN: In the concave Corner reference, Observation point aims at the fold vertex. The second face rotates −90° without mirroring U, which continues along +Z; both faces face inward. By default the eye is at 45° toward negative X and positive Z, with 1.65 m height, 3 m base horizontal radial distance and zero lateral offset. Distance ranges from 1.5–3.6 m; Lateral shifts the eye along X. Flat walls and legacy placement retain Distance as a Z offset. This is a trial view, without calibrated shop anamorphosis.

### Recorrer todos los formatos / Tour all formats

ES: Formato dentro del gemelo permite elegir cualquiera de los 29 formatos, con Anterior y Siguiente. Recorrer formatos es un interruptor que inicia sólo al pulsarlo: cambia cada 8 segundos y vuelve al principio al terminar. Cada paso usa la referencia automática recomendada, reutiliza el modelo ya cargado y el reloj del contenido. Cualquier interacción manual, incluida la rueda para zoom o cambiar el estanco OSM, o cerrar el diálogo detiene el recorrido; no programa hardware.

EN: Format inside the twin offers all 29 formats, with Previous and Next. Run format tour is a toggle that only starts when clicked: it changes every 8 seconds and loops after the last format. Each step uses its recommended automatic reference, reuses the loaded model and content clock. Any manual interaction, including wheel zoom or changing the OSM shop, or closing the dialog stops the tour; it does not schedule hardware.

Tutorial ES: abrir el gemelo → Formato para elegir directamente, Anterior/Siguiente para comparar → Recorrer formatos para iniciar la demostración → pulsar de nuevo o interactuar para detener → cerrar/Esc. EN: open the twin → choose directly from Format, use Previous/Next to compare → Run format tour to start the demonstration → click again or interact to stop → close/Esc.

Contrato / contract: `format_selection` conserva los 29 IDs originales del proyecto; `tour:{user_initiated:true,interval_seconds:8,loops:true,single_model_load:true}`. No arranca al abrir y no añade otro reproductor, petición IA o carga de GLB por formato. Changing quality may load its declared model separately; the tour itself reuses one loaded model. Recorrer formatos es una demostración del editor, no una tarea recurrente ni una playlist de players. Run format tour is an editor demonstration, not a scheduled task or hardware playlist.

### Cobertura de referencias / Reference coverage

| ID estable / Stable ID | Referencia ES / EN | Formatos recomendados / Recommended formats |
|---|---|---|
| `mostrador` | Estanco · Mostrador / Shop · Counter | `cliente-01`, `cliente-02`, `cliente-04`, `cliente-07`, `cliente-20` |
| `mural` | Estanco · Mural videowall / Shop · Video wall | `cliente-03`, `cliente-05`, `cliente-06`, `cliente-14`, `cliente-15`, `cliente-16`, `cliente-17`, `cliente-22`, `cliente-24`, `cliente-esp-1` a / through `cliente-esp-5` |
| `columna` | Estanco · Columna y góndola / Shop · Column and gondola | `cliente-10`, `cliente-11`, `cliente-12`, `cliente-13`, `cliente-21`, `cliente-23` |
| `superstretch` | Estanco · Superstretch / Shop · Superstretch | `cliente-09`, `cliente-18`, `cliente-19` |
| `cubo` | Estanco · Cubo LED (ensayo) / Shop · LED cube (trial) | `cliente-08` |
| `esquina` | Estanco · Esquina anamórfica (ensayo) / Shop · Anamorphic corner (trial) | Selección manual opcional / Optional manual selection |

ES: Mostrador combina pantalla de caja y soporte de tótem. Mural admite rejillas y los cinco videowalls especiales. Columna permite bandas verticales y MyBlu; Superstretch, bandas horizontales largas. Cubo mantiene las cuatro caras como ensayo con sus píxeles nativos. La elección Automática sigue el ID estable del formato y no su nombre comercial. EN: Counter combines a counter display and a totem support. Video wall accommodates grids and all five special layouts. Column accommodates vertical strips and MyBlu; Superstretch provides long horizontal strips. Cube retains the four faces as a native-pixel trial. Automatic selection follows the stable format ID rather than its commercial name.

### Motor, calidad y recursos / Engine, quality and assets

ES: Se reutiliza el motor Xpaces `assets/xpaces/engine/life-renderer.mjs` con la escena base `life-scene.mjs` y Three r160. El selector Calidad separa la elección de modelo de la elección de referencia: Best es el inicio y Better conserva el modelo anterior. No basta con cambiar una etiqueta de calidad: cada nivel carga su GLB declarado y verifica su SHA-256 antes de mostrarlo.

EN: The shared Xpaces `assets/xpaces/engine/life-renderer.mjs`, base scene `life-scene.mjs` and Three r160 are reused. Quality separates model choice from reference choice: Best is the initial level and Better preserves the previous model. A quality label alone is insufficient: each level loads its declared GLB and verifies its SHA-256 before displaying it.

Better conservado / preserved: modelo `xtanco-4380`, Stock `1790370139269-2ty118`, URL estable / stable URL https://api.admira.store/stock/asset/1790370139269-2ty118; SHA-256 `a6a670ad3edebb9b3a56e22707b4bb89dabb4ad000ced9eec3fc51cbe91b2706`, comprobado contra el inventario / checked against the inventory.

Recursos Best publicados en Stock / Best assets published in Stock:

- GLB `1791411065310-v2jraa` · estanco Best para el gemelo: https://api.admira.store/stock/asset/1791411065310-v2jraa. / Best shop for the twin.
- PNG `1791411162545-wd1dt7` · render Cycles del estanco Best: https://api.admira.store/stock/asset/1791411162545-wd1dt7; 1600×1000, SHA-256 `aa48d271e48eeb6bd86f6a77d8244f91a17fa45a4068697bf6d784a2da488a98`. Render offline de referencia; no es captura del visor WebGL ni prueba de contenido reproducido. / Offline Cycles reference render; not a WebGL viewer screenshot or playback evidence.
- Blender editable `1791411076540-afplfh` · fuente Best para continuar el modelo: https://api.admira.store/stock/asset/1791411076540-afplfh; 6.298.649 bytes, SHA-256 `eda59372a911b37c29cce69c4721205ffa2cd2e304f4d899f2480ca0c4aec3a1`. / Editable Best source for continuing the model.

Best: modelo derivado `xtanco-best-studio-20261008`, SHA-256 `77b4f4c7346c0dacf22c3d8573f1d80536d367d3b64874115443c1b420edbb85`, 13.035.628 bytes. Añade geometría refinada con biseles/curvas, herrajes y frontales de producto ilustrativos; conserva IDs y medidas de la referencia Xtanco. Ocho materiales incluyen mapas originales procedurales de normal y rugosidad; los mapas de color tienen 1024 px, normales 768 px y rugosidad 512 px, con atlas 1536×512. No incluye AO/GI horneado ni captura del local real; las etiquetas son genéricas. `KHR_mesh_quantization` reduce datos de normales/tangentes sin alterar posiciones, UV o transformaciones. Los recursos y hashes publicados están declarados en `model_assets.best`; su verificación de descarga no implica aceptación visual de todas las combinaciones.

Best is a derived `xtanco-best-studio-20261008` model with the SHA-256 and size above. It adds refined bevel/curve geometry, hardware and illustrative product fronts while preserving reference Xtanco IDs and dimensions. Eight materials include original procedural normal and roughness maps: 1024 px colour, 768 px normals and 512 px roughness, with a 1536×512 atlas. There is no baked AO/GI or actual shop capture; labels are generic. `KHR_mesh_quantization` reduces normal/tangent data without changing positions, UVs or transforms. Published resources and hashes are declared in `model_assets.best`; download verification does not imply visual acceptance of every combination.

### Geometría de ensayo y límites / Trial geometry and limits

ES: Las medidas del formato están en píxeles; el tamaño físico mostrado es de ensayo y conserva su proporción. Cada referencia dispone las superficies según su familia; no usa el atlas de entrega como pared. Los cortes conservan cobertura y orden de los píxeles. LED cubo sólo permite un prisma de ensayo de cuatro caras, sin confirmar dimensiones o correspondencia real de caras. Las ambigüedades PDF siguen visibles. La esquina es un pliegue virtual de 90° para observar contenido existente y conserva orientación UV; no cambia las exportaciones.

EN: Format dimensions are pixels; displayed physical dimensions are trial dimensions retaining aspect ratio. Each reference arranges surfaces for its family; the delivery atlas is never treated as a wall. Cuts preserve pixel coverage and order. LED cube only provides a four-face trial prism, without confirming real face dimensions or mapping. PDF ambiguities remain visible. The corner is a virtual 90-degree fold for viewing existing content, retains UV orientation and leaves exports unchanged.

ES: Best y Better son referencias derivadas de Xtanco, no fotogrametría ni un levantamiento de cada estanco. Seleccionar uno de los nueve nombres OSM no convierte esta referencia en el interior medido de ese local. Vídeo/GIF sigue el reloj del editor; se reanuda temporalmente en silencio y se restaura su pausa al cerrar. Fondo IA y ajustes se leen de la composición actual. Cambiar referencia o calidad no genera IA, guarda aplicaciones, sube medios, emite ni modifica el estado vivo XpaceOS.

EN: Best and Better are Xtanco-derived references, not photogrammetry or measured models of each shop. Choosing one of the nine OSM names does not make the reference a measured interior of that shop. Video/GIF follows the editor clock, temporarily resumes silently and restores its previous pause on close. AI background and settings use the current composition. Changing reference or quality does not generate AI, save placements, upload media, emit or alter live XpaceOS state.

Dependencias: WebGL, GLB disponible y SHA-256 válido. Un fallo muestra error; no cambia silenciosamente de calidad. Pendiente: warp anamórfico calibrado y exportación automática, modelos medidos por local y confirmación de ambigüedades PDF. Dependencies: WebGL, available GLB and valid SHA-256. Failure is visible; quality never silently changes. Pending: automatic calibrated anamorphic warp/export, measured per-shop models and PDF ambiguity confirmation.

### Montajes y mobiliario / Mounts and fixtures

ES: El catálogo publica habitaciones de ensayo en metros con origen arquitectónico y altura de 3 m. Mural y Superstretch amplían el espacio a 8 m de ancho sin estirar el mobiliario; las otras referencias conservan 6 m. La profundidad es 4,5 m. Son dimensiones de la referencia, no medidas Altadis. Cada `mount.zone` reserva espacio para pantallas y marcos; `supports` describe su soporte. La política `fixturePolicy` permite desplazar sólo la planta, los taburetes y las lámparas colgantes indicadas cuando invaden esa zona. Conserva ID, escala y rotación, mueve el grupo semántico completo sólo en X/Z y registra `nodeName`, `from`, `to` y `reason`. Mostrador, vitrina, expendedora, TPV y arquitectura se conservan; se sustituye la pantalla de pared para el ensayo. Al cambiar referencia se restaura la fuente antes de redistribuir.

EN: The catalogue declares trial rooms in metres with an architectural origin and 3 m height. Video wall and Superstretch extend room width to 8 m without stretching furniture; the other references retain 6 m. Depth is 4.5 m. These are reference dimensions, not Altadis measurements. Each `mount.zone` reserves space for screens and frames; `supports` declares their support. `fixturePolicy` only allows the declared plant, stools and pendant lights to move when they overlap that zone. It preserves IDs, scale and rotation, moves each complete semantic group only on X/Z and records `nodeName`, `from`, `to` and `reason`. Counter, cabinet, vending machine, POS and architecture are retained; the wall display is replaced for the trial. Changing reference restores the source before rearranging fixtures.

### Contrato y continuación para agentes / Agent contract and continuation

ES: `mcp/adapter-manifest.json` y la respuesta de `altadis_formatos {}` del MCP real describen `quality:"best"`, `default_quality:"best"`, `available_qualities:["best","better"]`, catálogo de referencias y recomendación por formato. `reference_asset` conserva el recurso Better por compatibilidad; `model_assets` identifica cada calidad sin sustituir IDs de formato ni de local. El catálogo canónico es `adaptaciones/gemelo-catalog.mjs`; su copia MCP `src/altadis-referencias.json` se genera con el mismo catálogo y los recursos publicados; los formatos originales, sus atlas y las nueve ubicaciones mantienen sus contratos. La cobertura 29/29 es asignación de referencias de ensayo, no certificación de instalación física.

EN: `mcp/adapter-manifest.json` and the real MCP `altadis_formatos {}` response describe `quality:"best"`, `default_quality:"best"`, `available_qualities:["best","better"]`, reference catalogue and per-format recommendations. `reference_asset` retains the Better asset for compatibility; `model_assets` identifies each quality without replacing format or shop IDs. The canonical catalogue is `adaptaciones/gemelo-catalog.mjs`; the MCP `src/altadis-referencias.json` copy is generated from the same catalogue and published assets; original formats, atlases and nine locations retain their contracts. 29/29 coverage means trial-reference assignment, not physical-installation certification.

Estado de esta ampliación / status of this extension: validación local del editor: 37 pruebas pasan y una prueba FFmpeg se omite; MCP: 20 pruebas pasan; modelo: 68 de 68 comprobaciones independientes. Catálogo, manifiesto y copia MCP coinciden. Los recursos Best están publicados en Stock y sus hashes verificados; esto no establece el estado público del editor o servidor MCP ampliados. Consulta [version.json de Studio](https://admira.studio/version.json) y el informe final de la misión `DCL-b02c2166a3617f055d666826` · Studio referencias y modelo Best para el estado exacto de publicación y pruebas públicas. No extrapolar la verificación Better anterior a un GLB Best nuevo. / Local editor validation: 37 tests pass and one FFmpeg test is skipped; MCP: 20 tests pass; model: 68 of 68 independent checks. Catalogue, manifest and MCP copy agree. Best assets are published in Stock and hashes verified; this does not establish publication of the extended editor or MCP server. Consult [Studio version.json](https://admira.studio/version.json) and the final report for mission `DCL-b02c2166a3617f055d666826` · Studio references and Best model for exact deployment status and public checks. Previous Better verification is not evidence for a new Best GLB.

Para actualizar la copia MCP desde un manifiesto aprobado / To refresh the MCP copy from an approved manifest: en el checkout MCP, `node --input-type=module -e 'import fs from "node:fs"; const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); fs.writeFileSync("src/altadis-referencias.json",JSON.stringify(m.digital_twin,null,2)+"\n")' /ruta/canonica/mcp/adapter-manifest.json`, después / then `npm test`. La validación de catálogo y el manifiesto debe preceder a esta copia; publicar MCP y Studio juntos y comprobar ambos contratos públicos. Catalogue and manifest validation must precede the copy; publish MCP and Studio together and verify both public contracts.
