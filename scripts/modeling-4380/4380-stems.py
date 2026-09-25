import bpy,pathlib
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
 if o.name.startswith('planta__hoja_tallo') and o.type=='CURVE':o.select_set(True);bpy.context.view_layer.objects.active=o
bpy.ops.object.convert(target='MESH');bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath,compress=True)
for m in bpy.data.materials:
 if m.use_nodes:
  for n in m.node_tree.nodes:
   if n.type=='BSDF_PRINCIPLED':
    for l in list(n.inputs['Normal'].links):m.node_tree.links.remove(l)
bpy.ops.export_scene.gltf(filepath=str(pathlib.Path(bpy.data.filepath).with_suffix('.glb')),export_format='GLB',use_visible=True,export_extras=True,export_lights=False,export_cameras=False,export_apply=True)
