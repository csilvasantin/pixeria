# Furniture — FLT-101042 / #4376

The existing Assets → Edición → «Edición de muebles · pixel art» card now lists
Stock furniture, alongside owned pixel furniture. Its first three entries expand
to the full 3D library. No additional product section or Cloudflare infrastructure
was introduced. Stock's existing `furni` type is the furniture type; MIME
`model/gltf-binary` distinguishes it from pixel sprites. Furniture GLBs are excluded
from the whole-space Xpaces filter.

## Source and publication

45 unique GLBs represent 66 inventory objects from #4375: 29 Alsea assets and
16 Xtanco assets. Architecture is excluded; movable furniture, equipment, screens,
plants, lighting (including distinct perimeter segments) and IoT equipment are
included. Repeated chairs, stools, tables, pendants, plants and speakers have one
asset with `quantity` and all associated `inventoryIds`. Screen content differences
are retained. Every item links to its source Xpace, measurement inventory IDs and
source measurement URL. Manufacturer/model/warranty are not invented.

`catalog.json` is a verified seed manifest of real published Stock assets, with
IDs, download URLs, posters and binary SHA-256. The live complete Stock index adds
new variants across devices. A replacement deep link can fetch the exact metadata
by ID if the index has not caught up yet. JSON metadata uses Stock's existing
`prompt` field (`pixeria.furniture/1`), plus `externalRef`; the GLBs also embed it.

Exports use Blender CLI `-b`, preserve named materials and the metric geometry,
remove placement from the source store, and place the origin at the centre of the
base. Dimensions are actual exported geometry envelopes, including feet, brackets
and suspension cables; these can differ from the nominal item measurements in
#4375. No scaling is used to hide those differences. The verifier reimports every
GLB; `--update-metadata` reconciles evaluated geometry bounds before publication.

```sh
Blender -b /path/alsea.blend --python scripts/export-furniture.py -- alsea /path/out
Blender -b /path/xtanco.blend --python scripts/export-furniture.py -- xtanco /path/out
Blender -b --python scripts/verify-furniture-exports.py -- /path/out --update-metadata
Blender -b --python scripts/verify-furniture-exports.py -- /path/out
python3 scripts/publish-furniture.py /path/out
```

Each `.blend` must have its delivered `.glb` beside it, used to resolve the exact
node indices in the #4375 inventory manifests. Publication verifies public bytes
against the submitted hash and checkpoints each confirmed item. The existing Stock
content-hash deduplication makes retries idempotent.

## Editor and replacement

The viewer reuses Better's bundled Three r160, scene, renderer, controls and lighting.
An optional furniture camera frame uses metric object bounds instead of room margins.
The r160 GLTFExporter and TextureUtils have only their module imports redirected to
the same bundled Three; provenance is recorded in `engine/upstream.json`.

The editor supports a name, material colours, original/no texture, kit textures
(roble/nogal/terrazo), uploaded PNG/JPEG/WebP (up to 10 MB), and width/depth/height in
centimetres with proportional or free dimensions. Save exports a fresh GLB with
embedded materials/textures and a new poster, publishing a new Stock item. It never
uses the original asset's replacement/update endpoints. Parent and original IDs are
retained. Save failures remain visible and controls unlock for retry.

Each inventory row offers its original and linked furniture variants. The geometry
is placed at that individual source object's base and orientation. Selection,
hide/show, original restoration, dimensions and JSON/CSV export follow the selected
variant. The URL's `xvariant-<xpace-id>` mapping persists the chosen replacements and
can be shared; the delivered source GLB stays intact. Downloading the original
Xpace GLB continues to download that source. Edited furniture itself is a standalone
GLB available in Stock. No server-side rewrite of the source Xpace is implied.

## Verification

- Blender reimport: all 45 GLBs, 66 inventory IDs, base at zero, named materials,
  centred bounds and dimensions within 0.005 cm of recorded envelopes.
- `node --test test/furniture.test.mjs test/xpace-inventory.test.mjs test/xpaces.test.mjs test/stock-deep-link.test.cjs test/auth-flow.test.mjs`
- `scripts/verify-furniture.cjs`: desktop and 390×844 touch emulation, proportional
  and independent sizing, kit/uploaded texture, colours, save, original hash,
  replacement in Xpace, restoration, visibility, URL reload, overflow and JS errors.
  `SAVE_VARIANT=1` publishes one demonstration chair only if the QA directory has
  no `variant.json`; routine runs reuse that saved variant.
- Demonstration: original Alsea chair 45×45×85 cm → blue chair 45×45×95 cm,
  Stock `1790368707714-jwgkfk`, replacing only `silla-1` in Alsea.

A second saved example verifies uploaded texture embedding: Xtanco stool, oak
texture and 40×40×85 cm. Reloading its saved GLB retains the uploaded texture.

Final catalogue QA opened all 45 assets in Better, decoded all posters, and matched
all displayed dimensions to the exported envelopes. Fifteen source placements
(including rotated chairs/screens and IoT) match the source bounds within 2 cm.
The existing inventory browser suite also passes in ES/EN and desktop/mobile.
