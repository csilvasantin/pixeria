"""Blender -b source.blend --python scripts/export-furniture.py -- slug outdir.
Export each reusable inventory item once, with metric geometry and a base origin.
"""
import bpy,json,sys,pathlib,re,hashlib,math,struct,os
from mathutils import Vector,Matrix
slug,outdir=sys.argv[sys.argv.index('--')+1:];out=pathlib.Path(outdir);out.mkdir(parents=True,exist_ok=True)
repo=pathlib.Path(__file__).resolve().parents[1]
manifest=json.loads((repo/'assets/xpaces/inventory'/f'{slug}.json').read_text())
source=bpy.context.scene
glb=pathlib.Path(bpy.data.filepath).with_suffix('.glb').read_bytes()
nodes=json.loads(glb[20:20+struct.unpack_from('<I',glb,12)[0]])['nodes']
groups={}
for row in manifest['items']:
 if row['categoria']=='Arquitectura':continue
 # Repeated designed pieces share one reusable model. Screens retain their content.
 key=re.sub(r'-\d+$','',row['id']) if re.match(r'^(silla|mesa|taburete|lampara|planta)-\d+$',row['id']) else ('S' if re.match(r'^S\d+$',row['id']) else row['id'])
 groups.setdefault(key,[]).append(row)
only=os.environ.get('FURNITURE_ONLY','').split(',') if os.environ.get('FURNITURE_ONLY') else []
results=json.loads((out/(slug+'-export.json')).read_text()) if only else []
for key,rows in groups.items():
 if only and key not in only:continue
 row=rows[0];obj=bpy.data.objects[nodes[row['node']]['name']];inv=obj.matrix_world.inverted()
 scene=bpy.data.scenes.new('export_'+key);scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
 copies=[];points=[]
 for original in [obj,*obj.children_recursive]:
  if original.type!='MESH':continue
  copy=original.copy();copy.data=original.data.copy();copy.parent=None;copy.matrix_world=inv@original.matrix_world;scene.collection.objects.link(copy);copies.append(copy)
  points.extend(copy.matrix_world@Vector(c) for c in original.evaluated_get(bpy.context.evaluated_depsgraph_get()).bound_box)
 if not points:raise RuntimeError(key+' has no mesh')
 lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)])
 base=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z));size=hi-lo
 for copy in copies:copy.matrix_world=Matrix.Translation(-base)@copy.matrix_world
 materials=sorted({m.name for c in copies for m in c.data.materials if m})
 data={'schema':'pixeria.furniture/1','slug':slug,'xpace':manifest['assetId'],'inventoryIds':[r['id'] for r in rows],'quantity':len(rows),'dimensionsCm':[round(size.x*100,3),round(size.y*100,3),round(size.z*100,3)],'materials':materials,'baseLocal':list(base),'source':manifest['source']}
 root=bpy.data.objects.new(key,None);scene.collection.objects.link(root);root['furniture']=data
 for copy in copies:copy.parent=root
 bpy.context.window.scene=scene
 for o in scene.objects:o.select_set(True)
 safe=re.sub(r'[^a-zA-Z0-9_-]','_',key);file=slug+'-'+safe
 bpy.ops.export_scene.gltf(filepath=str(out/(file+'.glb')),export_format='GLB',use_selection=True,export_extras=True,export_yup=True)
 scene.render.engine='CYCLES';scene.cycles.samples=8
 scene.render.resolution_x=256;scene.render.resolution_y=256;scene.render.resolution_percentage=100
 scene.world=bpy.data.worlds.new('World_'+file);scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(0.16,0.19,0.23,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7
 camdata=bpy.data.cameras.new('camera');cam=bpy.data.objects.new('camera',camdata);scene.collection.objects.link(cam);scene.camera=cam
 target=Vector((0,0,size.z*.48));radius=max(size)*2.5;cam.location=target+Vector((radius,-radius,radius*.8));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();camdata.type='ORTHO';camdata.ortho_scale=max(size)*1.8
 lightdata=bpy.data.lights.new('softbox','AREA');lightdata.energy=900;lightdata.shape='DISK';lightdata.size=max(size)*3
 light=bpy.data.objects.new('softbox',lightdata);scene.collection.objects.link(light);light.location=(2,-3,4);light.rotation_euler=(target-light.location).to_track_quat('-Z','Y').to_euler()
 scene.render.image_settings.file_format='JPEG';scene.render.filepath=str(out/(file+'.jpg'));bpy.ops.render.render(write_still=True)
 data.update(file=file,title=re.sub(r'\s*\(×\d+\)','',row['nombre']),category=row['categoria'])
 results=[r for r in results if r['file']!=file];results.append(data);(out/(slug+'-export.json')).write_text(json.dumps(results,ensure_ascii=False,indent=2))
 bpy.context.window.scene=source;bpy.data.scenes.remove(scene)
 print('EXPORTED',file,len(rows),data['dimensionsCm'],flush=True)
