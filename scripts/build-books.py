"""Construye un GLB y un BLEND por cápsula, según estanteria-libros.json.

Ejes acordados con el visor: Y arriba, lomo hacia +Z, portada hacia +X;
origen en el centro de la base. No modifica la estantería ni pizarra-3.
Uso: blender -b --factory-startup --python build_books.py
"""
import bpy
import json
import math
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
ASSETS = BASE / 'assets/xpaces/libros'
MANIFEST = json.loads((ASSETS / 'estanteria-libros.json').read_text())
OUT = ASSETS / 'modelos'
OUT.mkdir(exist_ok=True)


def mat(name, color, image=None, roughness=.7):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    if image:
        node = m.node_tree.nodes.new('ShaderNodeTexImage')
        node.image = bpy.data.images.load(str(image), check_existing=True)
        node.interpolation = 'Linear'
        m.node_tree.links.new(node.outputs['Color'], bsdf.inputs['Base Color'])
    return m


def cube(name, location, scale, material, bevel=.0008):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    if bevel:
        mod = obj.modifiers.new('Esquinas redondeadas', 'BEVEL')
        mod.width = bevel
        mod.segments = 3
        mod.affect = 'EDGES'
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
        obj.modifiers.new('Normales suaves', 'WEIGHTED_NORMAL')
    return obj


def image_face(name, x, height, width, image_material):
    # Plano de portada sobre la tapa +X. UV 0→1, con normal hacia +X.
    half = width / 2
    verts = [(x, .003, -half), (x, .003, half),
             (x, height-.003, half), (x, height-.003, -half)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], [(0, 3, 2, 1)])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(image_material)
    uv = mesh.uv_layers.new(name='Portada UV')
    for loop in mesh.polygons[0].loop_indices:
        vertex = mesh.loops[loop].vertex_index
        # Visto desde +X, +Z queda a la izquierda de la imagen.
        uv.data[loop].uv = [(1,0),(0,0),(0,1),(1,1)][vertex]
    return obj


def spine_text(name, string, y0, z, color, max_height, font_size):
    curve = bpy.data.curves.new(name, 'FONT')
    curve.body = string
    curve.size = font_size
    curve.resolution_u = 1
    curve.extrude = 0
    curve.bevel_depth = 0
    ob = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(ob)
    ob.location = (0, y0, z)
    ob.rotation_euler = (0, 0, math.pi/2)
    ob.data.materials.append(color)
    bpy.context.view_layer.update()
    if ob.dimensions.y > max_height:
        factor = max_height / ob.dimensions.y
        ob.scale *= factor
        bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.convert(target='MESH')
    return bpy.context.object


def build(book):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    slug = book['slug']
    sizes = book.get('medidas_cm') or {}
    h = (sizes.get('alto') or 23) / 100
    w = (sizes.get('ancho') or 15) / 100
    th = (sizes.get('grueso') or 3.0) / 100
    # Sapiens tiene 5,3 cm verificados; el hueco de 33,3 cm lo admite.
    h = min(h, .29)
    w = min(w, .22)
    th = min(th, .06)
    paper = mat('MAT_paginas_crema', (.84,.81,.71), roughness=.92)
    endpaper = mat('MAT_guardas', (.62,.56,.44), roughness=.84)
    jacket = mat('MAT_tapa_tela', (.19,.22,.23), roughness=.62)
    spine = mat('MAT_lomo', (.15,.18,.20), roughness=.6)
    letters = mat('MAT_letras_lomo', (.91,.82,.58), roughness=.58)
    image = ASSETS / 'portadas' / f'{slug}.jpg'
    if not image.is_file():
        raise FileNotFoundError(f'Portada real ausente: {image}')
    cover = mat('MAT_portada_Blinkist', (1,1,1), image=image, roughness=.48)

    # El cuerpo de páginas tiene tres cantos visibles en crema, separados de la tapa.
    cube('paginas_crema', (0,h/2,-.001), (th-.006,h-.009,w-.008), paper, .0014)
    cube('guarda_delantera', (th/2-.0035,h/2,0), (.0008,h-.005,w-.004), endpaper, .0003)
    cube('guarda_trasera', (-th/2+.0035,h/2,0), (.0008,h-.005,w-.004), endpaper, .0003)
    cube('tapa', (th/2-.0015,h/2,0), (.003,h,w), jacket, .0015)
    cube('contracubierta', (-th/2+.0015,h/2,0), (.003,h,w), jacket, .0015)
    cube('lomo', (0,h/2,w/2-.0015), (th,h,.003), spine, .0011)
    image_face('portada_real_Blinkist', th/2+.00015, h, w-.006, cover)
    # Contracubierta con título y autor en relieve suave.
    spine_text('titulo_lomo', book['titulo'], .027, w/2+.00025,
               letters, h-.075, min(.014, th*.43))
    spine_text('autor_lomo', book['autor'], .021, w/2+.00025,
               letters, h-.045, min(.008, th*.24))
    mark = bpy.data.objects.new(f'libro:{slug}', None)
    bpy.context.collection.objects.link(mark)
    mark['capsula_id'] = book['capsula']['id']
    mark['blinkist_url'] = book['blinkist_url']
    mark['dimensions_m'] = f'{w:.3f} x {h:.3f} x {th:.3f}'
    for ob in [o for o in bpy.context.scene.objects if o != mark]:
        ob.parent = mark
        ob.matrix_parent_inverse.identity()
    # Blender exporta Z-arriba a glTF Y-arriba. La geometría se construye en
    # ejes glTF para que sea legible; esta rotación previa compensa la conversión.
    mark.rotation_euler.x = math.pi / 2

    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / f'{slug}.blend'))
    bpy.ops.export_scene.gltf(filepath=str(OUT / f'{slug}.glb'),
                              export_format='GLB', export_yup=True,
                              export_apply=True, export_cameras=False,
                              export_lights=False, export_extras=True,
                              export_image_format='JPEG',
                              export_texcoords=True)
    print(f'BUILT {slug} {w:.3f}x{h:.3f}x{th:.3f} m {(OUT/f"{slug}.glb").stat().st_size} bytes')


for item in MANIFEST['libros']:
    build(item)
