"""Derive an editable, measured-layout-preserving Best model. Never write source.

Blender --background --factory-startup --python-exit-code 1 --python build_best.py --
  --source ORIGINAL.blend --base-glb REFERENCE.glb --layout LAYOUT.json --output OUTPUT_DIR
"""
from pathlib import Path
import bpy,bmesh,json,math,hashlib,struct,time,runpy,argparse,sys
from mathutils import Matrix,Vector

SCRIPTS=Path(__file__).resolve().parent
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source',required=True,help='Read-only original Xtanco BLEND; not the published Best derivative')
parser.add_argument('--base-glb',required=True,help='Read-only reference Better GLB')
parser.add_argument('--layout',required=True,help='Read-only original metric JSON layout')
parser.add_argument('--output',required=True,help='Separate output directory for BLEND/GLB/textures/preview')
parser.add_argument('--expected-source-sha256',default='d87459f25a62d4a4bcfbf7f800f94b2ad947ffaebeb98ca883614023b3cf81dd')
parser.add_argument('--expected-base-glb-sha256',default='a6a670ad3edebb9b3a56e22707b4bb89dabb4ad000ced9eec3fc51cbe91b2706')
parser.add_argument('--expected-layout-sha256',default='c33db320333f969c4b7dc0106124a92f582e4480950a22136e74a88fcbcf75c9')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
OUT=Path(args.output).resolve();SOURCE=Path(args.source).resolve();BASE_GLB=Path(args.base_glb).resolve();BASE_LAYOUT=Path(args.layout).resolve()
for generated in ('xtanco-best.blend','xtanco-best.glb','xtanco-best.manifest.json','xtanco-best-iso.png'):
    if OUT/generated in (SOURCE,BASE_GLB,BASE_LAYOUT):raise ValueError('Output would overwrite a read-only input: '+str(OUT/generated))
source_hash=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
base_glb_hash=hashlib.sha256(BASE_GLB.read_bytes()).hexdigest()
layout_hash=hashlib.sha256(BASE_LAYOUT.read_bytes()).hexdigest()
for label,got,want in [('original BLEND',source_hash,args.expected_source_sha256),('reference GLB',base_glb_hash,args.expected_base_glb_sha256),('metric layout',layout_hash,args.expected_layout_sha256)]:
    if got!=want:raise ValueError(label+' SHA-256 mismatch; requires the recorded input or an explicitly reviewed derivative. Expected '+want+', got '+got)
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
scene=bpy.context.scene
scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
layout=json.loads(BASE_LAYOUT.read_text())
baseline_names={o.name for o in bpy.data.objects}
baseline_images={i.name for i in bpy.data.images}
refined=[];created=[];maps=[]

def image(filename,data=False):
    im=bpy.data.images.load(str(OUT/'textures'/filename),check_existing=True)
    if data:im.colorspace_settings.name='Non-Color'
    im.pack();return im

def install_pbr(name,kind,color=False):
    mat=bpy.data.materials[name];nodes,links=mat.node_tree.nodes,mat.node_tree.links
    bs=nodes.get('Principled BSDF')
    if color:
        for old in list(bs.inputs['Base Color'].links):links.remove(old)
        tex=nodes.new('ShaderNodeTexImage');tex.image=image('best-'+kind+'-color.png')
        links.new(tex.outputs['Color'],bs.inputs['Base Color'])
    for slot in ('Roughness','Normal'):
        for old in list(bs.inputs[slot].links):links.remove(old)
    rough=nodes.new('ShaderNodeTexImage');rough.image=image('best-'+kind+'-roughness.png',True)
    links.new(rough.outputs['Color'],bs.inputs['Roughness'])
    tex=nodes.new('ShaderNodeTexImage');tex.image=image('best-'+kind+'-normal.png',True)
    normal=nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.36 if kind=='oak' else .22
    links.new(tex.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],bs.inputs['Normal'])
    maps.append({'material':name,'normal':'best-'+kind+'-normal.png','roughness':'best-'+kind+'-roughness.png','color':'best-'+kind+'-color.png' if color else None})

for name,kind,col in [('MAT_roble','oak',True),('SUELO','terrazzo',True),('PARED_fondo','stucco',False),('PARED_fachada','stucco',False),('MAT_laton','metal',False),('MAT_acero','metal',False)]:install_pbr(name,kind,col)

for ob in bpy.data.objects:
    changed=False
    for mod in ob.modifiers:
        if mod.type=='BEVEL' and mod.segments>=2:
            mod.segments=5;changed=True
    if ob.type=='CURVE' and ob.data.bevel_depth:
        ob.data.bevel_resolution=4;ob.data.resolution_u=max(ob.data.resolution_u,16);changed=True
    if changed:refined.append(ob.name)

coll=bpy.data.collections.new('STUDIO_BEST · semantic refinements');scene.collection.children.link(coll)
def box(name,x,y,z,w,d,h,material,parent=None):
    me=bpy.data.meshes.new(name);bm=bmesh.new();bmesh.ops.create_cube(bm,size=1)
    bmesh.ops.scale(bm,vec=(w,d,h),verts=bm.verts);bmesh.ops.translate(bm,vec=(0,0,h/2),verts=bm.verts)
    bm.to_mesh(me);bm.free();me.materials.append(material)
    ob=bpy.data.objects.new(name,me);ob.location=(x+w/2,-(y+d/2),z);coll.objects.link(ob)
    if parent:ob.parent=parent;ob.matrix_parent_inverse=Matrix.Translation(parent.location).inverted()
    bevel=ob.modifiers.new('Best machined edge','BEVEL');bevel.width=min(w,d,h)*.15;bevel.segments=4
    bevel.limit_method='ANGLE';bevel.harden_normals=True
    normal=ob.modifiers.new('Best weighted normals','WEIGHTED_NORMAL');normal.keep_sharp=True
    ob['studioBestDetail']=True;created.append(name);return ob

# Hardware stays inside the measured parent envelope, within the existing ±2cm QA.
brass=bpy.data.materials['MAT_laton'];steel=bpy.data.materials['MAT_acero'];dark=bpy.data.materials['NEGRO_MATE']
vitrine=bpy.data.objects['vitrina']
for x in (1.94,4.99):
    for z in (.66,1.43):box('vitrina__best_hinge_%s_%s'%(x,z),x,.438,z,.026,.008,.06,brass,vitrine)
machine=bpy.data.objects['expendedora']
for row in range(13):box('expendedora__best_vent_%02d'%row,1.20,.805,.25+row*.022,.095,.003,.008,dark,machine)
for n,(x,z) in enumerate(((.49,.10),(1.29,.10),(.49,1.75),(1.29,1.75))):box('expendedora__best_fastener_%02d'%n,x,.804,z,.008,.004,.008,steel,machine)
pos=bpy.data.objects['tpv']
keys=bpy.data.materials.new('BEST_TPV_KEYCAP');keys.use_nodes=True;bs=keys.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.06,.07,.07,1);bs.inputs['Roughness'].default_value=.48
for row in range(4):
    for col in range(3):box('tpv__best_key_%d_%d'%(row,col),4.48+col*.025,1.675+row*.025,1.164,.020,.019,.007,keys,pos)

# A single original atlas gives existing generic packaging real printed fronts.
paper=bpy.data.materials.new('BEST_PRINTED_GENERIC_REFERENCE');paper.use_nodes=True
bs=paper.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.86;bs.inputs['Specular IOR Level'].default_value=.08
tx=paper.node_tree.nodes.new('ShaderNodeTexImage');tx.image=image('best-packaging-atlas.png')
paper.node_tree.links.new(tx.outputs['Color'],bs.inputs['Base Color'])
printed=[]
for ob in bpy.data.objects:
    if ob.type!='MESH' or not ('vitrina__producto_' in ob.name or 'expendedora__producto_' in ob.name):continue
    # Assign only the visible customer face. Existing box shape/envelope is preserved.
    idx=len(ob.data.materials);ob.data.materials.append(paper)
    uv=ob.data.uv_layers.active or ob.data.uv_layers.new(name='UVMap')
    lo=[min(v.co[i] for v in ob.data.vertices) for i in range(3)];hi=[max(v.co[i] for v in ob.data.vertices) for i in range(3)]
    design=len(printed)%6;u0=(design%3)/3;v0=1-((design//3)+1)/2
    for poly in ob.data.polygons:
        if poly.normal.y<-.9:
            poly.material_index=idx
            for li in poly.loop_indices:
                v=ob.data.vertices[ob.data.loops[li].vertex_index].co
                uv.data[li].uv=(u0+(v.x-lo[0])/max(hi[0]-lo[0],1e-6)/3,v0+(v.z-lo[2])/max(hi[2]-lo[2],1e-6)/2)
    ob['genericReference']=f'ILLUSTRATIVE-{design+1:02d}';printed.append(ob.name)

# Inactive old bump nodes/colour images are retained in the editable source only.
scene['studio_quality']='best';scene['studio_best_revision']='20261008-1'
scene['source_blend_sha256']=source_hash;scene['base_glb_sha256']=base_glb_hash
scene['reference_status']='Representative Xtanco reference; not a surveyed Altadis shop'
scene['pbr_provenance']='Original deterministic normal/roughness/colour maps, no external texture downloads'
scene['best_geometry_notes']='Refined bevels/plant curves, discrete cabinet hinges/vending vents/TPV keys; source dimensions and cutaway preserved'
scene.camera=bpy.data.objects['CAM_iso'];scene.camera.data.ortho_scale=max(scene.camera.data.ortho_scale,9.3)
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=40;scene.cycles.use_denoising=True
scene.cycles.adaptive_threshold=.05;scene.cycles.max_bounces=8
scene.render.resolution_x=1600;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB';scene.render.filepath=str(OUT/'xtanco-best-iso.png')
scene.render.film_transparent=False
bpy.context.view_layer.update()
source_objects={o.name for o in bpy.data.objects}
assert baseline_names<=source_objects
for it in layout['items']:assert bpy.data.objects.get(it['id']),it['id']
assert bpy.data.collections['Cerramiento_corte'].hide_render and bpy.data.collections['Cerramiento_corte'].hide_viewport
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'xtanco-best.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'xtanco-best.glb'),export_format='GLB',use_visible=True,export_extras=True,export_lights=False,export_cameras=False,export_apply=True)
optimization=runpy.run_path(str(SCRIPTS/'quantize_best.py'))['quantize_normals'](OUT/'xtanco-best.glb')

def metrics(path):
    b=path.read_bytes();length,_=struct.unpack_from('<II',b,12);j=json.loads(b[20:20+length]);prims=[p for m in j.get('meshes',[]) for p in m['primitives']]
    tri=sum(j['accessors'][p['indices']]['count']//3 if 'indices' in p else j['accessors'][p['attributes']['POSITION']]['count']//3 for p in prims)
    return {'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'nodes':len(j.get('nodes',[])),'meshes':len(j.get('meshes',[])),'triangles':tri,'materials':len(j.get('materials',[])),'images':len(j.get('images',[])),'normal_maps':sum('normalTexture'in m for m in j.get('materials',[])),'roughness_maps':sum('metallicRoughnessTexture'in m.get('pbrMetallicRoughness',{}) for m in j.get('materials',[])),'base_color_maps':sum('baseColorTexture'in m.get('pbrMetallicRoughness',{}) for m in j.get('materials',[])),'extensions':j.get('extensionsUsed',[])}
result={'schema':'studio.xtanco-best/1','id':'xtanco-best-studio-20261008','quality':'best','source':{'blend':str(SOURCE),'blend_sha256':source_hash,'base_glb':str(BASE_GLB),'glb':metrics(BASE_GLB),'layout':str(BASE_LAYOUT),'layout_sha256':layout_hash,'layout_version':layout['version'],'units':'meters','measured_against':'original layout JSON, not surveyed Altadis shop'},'files':{'blend':'xtanco-best.blend','glb':'xtanco-best.glb','preview':'xtanco-best-iso.png'},'glb':metrics(OUT/'xtanco-best.glb'),'changes':{'pbr_materials':maps,'refined_objects':len(refined),'new_hardware_objects':len(created),'printed_generic_product_fronts':len(printed),'refined_object_names':refined,'new_object_names':created},'provenance':json.loads((OUT/'textures'/'provenance.json').read_text()),'preserved':{'parent_ids':[i['id'] for i in layout['items']],'units':'meters','cutaway':True,'wall_display_replacement_node':'pantalla-pared','media_material_names':['PANTALLA_'+n for n in ('pantalla-pared','pantalla-mostrador','pantalla-escaparate','expendedora_display','tpv')]},'limitations':['Representative detailed model derived from the existing Xtanco source, not scanned or photorealistically certified','Material maps are original deterministic authored maps; no store-photo texture references or scanned material measurements','No automatic anamorphic warp/export; dynamic screen pixels remain owned by the Studio editor','No baked GI/AO; lighting remains separate from base colour','Render uses Cycles reference lighting; WebGL preview differs from Cycles','Labels are generic original illustrative references, not Stock SKUs or fabricated commercial brands']}
result['optimization']=optimization
assert result['glb']['bytes']<=20_000_000,result['glb']['bytes']
assert result['glb']['normal_maps']>=6 and result['glb']['roughness_maps']>=6
assert result['glb']['triangles']>result['source']['glb']['triangles']
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==source_hash
(OUT/'xtanco-best.manifest.json').write_text(json.dumps(result,indent=2,ensure_ascii=False))
print('BEST_EXPORT_READY',json.dumps(result['glb']),flush=True)
t=time.time();bpy.ops.render.render(write_still=True);print('BEST_RENDER_SECONDS',round(time.time()-t,2),flush=True)
result['file_metadata']={name:{'bytes':(OUT/name).stat().st_size,'sha256':hashlib.sha256((OUT/name).read_bytes()).hexdigest()}for name in result['files'].values()}
(OUT/'xtanco-best.manifest.json').write_text(json.dumps(result,indent=2,ensure_ascii=False))
