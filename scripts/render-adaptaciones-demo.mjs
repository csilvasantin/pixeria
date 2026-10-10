// Free, reproducible renders for the original JTI / Altadis example (PR #17).
// Uses the same geometry and encoder job as the interactive adapter.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,renameSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {defaults,exportJob} from '../adaptaciones/adapter-core.mjs';
import {perfilDeSalida,planificar} from '../assets/signage-perfiles.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const media=resolve(root,'adaptaciones/media');
const source=resolve(media,'jti-tu-sitio-de-siempre-fuente.mp4');
export const TARGETS=[
  {id:'1:1',width:1080,height:1080,file:'jti-1x1-1080x1080.mp4',poster:'jti-1x1-poster.jpg'},
  {id:'4:5',width:1080,height:1350,file:'jti-4x5-1080x1350.mp4',poster:'jti-4x5-poster.jpg'},
];
export function probe(path){return JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',path],{encoding:'utf8'}));}
export function sourceInfo(data){
  const v=data.streams.find(s=>s.codec_type==='video');
  if(!v)throw new Error('Source must contain a video stream');
  return {ancho:v.width,alto:v.height,fps:25,bitrateKbps:Math.round(Number(v.bit_rate)/1000)||0};
}
export function renderPlan(info,target){
  const profile=perfilDeSalida({formato:'custom',ancho:target.width,alto:target.height,compatibilidad:'fhd'});
  const technical=planificar(info,profile);
  const mode=['recortar','exacto'].includes(technical.encaje)?'cover':'blur';
  const focus=defaults();
  return {profile,technical,mode,focus,job:exportJob(info,profile,technical,mode,focus,'jti',target.id)};
}
export function verify(path,target,sourceData){
  const data=probe(path),v=data.streams.find(s=>s.codec_type==='video'),a=data.streams.find(s=>s.codec_type==='audio');
  const fail=message=>{throw new Error(`${target.file}: ${message}`);};
  if(!v||v.width!==target.width||v.height!==target.height)fail('wrong dimensions');
  if(v.codec_name!=='h264'||v.pix_fmt!=='yuv420p'||v.sample_aspect_ratio!=='1:1')fail('incompatible video');
  if(v.avg_frame_rate!=='25/1')fail('expected 25 fps');
  if(sourceData.streams.some(s=>s.codec_type==='audio')&&a?.codec_name!=='aac')fail('source audio was lost');
  if(Math.abs(Number(data.format.duration)-Number(sourceData.format.duration))>.1)fail('duration changed');
  if(statSync(path).size>=25*1024*1024)fail('exceeds Pages per-file limit');
  const bytes=readFileSync(path),moov=bytes.indexOf(Buffer.from('moov')),mdat=bytes.indexOf(Buffer.from('mdat'));
  if(moov<0||mdat<0||moov>mdat)fail('missing MP4 faststart');
  return {width:v.width,height:v.height,videoCodec:v.codec_name,pixelFormat:v.pix_fmt,fps:25,
    audioCodec:a?.codec_name||null,duration:Number(data.format.duration),bytes:bytes.length,
    sha256:createHash('sha256').update(bytes).digest('hex')};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  mkdirSync(media,{recursive:true});
  const data=probe(source),info=sourceInfo(data),renders=[];
  for(const target of TARGETS){
    const {technical,mode,focus,job}=renderPlan(info,target);
    const output=resolve(media,target.file),temp=output.replace(/\.mp4$/,'.tmp.mp4');
    console.log(`${target.id}: ${target.width}×${target.height}, ${mode}, focus ${focus.fx}/${focus.fy}, zoom ${focus.zoom}`);
    const args=job.args.map(a=>a==='input'?source:a==='output.mp4'?temp:a);
    execFileSync('ffmpeg',['-hide_banner','-loglevel','warning','-stats','-y',...args],{stdio:'inherit'});
    const verified=verify(temp,target,data);renameSync(temp,output);
    execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss','3','-i',output,'-frames:v','1','-vf','scale=480:-2','-q:v','2',resolve(media,target.poster)],{stdio:'inherit'});
    renders.push({id:target.id,file:target.file,poster:target.poster,mode,focus,rule:technical.encaje,
      cropLoss:technical.recortePerdido,bitrateKbps:technical.bitrateKbps,...verified});
    console.log(`Verified ${target.file}: ${verified.duration}s, AAC, ${(verified.bytes/1048576).toFixed(2)} MiB`);
  }
  writeFileSync(resolve(media,'jti-renders.json'),JSON.stringify({
    source:{file:'jti-tu-sitio-de-siempre-fuente.mp4',commit:'9a56112',
      sha256:createHash('sha256').update(readFileSync(source)).digest('hex'),width:info.ancho,height:info.alto,duration:Number(data.format.duration)},
    cases:['JTI «Tu sitio de siempre»','Altadis (same JTI media as PR #17)'],
    generator:'node scripts/render-adaptaciones-demo.mjs',compatibility:'fhd',
    notes:'Fixed rendered defaults: auto fit, centred focus, zoom 1. Geometry from adapter-core.mjs; 25 fps delivery, AAC audio. No paid services.',renders,
  },null,2)+'\n');
}
