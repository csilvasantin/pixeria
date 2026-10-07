"""Independent reopen/reimport QA; outputs evidence, never changes source/models."""
from pathlib import Path
import bpy,json,hashlib,struct,math,argparse,sys
from mathutils import Vector
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--asset-dir',required=True,help='Directory containing downloaded/generated Best BLEND and GLB')
parser.add_argument('--layout',required=True,help='Original metric JSON layout')
parser.add_argument('--source',help='Optional original BLEND, if available; verify its unchanged recorded hash')
parser.add_argument('--manifest',help='Recorded/generated manifest; defaults to the asset directory')
parser.add_argument('--report',help='Report path; defaults to the asset directory')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
OUT=Path(args.asset_dir).resolve()
MANIFEST=Path(args.manifest).resolve()if args.manifest else OUT/'xtanco-best.manifest.json'
REPORT=Path(args.report).resolve()if args.report else OUT/'xtanco-best.validation.json'
manifest=json.loads(MANIFEST.read_text())
layout=json.loads(Path(args.layout).resolve().read_text())
report={'schema':'studio.xtanco-best-validation/1','blender_version':bpy.app.version_string,'checks':[],'measurements':{}}
def check(name,value,evidence=None):
    report['checks'].append({'check':name,'passed':bool(value),'evidence':evidence})
    print(('PASS 'if value else'FAIL ')+name,flush=True)
def measured(stage):
    skip=('__cable','__hoja','__taza','__vaso','__luz','__pieza','__led','__panel','__soporte')
    rows=[];bpy.context.view_layer.update()
    for it in layout['items']:
        ob=bpy.data.objects.get(it['id'])
        check(stage+' preserves parent '+it['id'],bool(ob))
        if not ob:continue
        pts=[o.matrix_world@Vector(v) for o in [ob]+list(ob.children_recursive) if o.type=='MESH' and not any(s in o.name for s in skip) for v in o.bound_box]
        coords=[[v.x for v in pts],[-v.y for v in pts],[v.z for v in pts]]
        got=[min(v) for v in coords]+[max(v)-min(v) for v in coords]
        ref=[it[k]for k in ('x','y','z','w','d','h')]
        dim=5 if it['tipo']=='plant' else 6
        dev=max(abs(got[i]-ref[i])for i in range(dim))
        row={'id':it['id'],'reference_m':ref,'actual_m':got,'max_deviation_m':dev,'passed':dev<=.020001};rows.append(row)
        check(stage+' dimension '+it['id'],row['passed'],row)
    report['measurements'][stage]=rows

if args.source:
    source=Path(args.source).resolve()
    check('original editable source unchanged',hashlib.sha256(source.read_bytes()).hexdigest()==manifest['source']['blend_sha256'])
else:
    report['checks'].append({'check':'original editable source unchanged','passed':None,'status':'not_checked','reason':'Original BLEND not supplied; the published editable Best permits continuation but does not replace its parent source.'})
    print('NOT_CHECKED original editable source unchanged (original BLEND not supplied)',flush=True)
bpy.ops.wm.open_mainfile(filepath=str(OUT/'xtanco-best.blend'))
check('source uses metric units',bpy.context.scene.unit_settings.system=='METRIC'and bpy.context.scene.unit_settings.scale_length==1)
check('source cutaway remains hidden',bpy.data.collections['Cerramiento_corte'].hide_render and bpy.data.collections['Cerramiento_corte'].hide_viewport)
check('source retains editable source camera',bpy.data.objects.get('CAM_iso')is not None)
check('source remains separate derived file',Path(bpy.data.filepath)==OUT/'xtanco-best.blend')
used={n.image.name:n.image for m in bpy.data.materials if m.use_nodes for n in m.node_tree.nodes if n.type=='TEX_IMAGE'and n.image}
image_report=[{'name':im.name,'size':list(im.size),'packed':bool(im.packed_file),'colorspace':im.colorspace_settings.name}for im in used.values()]
check('source PBR maps remain packed/editable',len([i for i in image_report if i['name'].startswith('best-')])==11 and all(i['packed']for i in image_report),image_report)
check('normal/roughness maps use Non-Color',all(im.colorspace_settings.name=='Non-Color'for name,im in used.items()if name.startswith('best-')and any(s in name for s in ('normal','roughness'))))
measured('source')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(OUT/'xtanco-best.glb'))
measured('glb_reimport')
check('web asset excludes cameras/lights',not any(o.type in ('CAMERA','LIGHT')for o in bpy.data.objects))
check('web asset omits cutaway walls',not any(bpy.data.objects.get(n)for n in ('pared_derecha','pared_frontal')))
check('wall display remains replaceable',bpy.data.objects.get('pantalla-pared')is not None)
check('five shared-media material IDs remain intact',all(name in bpy.data.materials for name in manifest['preserved']['media_material_names']))
b=(OUT/'xtanco-best.glb').read_bytes();n,_=struct.unpack_from('<II',b,12);j=json.loads(b[20:20+n])
roles={'normal':sum('normalTexture'in m for m in j['materials']),'roughness':sum('metallicRoughnessTexture'in m.get('pbrMetallicRoughness',{})for m in j['materials'])}
check('web export includes six normal and roughness material maps',roles['normal']>=6 and roles['roughness']>=6,roles)
check('web asset under20MB',len(b)<20_000_000,{'bytes':len(b),'preferred_under12MB':len(b)<12_000_000})
check('manifest SHA256 matches exported bytes',hashlib.sha256(b).hexdigest()==manifest['glb']['sha256'])
check('Best contains more refined geometry than base',manifest['glb']['triangles']>manifest['source']['glb']['triangles'],{'base_triangles':manifest['source']['glb']['triangles'],'best_triangles':manifest['glb']['triangles']})
check('all decoded texture dimensions under2048',all(max(im.size)<=2048 for im in bpy.data.images))
report['passed']=sum(c['passed']is True for c in report['checks']);report['total']=len(report['checks']);report['checked']=sum(c['passed']is not None for c in report['checks']);report['not_checked']=report['total']-report['checked'];report['glb']=manifest['glb']
REPORT.write_text(json.dumps(report,indent=2,ensure_ascii=False))
if report['passed']!=report['checked']:raise RuntimeError('Best validation has failures: '+str([c['check']for c in report['checks']if c['passed']is False]))
print('BEST_VALIDATED',report['passed'],report['checked'],'NOT_CHECKED',report['not_checked'],flush=True)
