import bpy,pathlib,math
from mathutils import Vector,Matrix
root=bpy.data.objects['cafetera'];steel=bpy.data.materials['MAT_acero'];dark=bpy.data.materials['NEGRO_MATE']
def reshape(o,lo,hi):
 pts=[o.matrix_world@v.co for v in o.data.vertices];a=Vector([min(p[i] for p in pts) for i in range(3)]);b=Vector([max(p[i] for p in pts) for i in range(3)]);inv=o.matrix_world.inverted()
 for v,p in zip(o.data.vertices,pts):v.co=inv@Vector([lo[i]+(p[i]-a[i])/(b[i]-a[i])*(hi[i]-lo[i]) for i in range(3)])
 o.data.update()
def parent(o,name,mat):
 bpy.context.view_layer.update();o.name='cafetera__'+name;o.data.materials.clear();o.data.materials.append(mat);mw=o.matrix_world.copy();o.parent=root;o.matrix_world=mw;return o
def box(name,lo,hi,mat=steel):
 bpy.ops.mesh.primitive_cube_add(size=1,location=(Vector(lo)+Vector(hi))/2);o=bpy.context.object;o.dimensions=Vector(hi)-Vector(lo);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);be=o.modifiers.new('Soft edges','BEVEL');be.width=.003;be.segments=3;return parent(o,name,mat)
def cyl(name,a,b,r,mat=steel):
 a,b=Vector(a),Vector(b);bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=r,depth=(b-a).length,location=(a+b)/2);o=bpy.context.object;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();parent(o,name,mat)
 for p in o.data.polygons:p.use_smooth=True
 return o
reshape(root,(4.9,-2.0,1.07),(5.65,-1.7,1.515))
reshape(bpy.data.objects['cafetera__bandeja'],(4.91,-2.258,1.065),(5.64,-1.97,1.088))
box('borde_bandeja',(4.91,-2.268,1.065),(5.64,-2.255,1.096))
box('frente_superior',(4.9,-2.125,1.35),(5.65,-1.99,1.49))
box('calientatazas',(4.91,-2.115,1.516),(5.64,-1.71,1.527))
for n,(lo,hi) in enumerate([((4.91,-1.72,1.527),(5.64,-1.71,1.55)),((4.91,-2.115,1.527),(4.92,-1.71,1.55)),((5.63,-2.115,1.527),(5.64,-1.71,1.55))]):box('reborde_tazas'+str(n),lo,hi)
for n in range(14):
 x=4.94+n*.05;reshape(bpy.data.objects['cafetera__rejilla'+str(n)],(x,-2.25,1.089),(x+.014,-1.975,1.096))
for n,x in enumerate([5.025,5.275,5.525]):
 o=bpy.data.objects['cafetera__grupo'+str(n)];bpy.data.objects.remove(o,do_unlink=True)
 cyl('grupo'+str(n),(x,-2.09,1.31),(x,-2.09,1.36),.049)
 cyl('cazoleta'+str(n),(x,-2.09,1.287),(x,-2.09,1.315),.041)
 bpy.data.objects.remove(bpy.data.objects['cafetera__portafiltro'+str(n)],do_unlink=True)
 cyl('cuello_mango'+str(n),(x,-2.09,1.30),(x,-2.145,1.30),.012)
 cyl('portafiltro'+str(n),(x,-2.137,1.30),(x,-2.256,1.288),.017,dark)
 for side in [-1,1]:cyl('cano'+str(n)+'_'+str(side),(x+side*.019,-2.09,1.29),(x+side*.019,-2.10,1.264),.008)
 for o in [bpy.data.objects['cafetera__mando'+str(n)],*[bpy.data.objects['cafetera__boton'+str(n)+'_'+str(k)] for k in range(3)]]:o.location.y+=.125
for n,x in enumerate([4.925,5.625]):
 cyl('vapor'+str(n),(x,-2.01,1.35),(x,-2.17,1.18),.007)
 cyl('vapor_punta'+str(n),(x,-2.17,1.18),(x,-2.17,1.15),.009)
for x in [4.93,5.62]:
 for y in [-1.97,-1.73]:cyl('pie_'+str(x)+'_'+str(y),(x,y,1.05),(x,y,1.073),.024,dark)
bpy.context.view_layer.update()
t=bpy.data.texts.new('FIX_4380.py');t.write(pathlib.Path(__file__).read_text());bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath='/Users/csilvasantin/alsea-4365/output/alsea.blend',compress=True)
# Remove native procedural bump from GLB export only.
for m in bpy.data.materials:
 if m.use_nodes:
  for n in m.node_tree.nodes:
   if n.type=='BSDF_PRINCIPLED':
    for link in list(n.inputs['Normal'].links):m.node_tree.links.remove(link)
bpy.ops.export_scene.gltf(filepath='/Users/csilvasantin/alsea-4365/output/alsea.glb',export_format='GLB',use_visible=True,export_extras=True,export_lights=False,export_cameras=False,export_apply=True)
