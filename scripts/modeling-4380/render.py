import bpy,sys,pathlib
from mathutils import Vector
src,dst=sys.argv[sys.argv.index('--')+1:];bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);bpy.ops.import_scene.gltf(filepath=src)
s=bpy.context.scene;obs=[o for o in s.objects if o.type=='MESH'];pts=[o.matrix_world@Vector(v) for o in obs for v in o.bound_box];lo=Vector([min(p[i] for p in pts) for i in range(3)]);hi=Vector([max(p[i] for p in pts) for i in range(3)]);size=hi-lo;target=(hi+lo)/2;r=max(size)
s.render.engine='CYCLES';s.cycles.samples=32;s.cycles.use_denoising=True;s.render.resolution_x=1200;s.render.resolution_y=900;s.render.resolution_percentage=100
s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.16,.19,.23,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.65
bpy.ops.object.camera_add(location=target+Vector((r*1.6,-r*2.8,r*1.55)));c=bpy.context.object;c.rotation_euler=(target-c.location).to_track_quat('-Z','Y').to_euler();c.data.type='ORTHO';c.data.ortho_scale=r*1.45;s.camera=c
for pos,energy,scale in [((1,-2,3),180,2),((-2,-1,1),100,1.5),((0,2,3),220,1.5)]:
 bpy.ops.object.light_add(type='AREA',location=target+Vector(pos)*r);l=bpy.context.object;l.data.energy=energy*r*r;l.data.shape='DISK';l.data.size=scale*r;l.rotation_euler=(target-l.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,lo.z-.002));m=bpy.data.materials.new('Studio');m.diffuse_color=(.13,.15,.18,1);bpy.context.object.data.materials.append(m)
s.render.image_settings.file_format='PNG';s.render.filepath=dst;bpy.ops.render.render(write_still=True)
