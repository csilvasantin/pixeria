// Shared by the canvas preview, MP4 encoder and persistence validation.
export const STORAGE_KEY = 'pixeria.adapter.v1';
export const defaults = () => ({modo:'auto',fx:.5,fy:.5,zoom:1});
const modes = ['auto','cover','contain','blur'];
const clamp = (v,lo,hi,fallback) => Number.isFinite(v) ? Math.max(lo,Math.min(hi,v)) : fallback;
export function settings(raw = {}) {
  return {modo:modes.includes(raw?.modo)?raw.modo:'auto',fx:clamp(raw?.fx,0,1,.5),fy:clamp(raw?.fy,0,1,.5),zoom:clamp(raw?.zoom,1,2,1)};
}
// Format families: the general library, the project's own formats (ficha) and its segmented videowalls.
const FAMILIES = {proyecto:f=>f.proyecto, especiales:f=>f.especial};
// Settings saved before the generic rename (5-oct-2026) used altadis* keys, and before the project
// fichas the family was «cliente»: migrate, never drop. Format ids keep their cliente-NN names.
const LEGACY = {profile:{altadis:'proyecto',cliente:'proyecto'}, id:id=>String(id).replace(/^altadis-/,'cliente-')};
function migrate(raw){
  if (!raw || typeof raw !== 'object') return raw;
  const fmt = raw.fmt && typeof raw.fmt === 'object' ? Object.fromEntries(Object.entries(raw.fmt).map(([k,v])=>[LEGACY.id(k),v])) : raw.fmt;
  return {...raw, profile:LEGACY.profile[raw.profile]||raw.profile, selected:Array.isArray(raw.selected)?raw.selected.map(LEGACY.id):raw.selected, fmt};
}
export function restore(raw, formats) {
  raw = migrate(raw);
  if (!raw || raw.version !== 1) return null;
  const family = FAMILIES[raw.profile];
  const profile = family && formats.some(family) ? raw.profile : 'standard';
  return {profile,compat:['universal','fhd','uhd'].includes(raw.compat)?raw.compat:'fhd',
    modoGlobal:modes.includes(raw.modoGlobal)?raw.modoGlobal:'auto',
    fmt:Object.fromEntries(formats.map(f=>[f.id,settings(raw.fmt?.[f.id])])),
    // Keep the inactive family's selection too; switching profiles never resets edits.
    selected:formats.filter(f=>Array.isArray(raw.selected)?raw.selected.includes(f.id):!f.proyecto&&!f.especial).map(f=>f.id)};
}
export function snapshot(state,formats) {
  return {version:1,profile:state.profile,compat:state.compat,modoGlobal:state.modoGlobal,
    custom:formats.filter(f=>f.user).map(f=>f.custom),
    selected:formats.filter(f=>f.on).map(f=>f.id),fmt:Object.fromEntries(formats.map(f=>[f.id,settings(state.fmt[f.id])]))};
}
const even = v => Math.max(2,Math.ceil(v/2)*2);
export function rect(source,W,H,mode,s=defaults()) {
  const k = (mode==='cover'?Math.max:Math.min)(W/source.ancho,H/source.alto)*s.zoom;
  const w=even(source.ancho*k),h=even(source.alto*k);
  // Align to chroma pixels so the preview and encoder use identical positioning.
  return {w,h,x:Math.round((W-w)*s.fx/2)*2,y:Math.round((H-h)*s.fy/2)*2};
}
// Crop in source space before scaling: a tall video on a 32:9 display must
// never allocate a 100-megapixel intermediate frame.
export function cropWindow(source,W,H,s) {
  const r=rect(source,W,H,'cover',s);
  const w=Math.max(2,Math.floor(W*source.ancho/r.w/2)*2),h=Math.max(2,Math.floor(H*source.alto/r.h/2)*2);
  return {w,h,x:Math.max(0,Math.min(source.ancho-w,Math.round(-r.x*source.ancho/r.w/2)*2)),
    y:Math.max(0,Math.min(source.alto-h,Math.round(-r.y*source.alto/r.h/2)*2))};
}
export function exportBudget(duration,jobs) {
  if(!Number.isFinite(duration)||duration<=0) return 'duration';
  const sizes=jobs.map(job=>(job.bitrateKbps+128)*1000/8*duration*1.1);
  if(sizes.some(size=>size>96*1048576)) return 'job-size';
  if(sizes.reduce((a,b)=>a+b,0)>192*1048576) return 'batch-size';
  return null;
}
// Filter graph that composes the reframed picture at W×H and labels it [label].
// The special layouts compose one master wall here and cut every screen from it.
export function composeFilter(source,W,H,mode,s,label='out',input='0:v') {
  const r=rect(source,W,H,mode,s);
  if(mode==='cover') {const c=cropWindow(source,W,H,s);return `[${input}]crop=${c.w}:${c.h}:${c.x}:${c.y},scale=${W}:${H},setsar=1[${label}]`;}
  const b=cropWindow(source,W,H,{fx:.5,fy:.5,zoom:1.1});
  const background=mode==='blur'
    ? `crop=${b.w}:${b.h}:${b.x}:${b.y},scale=${W}:${H},gblur=sigma=${(14*Math.max(W,H)/384).toFixed(3)},lutrgb=r=val*0.85:g=val*0.85:b=val*0.85`
    : `scale=${W}:${H},drawbox=c=black:t=fill`;
  return `[${input}]split[a][b];[a]${background},setsar=1[bg];[b]scale=${r.w}:${r.h},setsar=1[fg];[bg][fg]overlay=x=${r.x}:y=${r.y}:format=auto,setsar=1[${label}]`;
}
export function exportJob(source,profile,technical,mode,s,name,id) {
  const W=profile.ancho,H=profile.alto,filter=composeFilter(source,W,H,mode,s);
  const fps=technical.fps||25,rate=technical.bitrateKbps||profile.techoKbps;
  const filename=`${(name||'video').replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,80)}-${id.replace(/[^a-zA-Z0-9_-]/g,'x')}-${W}x${H}.mp4`;
  return {filename,W,H,bitrateKbps:rate,args:['-i','input','-filter_complex',filter,'-map','[out]','-map','0:a?',
    '-c:v','libx264','-preset','ultrafast','-threads','1','-profile:v',technical.h264Perfil||profile.h264.split('@')[0],
    '-level:v',technical.h264Nivel||profile.h264.split('@')[1],'-pix_fmt','yuv420p','-r',String(fps),
    '-b:v',`${rate}k`,'-maxrate',`${rate}k`,'-bufsize',`${rate*2}k`,'-g',String(Math.round(fps*(technical.gopSegundos||2))),
    '-c:a','aac','-b:a','128k','-movflags','+faststart','-fs',String(128*1048576),'output.mp4']};
}
// Still images (Carlos, 5-oct-2026): an image becomes an MP4 of a fixed, configurable length.
// Same jobs, same filter graph and the same limits as a video: only the input changes
// (-loop 1 at 25 fps for N seconds) and the audio goes away.
export const STILL = {min:1,max:60,default:10,fps:25};
export function stillSeconds(v) {
  const n=Math.round(Number(v));
  return Number.isFinite(n)&&n>0?Math.max(STILL.min,Math.min(STILL.max,n)):STILL.default;
}
// Image formats the adapter accepts as a source, with the extension FFmpeg reads them by.
export const STILL_TYPES = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/svg+xml':'svg','image/heic':'heic','image/heif':'heic','image/avif':'avif'};
// Every still starts as RGB with its alpha flattened onto black (what the canvas preview shows) and,
// from there, the encoder converts to limited-range yuv420p (-color_range tv): a JPEG never ends up
// as full-range yuvj420p, which many signage players show washed out.
export const STILL_PREP='format=rgba,premultiply=inplace=1,format=rgb24';
// Rewrites a video job for a picture input: new input arguments, the picture flattened onto black
// (plus `prep` filters) in front of the reframing graph, always 25 fps, no audio, limited range.
function pictureArgs(job,inputArgs,prep,tune) {
  const args=[],a=job.args,fps=String(STILL.fps);
  for(let i=0;i<a.length;i++) {
    if(a[i]==='-i'&&a[i+1]==='input'){args.push(...inputArgs);i++;continue;}
    if(a[i]==='-map'&&a[i+1]==='0:a?'){i++;continue;}
    if(a[i]==='-c:a'||a[i]==='-b:a'){i++;continue;}
    if(a[i]==='-filter_complex'){args.push(a[i],a[++i].replace('[0:v]',`[0:v]${prep},`));continue;}
    // Always 25 fps, whatever the plan of the profile says.
    if(a[i]==='-r'){args.push('-r',fps);i++;continue;}
    args.push(a[i]);
    if(a[i]==='-map'&&a[i+1]==='[out]'){args.push(a[++i],'-an');continue;}
    if(a[i]==='-c:v'&&a[i+1]==='libx264'&&tune){args.push(a[++i],'-tune',tune);continue;}
    if(a[i]==='-pix_fmt'&&a[i+1]==='yuv420p'){args.push(a[++i],'-color_range','tv');continue;}
  }
  return args;
}
// Turns any job (single format, special delivery or per-screen batch) into its still-image version.
export function stillJob(job,seconds,input='input.png') {
  const d=String(stillSeconds(seconds)),fps=String(STILL.fps);
  return {...job,args:pictureArgs(job,['-loop','1','-framerate',fps,'-t',d,'-i',input],STILL_PREP,'stillimage'),input,still:+d};
}
// Animated GIF (Carlos, 5-oct-2026): the GIF itself is the input, read once (-ignore_loop 1) with its
// own frame delays. It is flattened onto black like a still, the last frame is cloned and the result
// is resampled to 25 fps and cut at exactly round(duration × 25) frames: the MP4 lasts one loop
// whatever the FFmpeg version does with the last delay. Same reframing graph, no audio.
export const ANIM={maxSeconds:600};
export const animFrames=seconds=>Math.max(1,Math.round(Math.min(ANIM.maxSeconds,Number(seconds)||0)*STILL.fps));
export function animPrep(seconds){return `${STILL_PREP},tpad=stop_mode=clone:stop_duration=1,fps=${STILL.fps},trim=end_frame=${animFrames(seconds)},setpts=PTS-STARTPTS`;}
export function animJob(job,seconds,input='input.gif') {
  return {...job,args:pictureArgs(job,['-ignore_loop','1','-i',input],animPrep(seconds),null),input,anim:animFrames(seconds)/STILL.fps};
}
// Preview of an animated GIF where WebCodecs ImageDecoder is missing: a plain H.264 MP4 at the GIF
// size (rounded up to even) that the <video> plays in a loop. Exports never use it: they read the GIF.
export function animPreviewJob(seconds,W,H) {
  const w=Math.max(2,Math.ceil(W/2)*2),h=Math.max(2,Math.ceil(H/2)*2);
  return {filename:'gif-preview.mp4',W:w,H:h,bitrateKbps:0,input:'input.gif',args:['-ignore_loop','1','-i','input.gif','-filter_complex',`[0:v]${animPrep(seconds)},scale=${w}:${h},setsar=1[out]`,
    '-map','[out]','-an','-c:v','libx264','-preset','ultrafast','-threads','1','-crf','18','-pix_fmt','yuv420p','-r',String(STILL.fps),'-movflags','+faststart','output.mp4']};
}
