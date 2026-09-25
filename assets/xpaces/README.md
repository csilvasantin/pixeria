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
