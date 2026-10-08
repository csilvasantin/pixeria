import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {exportJob,defaults} from '../adaptaciones/adapter-core.mjs';

test('detail export improves fidelity over the previous fast encode at the same bitrate', {skip:!process.env.ADAPTER_FFMPEG_TEST},()=>{
 const dir=mkdtempSync(tmpdir()+'/adapter-detail-');
 const run=args=>{const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{cwd:dir,encoding:'utf8'});assert.equal(r.status,0,r.stderr);};
 try{
  run(['-f','lavfi','-i','testsrc2=size=960x540:rate=25','-t','4','-c:v','ffv1','-f','matroska','input']);
  const source={ancho:960,alto:540},profile={ancho:360,alto:640,h264:'high@3.1',techoKbps:400};
  const job=exportJob(source,profile,{fps:25,bitrateKbps:400},'cover',defaults(),'detail','vertical');
  const graph=job.args[job.args.indexOf('-filter_complex')+1];
  run(['-i','input','-filter_complex',graph,'-map','[out]','-c:v','ffv1','reference.mkv']);
  const old=job.args.map((a,i)=>i===job.args.indexOf('-preset')+1?'ultrafast':a===graph?a.replaceAll(':flags=lanczos+accurate_rnd',''):a==='output.mp4'?'before.mp4':a);
  run(old);run(job.args);
  const score=file=>{const r=spawnSync('ffmpeg',['-hide_banner','-i',file,'-i','reference.mkv','-lavfi','ssim','-f','null','-'],{cwd:dir,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return Number([...r.stderr.matchAll(/All:([\d.]+)/g)].at(-1)[1]);};
  const before=score('before.mp4'),after=score('output.mp4');
  assert(after>before+.001,`SSIM before=${before}, after=${after}`);
  const probe=spawnSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json','output.mp4'],{cwd:dir,encoding:'utf8'});assert.equal(probe.status,0);
  const p=JSON.parse(probe.stdout),v=p.streams[0];assert.deepEqual([v.width,v.height],[360,640]);assert.equal(v.codec_name,'h264');assert.equal(v.pix_fmt,'yuv420p');assert.equal(v.r_frame_rate,'25/1');assert(Math.abs(Number(p.format.duration)-4)<.1);
  console.log(`Detail fixture SSIM: ${before} -> ${after}; same 400 kbps target, 360x640, 25 fps`);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
