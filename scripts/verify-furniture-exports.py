"""Reimport all exported GLBs in Blender and verify metric bounds and materials."""
import bpy,json,pathlib,sys,struct
from mathutils import Vector
folder=pathlib.Path(sys.argv[sys.argv.index('--')+1]);report=[];update='--update-metadata' in sys.argv
for slug in ['alsea','xtanco']:
 rows=json.loads((folder/(slug+'-export.json')).read_text())
 for item in rows:
  bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
  bpy.ops.import_scene.gltf(filepath=str(folder/(item['file']+'.glb')))
  points=[o.matrix_world@Vector(v) for o in bpy.context.scene.objects if o.type=='MESH' for v in o.bound_box]
  lo=[min(p[i] for p in points) for i in range(3)];hi=[max(p[i] for p in points) for i in range(3)];dims=[(hi[i]-lo[i])*100 for i in range(3)]
  if update and max(abs(dims[i]-item['dimensionsCm'][i]) for i in range(3))>=.005:
   item['dimensionsCm']=[round(v,3) for v in dims]
   path=folder/(item['file']+'.glb');blob=path.read_bytes();length=struct.unpack_from('<I',blob,12)[0];doc=json.loads(blob[20:20+length])
   for node in doc['nodes']:
    if 'furniture' in node.get('extras',{}):node['extras']['furniture']['dimensionsCm']=item['dimensionsCm']
   raw=json.dumps(doc,separators=(',',':')).encode();raw+=b' '*((-len(raw))%4);rest=blob[20+length:];path.write_bytes(struct.pack('<III',0x46546c67,2,20+len(raw)+len(rest))+struct.pack('<II',len(raw),0x4e4f534a)+raw+rest)
  assert max(abs(dims[i]-item['dimensionsCm'][i]) for i in range(3))<.005,(item['file'],dims)
  assert abs(lo[2])<1e-5,(item['file'],'base',lo)
  assert abs(lo[0]+hi[0])<1e-5 and abs(lo[1]+hi[1])<1e-5,(item['file'],'center')
  meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];assert all(len(o.data.materials)>0 for o in meshes)
  report.append({'file':item['file'],'quantity':item['quantity'],'ids':item['inventoryIds'],'dimensionsCm':dims,'base':lo[2],'meshes':len(meshes),'materials':item['materials']})
 if update:(folder/(slug+'-export.json')).write_text(json.dumps(rows,ensure_ascii=False,indent=2))
(folder/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print('VERIFIED',len(report),'GLBs',sum(r['quantity'] for r in report),'inventory objects')
