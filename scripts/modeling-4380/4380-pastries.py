import bpy,pathlib
from mathutils import Vector
root=bpy.data.objects['vitrina-bolleria'];groups={}
for o in root.children:
 if '__pieza_' in o.name:
  suffix=o.name.split('__pieza_')[1];kind,n=suffix.split('_')[:2];key=('pan' if kind in ['pan','choc'] else kind,n);groups.setdefault(key,[]).append(o)
def zz(o):return [(o.matrix_world@v.co).z for v in o.data.vertices]
trays=sorted(max(zz(o)) for o in root.children if '__bandeja' in o.name and '__soporte' not in o.name)
for (kind,n),group in groups.items():
 low=min(min(zz(o)) for o in group);target=max(z for z in trays if z<low+.001);delta=target-low
 for o in group:
  inv=o.matrix_world.inverted()
  for v in o.data.vertices:v.co=inv@(o.matrix_world@v.co+Vector((0,0,delta)))
  o.data.update()
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath,compress=True)
for m in bpy.data.materials:
 if m.use_nodes:
  for n in m.node_tree.nodes:
   if n.type=='BSDF_PRINCIPLED':
    for li in list(n.inputs['Normal'].links):m.node_tree.links.remove(li)
bpy.ops.export_scene.gltf(filepath=str(pathlib.Path(bpy.data.filepath).with_suffix('.glb')),export_format='GLB',use_visible=True,export_extras=True,export_lights=False,export_cameras=False,export_apply=True)
