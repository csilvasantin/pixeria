import bpy,pathlib
from mathutils import Vector
exec(pathlib.Path('/Users/csilvasantin/Claude/furniture-4380/fix-others.py').read_text().split('for o in list(bpy.data.objects):')[0].replace("slug=sys.argv[sys.argv.index('--')+1]", "slug='xtanco'"))
body=bpy.data.objects['expendedora'];ba,bb=bounds(body)
for o in body.children:
 if '__expositor' in o.name or '__balda' in o.name:
  a,b=bounds(o);inv=o.matrix_world.inverted()
  for v in o.data.vertices:
   p=o.matrix_world@v.co;p.y=a.y+(p.y-a.y)/(b.y-a.y)*(ba.y+.001-a.y);v.co=inv@p
  o.data.update()
for o in body.children:
 if '__producto_' in o.name:
  n=int(o.name.split('__producto_')[1].split('_')[0]);a,b=bounds(o);sa,sb=bounds(bpy.data.objects['expendedora__balda'+str(n)]);shift(o,(0,0,sb.z-a.z))
bpy.context.view_layer.update();bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath,compress=True)
for m in bpy.data.materials:
 if m.use_nodes:
  for n in m.node_tree.nodes:
   if n.type=='BSDF_PRINCIPLED':
    for l in list(n.inputs['Normal'].links):m.node_tree.links.remove(l)
bpy.ops.export_scene.gltf(filepath=str(pathlib.Path(bpy.data.filepath).with_suffix('.glb')),export_format='GLB',use_visible=True,export_extras=True,export_lights=False,export_cameras=False,export_apply=True)
