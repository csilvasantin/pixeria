# Xpaces — FLT-101038 / #4371

Better's deployed module chain was traced on 25 September 2026:
`xtanco-premium-ui.mjs → life-ui.mjs → life-renderer.mjs → life-scene.mjs`,
using `premium-three.mjs` (Three.js revision 160). GLTFLoader comes from the
same deployed `admira-xp/scripts/vendor/` directory.

`engine/upstream.json` records the public source URL and SHA-256 of each downloaded
module. All modules are byte-identical except `life-renderer.mjs`: two optional
parameters allow the Stock scene factory and camera range/presets. Static GLB shadows
are refreshed on load or lighting changes, rather than redrawn on every camera frame. Defaults retain
Better's behavior. Rendering, damping, pointer/wheel handling, DPR cap, tone mapping,
resource teardown, lights and lighting presets remain Better's implementation.
No second renderer, OrbitControls or model-viewer was introduced.

`viewer.mjs` loads the GLB, preserves its metric scale, moves its bounding-box origin
to (0,0,0), and inserts it into Better's inventory scene (without procedural shop
architecture). For static GLBs, opaque meshes sharing a material are batched with
the same bundled Three r160 mergeGeometries utility; transparent/animated meshes
are preserved. It adds UI, a touch-friendly pan toggle and cancellation when the
user closes or switches models. The renderer is lazy-loaded only upon opening.

`catalog.mjs` selects GLB + exact 3d tag, associates editable Blender files by
externalRef, and links the verified older Xtanco delivery explicitly because that
upload has no externalRef or poster metadata. Future GLB uploads appear automatically;
use a shared externalRef for the GLB, its Blender source and an isometric render,
and publish poster/thumbnail metadata. Ambiguous Blender matches stay unavailable.

Entry: `/stock.html?type=xpaces` (also `/en/stock.html?type=xpaces`).
Deep link: add `&highlight=<stock-id>`. Existing Pixeria Google access is unchanged.

## Verification

- `node --test test/xpaces.test.mjs test/stock-deep-link.test.cjs test/auth-flow.test.mjs`: 13 passing.
- `scripts/verify-xpaces.cjs`: both assets, decoded render thumbnails, three views,
  orbit, pan, pinch gestures, zoom, day/night, GLB/BLEND download filenames and hashes,
  close/dispose, ES and EN, desktop and 390×844 touch emulation. Requires Playwright
  (`PLAYWRIGHT_MODULE`) and Chrome (`BROWSER_EXECUTABLE`); serve this root on port 9437.
- `qa-results.json` contains measured results (not a physical-phone benchmark).
- Existing `stock-posters.test.mjs` has one stale thumbnail-only regex assertion;
  the identical failure was reproduced on the pre-change main commit 2a03ce1.

## Inventory — FLT-101041 / #4375

`inventory/alsea.json` and `inventory/xtanco.json` link each measurement ID to
its exact glTF node index. Dimensions and names come from the published rev.1
measurement JSON (source URLs recorded in each manifest); categories come from
`users_collection` in the delivered Blender files. SHA-256 checks prevent a
changed model from silently using an obsolete mapping. There are 34/13 measured
items and 33/41 additional architecture, perimeter lighting and IoT objects.
Additional dimensions are world-space GLB envelopes in metres; the measured
items always use the source JSON dimensions. Each ID represents one unit,
including separately listed chairs/stools/lamps whose source labels mention
an overall group quantity. No commercial fields are inferred.

Batching now happens only within an inventory object. Root visibility therefore
controls all of its geometry while preserving the original materials. Raycasts
skip invisible ancestors; list and model selection share an outline. Visibility
changes also invalidate the static shadow map. All/Nothing applies to the whole
model, including the collapsible additional objects section.

Each inventory row (measured items and additional model objects alike) has a
compact «Ver» button on the right, a sibling of the checkbox so tapping it never
toggles visibility. It makes the item visible if it was hidden, selects it,
scrolls to the 3D stage, animates the existing orbit camera (`frameObject`,
same angle, elevation clamped to 0.35–1.0 rad) so the item's bounding box fits
whole and centred, and flashes a translucent yellow box plus the selection
outline for ~2.4 s. The view link then carries `ver=<id>`; opening it frames
that item again. Selecting another item removes `ver`.


For `estanteria-libros`, «Ver» enters a detail mode instead: frontal camera
(angle π/2, elevation 0.04 rad) filling the stage, with near-plane clipping of
whatever stands between the camera and the shelf. Books are picked with a
raycast (tap or click). The chosen book slides out 4 cm with a yellow outline
and a panel opens over the stage: the capsule video from Stock with sound (the
tap is the user gesture), or its recorded voice-over, or—when Stock has
neither—the capsule text read by the browser's `speechSynthesis` (es-ES), stated
as such. Media are matched by `externalRef: capsula:<id>` or, failing that, by
the exact capsule title (`mediaFor` in capsulas.mjs). «Volver a la estantería»
closes the panel; «Salir del modo detalle» returns to the isometric view.
When Stock has both a vertical (9:16) and a horizontal (16:9) video for a
capsule (`orientacion`, tags or `ancho`/`alto`), the panel plays the vertical
one on a portrait phone and the horizontal one elsewhere (`pickVideo`).
pizarra-3 is untouched.

The URL stores hidden IDs in `xhide-<stock-id>` plus `highlight=<stock-id>`;
separate models retain independent visibility. Exports include only checked
items, with `id`, `nombre`, `tipo`, `categoria`, `cantidad`, metric `medidas`,
`pantalla`, `fabricante`, `modelo`, `garantia` and `origen`. JSON adds schema,
source and a public view URL; CSV flattens the dimensions and uses UTF-8 BOM,
quoted values and CRLF. JSON/CSV saving uses the existing `/stock/publish`
endpoint and Stock's supported `digital-twin` type (MIME identifies the format),
with tags `3d`, `inventario`, `alsea`/`xtanco`. Partial save retries reuse the
confirmed file from that panel to avoid duplicate uploads.

`node --test test/xpace-inventory.test.mjs test/xpaces.test.mjs test/stock-deep-link.test.cjs test/auth-flow.test.mjs`
checks inventory/export/URL rules plus existing viewer and access behavior.
`scripts/verify-xpace-inventory.cjs` exercises both models in desktop, touch/mobile
emulation and English: all measured checkboxes, category tri-state, All/None,
3D picking, reload from URL, real JSON/CSV downloads, close/disposal and overflow.
`PUBLISH_INVENTORIES=1` also publishes the two full inventories via the actual UI;
leave it unset for routine repeat tests. `XPACES_BASE` overrides the local base.
