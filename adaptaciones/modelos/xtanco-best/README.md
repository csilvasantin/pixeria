# Xtanco Best · fuentes y continuación / source and continuation

## Español

Paquete ligero del modelo `xtanco-best-studio-20261008`. Conserva los scripts, procedencia y evidencia de la ejecución Blender **5.2.2 LTS** realizada el 8 de octubre de 2026. No contiene modelos, texturas binarias ni registros de consola. Los hashes y las medidas de `xtanco-best.manifest.json` y `xtanco-best.validation.json` corresponden a esa ejecución publicada, no a una nueva ejecución de estos scripts parametrizados.

### Recursos publicados

| Recurso | Stock | SHA-256 | Tamaño |
| --- | --- | --- | ---: |
| [GLB Best](https://api.admira.store/stock/asset/1791411065310-v2jraa) | `1791411065310-v2jraa` | `77b4f4c7346c0dacf22c3d8573f1d80536d367d3b64874115443c1b420edbb85` | 13.035.628 bytes |
| [BLEND editable Best](https://api.admira.store/stock/asset/1791411076540-afplfh) | `1791411076540-afplfh` | `eda59372a911b37c29cce69c4721205ffa2cd2e304f4d899f2480ca0c4aec3a1` | 6.298.649 bytes |
| [Render isométrico 1600×1000](https://api.admira.store/stock/asset/1791411162545-wd1dt7) | `1791411162545-wd1dt7` | `aa48d271e48eeb6bd86f6a77d8244f91a17fa45a4068697bf6d784a2da488a98` | 1.664.895 bytes |

**Para continuar el modelo**, descargar el BLEND Best publicado y comprobar su hash. Sus materiales y texturas están empaquetados y los objetos permanecen editables. Editar una copia y producir una variante nueva; no sobrescribir los recursos publicados ni aplicar de nuevo `build_best.py` sobre ese derivado.

**Dependencia del rebuild exacto:** la fuente padre local utilizada tiene SHA-256 `d87459f25a62d4a4bcfbf7f800f94b2ad947ffaebeb98ca883614023b3cf81dd`. **No coincide** con el antiguo BLEND Stock `1790365036008-xn4dg1`, cuyo hash registrado es `5450d5b139ddbe5aad5facc03e2d1f898acfbd290989342cdec3e865276a076d`. No se ha verificado una URL pública de la fuente padre actual. Se necesita esa fuente para repetir desde el padre; el BLEND Best publicado sí permite continuar el trabajo desde el resultado. El manifiesto mantiene la ruta local histórica únicamente como evidencia; los scripts reciben todas las rutas por argumentos.

### Qué cambió y qué se conservó

- 160.842 triángulos frente a 72.142 del GLB Better padre; 697 nodos, 696 mallas, 41 materiales y 15 imágenes.
- 331 objetos con biseles/curvas refinados, 33 piezas nuevas de herrajes/teclas y 175 frontales impresos genéricos. Ocho materiales exportados incluyen mapas normales y rugosidad; los mapas son originales procedurales, separados de la iluminación. Color 1024, normal 768, rugosidad 512; atlas 1536×512.
- Los 13 IDs y envolventes del layout original, en metros, conservan la tolerancia original de ±2 cm. `pantalla-pared` sigue reemplazable; se mantienen los cinco materiales `PANTALLA_*`. El GLB omite cámaras, luces y paredes de corte.
- `KHR_mesh_quantization` comprime sólo normales/tangentes. Posiciones, UV, índices y transformaciones se conservan. El GLTFLoader Xpaces incluido soporta esa extensión.

La validación archivada pasó **68/68** mediante reapertura del BLEND y reimportación del GLB. Son comprobaciones del modelo y del layout de referencia; no certifican un levantamiento físico de ningún estanco Altadis. El PNG es una referencia Cycles, no una prueba del render web. No hay AO/GI horneado, fidelidad fotográfica certificada ni deformación anamórfica automática.

### Reproducción sin ventanas

Requiere Blender 5.2.2 LTS, NumPy en Blender y Python 3 con NumPy/Pillow para las texturas. Las ilustraciones son originales; el atlas registrado rasterizó Arial.ttf, hash `525979822591a3447cfc49d943d6f7683508e25543407871c0ed8fed05fd2bd9`. No se redistribuye el archivo de fuente. Otra fuente o versión de librerías puede cambiar los bytes; documentar cualquier variante y volver a verificarla.

Obtener por separado los tres inputs de sólo lectura:

| Input | SHA-256 requerido por defecto |
| --- | --- |
| BLEND padre actual | `d87459f25a62d4a4bcfbf7f800f94b2ad947ffaebeb98ca883614023b3cf81dd` |
| [GLB Better de referencia](https://api.admira.store/stock/asset/1790370139269-2ty118) | `a6a670ad3edebb9b3a56e22707b4bb89dabb4ad000ced9eec3fc51cbe91b2706` |
| `xtanco-layout.json`, v2 · 2026-09-25 | `c33db320333f969c4b7dc0106124a92f582e4480950a22136e74a88fcbcf75c9` |

Usar un directorio de salida separado de este paquete y de los inputs. Ejemplo, sustituyendo las rutas por las locales:

```sh
STUDIO_BEST_SCRIPTS="/ruta/al/repositorio/adaptaciones/modelos/xtanco-best"
STUDIO_BEST_OUTPUT="/tmp/xtanco-best-rebuild"
STUDIO_BEST_BLENDER="/ruta/a/Blender"
python3 "$STUDIO_BEST_SCRIPTS/make_best_textures.py" \
  --output "$STUDIO_BEST_OUTPUT" --font "/ruta/a/Arial.ttf"
"$STUDIO_BEST_BLENDER" --background --factory-startup -t 8 \
  --python-exit-code 1 --python "$STUDIO_BEST_SCRIPTS/build_best.py" -- \
  --source "/ruta/al/xtanco-padre.blend" \
  --base-glb "/ruta/al/xtanco-better.glb" \
  --layout "/ruta/al/xtanco-layout.json" --output "$STUDIO_BEST_OUTPUT"
"$STUDIO_BEST_BLENDER" --background --factory-startup -t 4 \
  --python-exit-code 1 --python "$STUDIO_BEST_SCRIPTS/verify_best.py" -- \
  --asset-dir "$STUDIO_BEST_OUTPUT" --layout "/ruta/al/xtanco-layout.json" \
  --source "/ruta/al/xtanco-padre.blend"
```

Los argumentos `--expected-source-sha256`, `--expected-base-glb-sha256` y `--expected-layout-sha256` permiten una derivación deliberada con nuevos inputs revisados; no convierten otro BLEND en la fuente histórica. Los scripts no escriben sobre el padre, el GLB base ni el layout. La cuantización se aplica automáticamente al export generado; su CLI independiente exige `--input` y `--output` diferentes.

Para revisar el resultado publicado en otro equipo, descargar GLB y BLEND en un directorio aparte, añadir una copia de este manifiesto y proporcionar el layout. `verify_best.py --asset-dir … --layout …` funciona sin el padre; registra la comprobación de conservación del padre como **no realizada**, no como aprobada. Proporcionar `--source` cuando esté disponible para comprobarla también. `--manifest` y `--report` aceptan rutas explícitas.

En el Mac original, Metal no pudo inicializarse dentro del sandbox. La ejecución CLI autorizada fuera del sandbox funcionó sin ventanas. No cambiar preferencias del usuario, permisos del sistema ni el layout de ventanas; mantener configuración temporal cuando haga falta.

## English

This small package preserves the scripts, provenance and evidence for `xtanco-best-studio-20261008`, produced with **Blender 5.2.2 LTS on 8 October 2026**. It contains no binary models, texture files or console logs. The archived manifest/validation hashes and measurements describe the published run, not a fresh run of the parameterized scripts.

The table above links the **published Best GLB, editable packed BLEND and 1600×1000 Cycles reference PNG** with their exact hashes and sizes. To continue modeling, obtain the published Best BLEND, verify its hash and edit a separate copy as a new variant. Do not overwrite published assets or run `build_best.py` on this already refined derivative.

**Exact rebuild dependency:** the original local parent BLEND hash is `d87459f25a62d4a4bcfbf7f800f94b2ad947ffaebeb98ca883614023b3cf81dd`. It **does not match** legacy Stock BLEND `1790365036008-xn4dg1`, recorded as `5450d5b139ddbe5aad5facc03e2d1f898acfbd290989342cdec3e865276a076d`. No matching public URL for the current parent has been verified. The current parent is required to replay this derivation from its source; the published Best BLEND does allow continuation from the editable result. Historical local paths are evidence only; the scripts take explicit path arguments.

The model has **160,842 triangles** versus 72,142 in the Better parent; 697 nodes, 696 meshes, 41 materials and 15 images. It refines 331 objects, adds 33 discrete hardware/key objects and prints 175 original generic package fronts. Eight exported materials have normal/roughness maps. Colour maps are 1024, normal maps 768, roughness maps 512; the illustrative atlas is 1536×512. These are original authored procedural maps, not scanned physical materials or real tobacco SKU imagery.

The 13 parent IDs and metric envelopes retain the original ±2 cm validation tolerance. The replaceable `pantalla-pared`, five `PANTALLA_*` material IDs and cutaway behavior remain intact. The GLB excludes lights/cameras. Standard `KHR_mesh_quantization` compresses only normals/tangents; positions, UVs, indices and transforms remain unchanged, and the bundled Xpaces GLTFLoader supports it.

Archived independent reopen/reimport validation passed **68/68**. This validates the reference model/layout, not a survey of a real Altadis shop. There is no baked AO/GI, certified photographic fidelity or automatic anamorphic warp. The Cycles PNG does not certify the browser renderer.

Use the commands above with local paths and a separate scratch output directory. Requirements: Blender 5.2.2 LTS with NumPy and Python 3 with NumPy/Pillow. `make_best_textures.py` requires `--output` and `--font`; recorded Arial.ttf has hash `525979822591a3447cfc49d943d6f7683508e25543407871c0ed8fed05fd2bd9`, used for rasterization only. No font binary is redistributed. Different fonts/library versions can produce different bytes and require a documented new verification.

`build_best.py` requires `--source`, `--base-glb`, `--layout` and `--output`, after Blender's `--`. Default expected hashes are listed in the input table. Explicit `--expected-…-sha256` overrides describe reviewed new inputs; they do not establish historical equivalence. Input files are never overwritten. Quantization runs automatically; its standalone CLI requires separate `--input` and `--output` paths.

`verify_best.py` requires `--asset-dir` and `--layout`, and optionally accepts `--source`, `--manifest` and `--report`. Without the unavailable original parent, it explicitly records that preservation check as **not checked**, while validating the published editable Best and GLB. Supply `--source` to perform the parent preservation check too. Keep the archived 68/68 report intact when producing a new report.

The original Mac needed authorized background execution outside the restricted sandbox for Metal initialization. No window, user preference or system security changes are needed; use temporary config/scripts directories where appropriate.
