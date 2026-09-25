import bpy,bmesh,sys,pathlib
from mathutils import Vector
slug=sys.argv[sys.argv.index('--')+1];changed=[]
def bounds(o):
 p=[o.matrix_world@v.co for v in o.data.vertices];return Vector([min(a[i] for a in p) for i in range(3)]),Vector([max(a[i] for a in p) for i in range(3)])
def shift(o,v):
 inv=o.matrix_world.inverted()
 for p in o.data.vertices:p.co=inv@(o.matrix_world@p.co+Vector(v))
 o.data.update();changed.append(o.name)
def cap(o,top=True):
 a,b=bounds(o);height=b.z if top else a.z;bm=bmesh.new();bm.from_mesh(o.data);faces=[f for f in bm.faces if all(abs((o.matrix_world@v.co).z-height)<.0001 for v in f.verts)];bmesh.ops.delete(bm,geom=faces,context='FACES');bm.to_mesh(o.data);bm.free();changed.append(o.name)
def box(name,lo,hi,mat,parent):
 bpy.ops.mesh.primitive_cube_add(size=1,location=(Vector(lo)+Vector(hi))/2);o=bpy.context.object;o.name=name;o.dimensions=Vector(hi)-Vector(lo);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat);bpy.context.view_layer.update();m=o.matrix_world.copy();o.parent=parent;o.matrix_world=m;changed.append(name)
for o in list(bpy.data.objects):
 if o.type!='MESH':continue
 if o.name.startswith('lampara-') and '__' not in o.name:cap(o,False)
 if slug=='alsea':
  if o.name.startswith('mueble-trasero__puerta'):shift(o,(0,-.009,0))
  if ('__taza' in o.name or '__vaso' in o.name) and '__cafe' not in o.name:cap(o)
  if 'vitrina-bolleria__bandeja' in o.name:
   a,b=bounds(o);p=bpy.data.objects['vitrina-bolleria'];pa,pb=bounds(p)
   for n,x in enumerate([a.x,b.x-.012]):box(o.name+'__soporte'+str(n),(x,a.y,a.z-.015),(x+.012,pb.y,b.z),o.data.materials[0],p)
  if 'vitrina-bolleria__pieza_choc' in o.name:shift(o,(0,0,.008))
 else:
  if o.name=='planta':cap(o)
  if o.name.startswith('vitrina__luz_balda_'):
   n=int(o.name.rsplit('_',1)[1]);a,b=bounds(o);s=bpy.data.objects['vitrina__balda'+str(n)];sa,sb=bounds(s);shift(o,(0,0,sa.z-b.z+.0005))
  if o.name.startswith('vitrina__tirador_'):
   a,b=bounds(o);va,vb=bounds(bpy.data.objects['vitrina__vidrio'])
   for n,z in enumerate([a.z,b.z-.01]):box(o.name+'__anclaje'+str(n),(a.x,b.y-.002,z),(b.x,va.y+.002,z+.01),o.data.materials[0],bpy.data.objects['vitrina'])
  if o.name in ['expendedora__lector','expendedora__recogida']:
   a,b=bounds(o);pa,pb=bounds(bpy.data.objects['expendedora']);box(o.name+'__anclaje',(a.x,b.y-.001,a.z),(b.x,pa.y+.001,b.z),o.data.materials[0],bpy.data.objects['expendedora'])
# Recess the vending body behind its product face and keep a structural frame around it.
if slug=='xtanco':
 o=bpy.data.objects['expendedora'];a,b=bounds(o);inv=o.matrix_world.inverted()
 for v in o.data.vertices:
  p=o.matrix_world@v.co;p.y=a.y+.045+(p.y-a.y)/(b.y-a.y)*(b.y-a.y-.045);v.co=inv@p
 o.data.update();mat=o.data.materials[0]
 for name,lo,hi in [('izq',(a.x,a.y,a.z),(a.x+.06,a.y+.046,b.z)),('der',(a.x+.64,a.y,a.z),(b.x,a.y+.046,b.z)),('bajo',(a.x,a.y,a.z),(b.x,a.y+.046,.25)),('alto',(a.x,a.y,1.77),(b.x,a.y+.046,b.z))]:box('expendedora__marco_'+name,lo,hi,mat,o)
print('CHANGED',slug,changed)
path='/Users/csilvasantin/alsea-4365/output/alsea.blend' if slug=='alsea' else '/Users/csilvasantin/Claude/xtanco-4364/xtanco.blend'
bpy.context.view_layer.update();bpy.ops.wm.save_as_mainfile(filepath=path,compress=True)
for m in bpy.data.materials:
 if m.use_nodes:
  for n in m.node_tree.nodes:
   if n.type=='BSDF_PRINCIPLED':
    for li in list(n.inputs['Normal'].links):m.node_tree.links.remove(li)
bpy.ops.export_scene.gltf(filepath=str(pathlib.Path(path).with_suffix('.glb')),export_format='GLB',use_visible=True,export_extras=True,export_lights=False,export_cameras=False,export_apply=True)
