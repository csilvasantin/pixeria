import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {aiJob,aiGraph,generateBackground,referenceSize} from '../adaptaciones/ia-core.mjs';
import {restoreApplications,applyApplications,formatContract} from '../adaptaciones/aplicaciones-core.mjs';
import {projectLibrary} from '../adaptaciones/proyectos-core.mjs';import {atlasJob,segmentsJob,geometry} from '../adaptaciones/especiales-core.mjs';
import {exportJob,stillJob} from '../adaptaciones/adapter-core.mjs';import {packagePlan} from '../adaptaciones/estancos-core.mjs';
const json=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const ficha=json('adaptaciones/proyectos/altadis-estancos-bcn.json'),doc=json('adaptaciones/proyectos/estancos/altadis-estancos-bcn.json');
const formats=projectLibrary([],ficha,{estandar:json('adaptaciones/perfil-cliente-18.json').formats,especiales:json('adaptaciones/perfil-cliente-especiales.json').layouts},false);
const src={ancho:1080,alto:1920},s={fx:.5,fy:.5,zoom:1},tech={bitrateKbps:8000,h264Perfil:'high',h264Nivel:'5.1',segmentPerfil:'high',segmentNivel:'4.0'};
test('saved virtual walls preserve 18 original surfaces and give package exact delivery sizes',()=>{
  const before=JSON.stringify(doc),apps=restoreApplications([{estanco:doc.estancos[0].id,formato:'cliente-esp-2'}, {estanco:doc.estancos[0].id,formato:'cliente-esp-2'},{estanco:'foreign',formato:'cliente-esp-2'}],doc,formats);
  assert.equal(apps.length,1);const applied=applyApplications(doc,apps,formats);assert.equal(JSON.stringify(doc),before);
  assert.equal(applied.estancos.flatMap(e=>e.pantallas).length,19);assert.equal(applied.estancos[0].pantallas.at(-1).virtual,true);
  const plan=packagePlan(applied,[doc.estancos[0].id],formats);assert.deepEqual([plan.at(-1).ancho,plan.at(-1).alto],[1280,1080]);
  const contract=formatContract(ficha,formats,doc,apps);assert.equal(contract.formatos.length,29);assert.deepEqual(contract.formatos.find(f=>f.id==='cliente-esp-2').layout,formats.find(f=>f.id==='cliente-esp-2').layout);
  assert.equal(contract.estancos.estancos[0].pantallas.length,2);
});
test('AI wall is composed once before atlas and all segment cuts, still rewrite keeps background input',()=>{
  for(const f of formats.filter(f=>f.layout))for(const fn of [atlasJob,segmentsJob]){
    const out=geometry(f.layout).pared,base=fn(src,f.layout,'blur',s,tech),job=aiJob(base,src,out,s,'data:image/png;base64,YQ==',{wall:true});
    const graph=job.args[job.args.indexOf('-filter_complex')+1];assert.ok(graph.includes(aiGraph(src,out,s,'wall','src')));assert.ok(graph.includes('[wall]split='));assert.equal(graph.includes('gblur'),false);
    assert.equal(job.extraFiles[0].name,'ai-background.png');const still=stillJob(job,10,'input.png');assert.ok(still.args.includes('ai-background.png'));assert.ok(still.args.includes('-t'));
  }
});
test('AI export overlays contained source without crop and limits generation reference',()=>{
  const profile={ancho:1920,alto:158,techoKbps:8000,h264:'high@4.0'},job=aiJob(exportJob(src,profile,tech,'blur',s,'demo','shuttle'),src,profile,s,'bg');
  assert.ok(job.args.includes('ai-background.png'));const graph=job.args[job.args.indexOf('-filter_complex')+1];assert.equal(graph.includes('crop='),false);assert.match(graph,/shortest=1/);
  assert.ok(referenceSize({ancho:14400,alto:540}).ancho<=1536);
});
test('generation requires session and rejects empty or malformed provider result',async()=>{
  let calls=0;await assert.rejects(generateBackground('reference',{ancho:100,alto:20},'',{fetchImpl:async()=>{calls++;return{ok:false,status:401}}}),/session/);assert.equal(calls,1);
  let n=0;const fetchImpl=async()=>++n===1?{ok:true,json:async()=>({token:'test-token'})}:{ok:true,json:async()=>({ok:true,image:'javascript:invalid'})};await assert.rejects(generateBackground('reference',{ancho:100,alto:20},'',{fetchImpl}),/HTTP/);
});
import {spawnSync} from 'node:child_process';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';
test('real AI-background encode: native atlas, six equal 25fps segments, still export', {skip:!process.env.ADAPTER_FFMPEG_TEST},()=>{
  const dir=mkdtempSync(tmpdir()+'/studio-ia-'),run=args=>{const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{cwd:dir,encoding:'utf8'});assert.equal(r.status,0,r.stderr);};
  const probe=file=>{const r=spawnSync('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',file],{cwd:dir,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
  try{
    run(['-f','lavfi','-i','color=red:size=1080x1920:rate=25','-t','0.4','-c:v','libx264','-pix_fmt','yuv420p','-f','mp4','input']);
    run(['-f','lavfi','-i','color=green:size=1536x144','-frames:v','1','-threads','1','ai-background.png']);
    const f=formats.find(f=>f.id==='cliente-esp-2'),out=geometry(f.layout).pared;
    const a=aiJob(atlasJob(src,f.layout,'blur',s,tech),src,out,s,'bg',{wall:true});run(a.args);
    const p=probe('output.mp4'),v=p.streams.find(s=>s.codec_type==='video');assert.deepEqual([v.width,v.height],[1280,1080]);assert.equal(v.r_frame_rate,'25/1');assert.equal(v.nb_read_frames,'10');
    const seg=aiJob(segmentsJob(src,f.layout,'blur',s,tech),src,out,s,'bg',{wall:true});run(seg.args);
    for(let n=1;n<=6;n++){const v=probe(`seg${n}.mp4`).streams[0];assert.deepEqual([v.width,v.height],[640,360]);assert.equal(v.nb_read_frames,'10');}
    run(['-i','input','-frames:v','1','-threads','1','input.png']);run(stillJob(a,1,'input.png').args);assert.equal(probe('output.mp4').streams[0].nb_read_frames,'25');
  }finally{rmSync(dir,{recursive:true,force:true});}
});
