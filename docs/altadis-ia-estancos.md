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

Módulos fuente Pixeria: `adaptaciones/ia-core.mjs`, `studio-adaptaciones.mjs`, `aplicaciones-core.mjs`, `especiales-core.mjs`, `estancos-core.mjs`. Admira Studio se genera mediante `marca.json` + `sync.sh --aplicar` desde `origin/main` de Pixeria; no editar el espejo a mano.

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

Shared real MCP: `altadis_formatos {}` is read-only; `fondo_adaptacion_ia {image,ancho,alto,brief?}` requires existing fleet authentication and returns an image with rendering still required. Neither publishes nor emits. The web editor renders; `adaptacion_plan` remains plan-only. Canonical implementation is in Pixeria; Studio is generated by its mirror contract.
