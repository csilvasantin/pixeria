import {test} from 'node:test';
import assert from 'node:assert/strict';
import {restore,snapshot,rect,cropWindow,exportBudget,exportJob} from '../adaptaciones/adapter-core.mjs';
import {perfilDeSalida,planificar} from '../assets/signage-perfiles.js';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
const formats=[{id:'16:9',on:true},{id:'cliente-V',cliente:true,on:false}];
test('restore validates data and retains each family selection',()=>{
 assert.equal(restore({version:8},formats),null);
 const state=restore({version:1,profile:'altadis',compat:'bad',modoGlobal:'evil',selected:['16:9','unknown'],fmt:{'16:9':{modo:'cover',fx:-2,fy:99,zoom:NaN}}},formats);
 assert.equal(state.profile,'cliente');assert.equal(state.compat,'fhd');assert.equal(state.modoGlobal,'auto');assert.deepEqual(state.selected,['16:9']);
 assert.deepEqual(state.fmt['16:9'],{modo:'cover',fx:0,fy:1,zoom:1});
 assert.deepEqual(restore(snapshot(state,formats),formats),state);
});
test('crop edges cover target and contain respects focus at zoom 1 and 2',()=>{
 for(const source of [{ancho:640,alto:360},{ancho:360,alto:640}])for(const [W,H] of [[720,1280],[1280,720],[1080,1080]])for(const zoom of [1,2])for(const fx of [0,.5,1])for(const fy of [0,.5,1]) {
  const r=rect(source,W,H,'cover',{zoom,fx,fy});assert(r.w>=W&&r.h>=H);assert(r.x<=0&&r.x+r.w>=W);assert(r.y<=0&&r.y+r.h>=H);assert.equal(r.w%2,0);assert.equal(r.h%2,0);
  const c=rect(source,W,H,'contain',{zoom,fx,fy});if(zoom===1)assert(c.w<=W+2&&c.h<=H+2);
 }
});
test('real FFmpeg preserves H264/AAC, dimensions, duration and silent inputs for all methods', {skip:!process.env.ADAPTER_FFMPEG_TEST},()=>{
 const dir=mkdtempSync(tmpdir()+'/adapter-');
 const run=args=>{const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);};
 try {
  run(['-f','lavfi','-i','testsrc2=size=640x360:rate=25','-f','lavfi','-i','sine=frequency=880:sample_rate=48000','-t','1','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',dir+'/source.mp4']);
  run(['-i',dir+'/source.mp4','-an','-c:v','copy',dir+'/silent.mp4']);
  for(const mode of ['cover','contain','blur'])for(const audio of [true,false]) {
   const source={ancho:640,alto:360,fps:25},p=perfilDeSalida({formato:'custom',ancho:180,alto:320,compatibilidad:'universal'}),tech=planificar(source,p);
   const job=exportJob(source,p,tech,mode,{fx:1,fy:0,zoom:1.3},'fixture','9:16');
   run(job.args.map(x=>x==='input'?`${dir}/${audio?'source':'silent'}.mp4`:x==='output.mp4'?dir+'/output.mp4':x));
   const result=spawnSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',dir+'/output.mp4'],{encoding:'utf8'});assert.equal(result.status,0);
   const data=JSON.parse(result.stdout),v=data.streams.find(s=>s.codec_type==='video');assert.equal(v.codec_name,'h264');assert.equal(v.width,p.ancho);assert.equal(v.height,p.alto);assert.equal(v.pix_fmt,'yuv420p');assert(Math.abs(+data.format.duration-1)<.1);
   const a=data.streams.find(s=>s.codec_type==='audio');assert.equal(!!a,audio);if(a)assert.equal(a.codec_name,'aac');
  }
 } finally {rmSync(dir,{recursive:true,force:true});}
});

test('extreme client-profile crop avoids enormous scale intermediates and batch budgets fail early',()=>{
 const source={ancho:1080,alto:1920};const c=cropWindow(source,3840,540,{fx:1,fy:1,zoom:2});
 assert(c.x>=0&&c.x+c.w<=1080&&c.y>=0&&c.y+c.h<=1920);
 const job=exportJob(source,{ancho:3840,alto:540,h264:'high@5.1',techoKbps:20000},{fps:25},'cover',{fx:1,fy:1,zoom:2},'test','bar');
 assert.match(job.args[job.args.indexOf('-filter_complex')+1],/^\[0:v\]crop=.*scale=3840:540/);
 assert.equal(exportBudget(60,Array(18).fill({bitrateKbps:20000})),'job-size');
 assert.equal(exportBudget(60,Array(18).fill({bitrateKbps:8000})),'batch-size');
 assert.equal(exportBudget(2,Array(18).fill({bitrateKbps:20000})),null);
 assert.equal(exportBudget(Infinity,[]),'duration');
});

test('settings saved with the old altadis* keys migrate to the generic client profile',()=>{
 const formats=[{id:'16:9',on:true},{id:'cliente-01',cliente:true,on:true}];
 const state=restore({version:1,profile:'altadis',selected:['16:9','altadis-01'],fmt:{'altadis-01':{modo:'blur',fx:.2,fy:.7,zoom:1.4}}},formats);
 assert.equal(state.profile,'cliente');assert.deepEqual(state.selected,['16:9','cliente-01']);
 assert.deepEqual(state.fmt['cliente-01'],{modo:'blur',fx:.2,fy:.7,zoom:1.4});
});
