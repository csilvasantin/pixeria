# Model corrections — FLT-101043 / #4380

TrinityMacMini, 25 September 2026. The espresso machine now has three cylindrical
brewing groups, three projecting handles, six spouts and two steam wands. The drip
tray and fourteen exposed grille bars sit below the groups; the top has a thin
steel cup warmer. Reimported GLB bounds remain 94 × 56.8 × 50 cm. Grinder and glass
hopper geometry are unchanged.

The review covers 48 current catalogue GLBs (66 inventory instances). Corrected:
rear cabinet doors; open cup tops and lamp undersides; bakery tray supports and
pastry contact; vending recess, shelves and fittings; display shelf LEDs and handle
mounts; planter cap and omitted curve stems. Eleven furniture assets were revised.
Both native scenes and complete scene GLBs include the applicable corrections.

Validation combines GLB reimport, material and dimension checks, mesh-component
connectivity with 3 mm tolerance, ground contact of named feet/bases, explicit
espresso group/handle protrusion and grille height assertions, and rendered visual
review. AABB containment alone is not treated as proof of burial: coffee, soil and
diffusers belong inside the open cups, pot and lamp shades. The script documents
those interiors. This is geometry QA, not a physical load-bearing simulation.

Before: https://api.yokup.com/media/fleet/bf5291aa12c5ac98.png
After: https://api.yokup.com/media/fleet/c7e139c8a7551532.png
Both are actual 1200 × 900 Blender renders using the same 3/4 camera and lighting.

`published.json` records new Stock IDs and SHA-256 hashes. Original source backups
remain in ~/Claude/furniture-4380. Editable deliveries are stored in Stock, not git.
The old scene inventories remain bound to the old binaries; revision inventories
are separately bound by SHA-256 and remapped node names. Export now limits selection
to the active scene, preventing a selected source object leaking into a GLB.

Additional results: 1,039 meshes reviewed across the 48 assets; named foot/base
checks pass; the grinder and hopper world vertices match the original source
exactly to six decimal places. Headless Chrome loaded both revised scene inventories
(34 Alsea / 13 Xtanco measured items) and the coffee machine at its verified size,
with no JavaScript errors. Native application windows were not moved or resized.
