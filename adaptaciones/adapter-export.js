// Persistent export engine. FFmpeg.wasm already encodes inside its own Web Worker
// (assets/vendor/ffmpeg/classes.js → new Worker), so the page never blocks while it
// works. The engine stays loaded between jobs and keeps the last source in memory:
// a queue of formats from the same video downloads the engine and the source once.
// Single-threaded core: no SharedArrayBuffer or production isolation headers.
// The input file is `input` (video) or the name the job asks for: a still image is read
// by extension (`input.png`), which is what lets the image2 demuxer honour -loop 1.
const CORE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/';
export const MAX_SOURCE_BYTES = 100 * 1024 * 1024;
export const MAX_OUTPUT_BYTES = 124 * 1048576;
export function createEngine() {
  let ffmpeg=null, loading=null, inputURL=null, inputName='input', controller=null, generation=0;
  const urls=[];
  function reset() {
    generation++;controller?.abort();controller=null;
    try{ffmpeg?.terminate();}catch(_){}
    ffmpeg=null;loading=null;inputURL=null;urls.splice(0).forEach(url=>URL.revokeObjectURL(url));
  }
  async function load(onStatus,signal) {
    if(ffmpeg) return ffmpeg;
    if(!loading) loading=(async()=>{
      const gen=generation;
      onStatus({phase:'loading'});
      const {FFmpeg}=await import('/assets/vendor/ffmpeg/index.js');
      const blobURL=async (file,type)=>{
        const response=await fetch(CORE+file,{signal});
        if(!response.ok) throw new Error('engine-download');
        const url=URL.createObjectURL(new Blob([await response.arrayBuffer()],{type}));urls.push(url);return url;
      };
      const [coreURL,wasmURL]=await Promise.all([blobURL('ffmpeg-core.js','text/javascript'),blobURL('ffmpeg-core.wasm','application/wasm')]);
      const instance=new FFmpeg();await instance.load({coreURL,wasmURL});
      if(gen!==generation){try{instance.terminate();}catch(_){}throw new Error('cancelled');}
      ffmpeg=instance;return instance;
    })().catch(error=>{loading=null;throw error;});
    return loading;
  }
  async function readSource(sourceURL,signal) {
    const response=await fetch(sourceURL,{signal});
    if(!response.ok) throw new Error('source-download');
    if(+response.headers.get('content-length')>MAX_SOURCE_BYTES) throw new Error('source-size');
    const chunks=[];let length=0;
    const reader=response.body.getReader();
    try {while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>MAX_SOURCE_BYTES)throw new Error('source-size');chunks.push(value);}}
    finally {await reader.cancel().catch(()=>{});}
    const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    return bytes;
  }
  return {
    // Stops whatever is running and frees the worker; the next job reloads the engine.
    cancel: reset,
    // Encodes one job. onResult receives every output file (special layouts write several).
    async encode(sourceURL,job,onStatus,onResult) {
      const mine=++generation;controller=new AbortController();const {signal}=controller;
      const alive=()=>{if(mine!==generation)throw new Error('cancelled');};
      try {
        const engine=await load(onStatus,signal);alive();
        const name=job.input||'input';
        if(inputURL!==sourceURL||inputName!==name) {
          onStatus({phase:'source'});
          if(inputURL){await engine.deleteFile(inputName).catch(()=>{});inputURL=null;}
          const bytes=await readSource(sourceURL,signal);alive();
          await engine.writeFile(name,bytes);inputURL=sourceURL;inputName=name;
        }
        // Crear (6-oct-2026): extra inputs of a recipe (the ticker strip PNG), written for this job only.
        for(const x of job.extraFiles||[]){const bytes=await readSource(x.url,signal);alive();await engine.writeFile(x.name,bytes);}
        const progress=({progress})=>{if(mine===generation)onStatus({phase:'encoding',progress:Math.min(.99,Math.max(0,progress))});};
        // Looping still inputs report unknown duration to FFmpeg; use its encoded clock
        // against the explicit output duration so campaign progress does not stay at 0%.
        const clock=({message})=>{const m=/time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(message);if(m&&Number.isFinite(job.durationSeconds)&&job.durationSeconds>0)progress({progress:(+m[1]*3600 + +m[2]*60 + +m[3])/job.durationSeconds});};
        engine.on('progress',progress);engine.on('log',clock);progress({progress:0});
        let code;
        try {code=await engine.exec(job.args);} finally {engine.off('progress',progress);engine.off('log',clock);for(const x of job.extraFiles||[])await engine.deleteFile(x.name).catch(()=>{});}
        alive();
        if(code!==0) throw new Error('encoding');
        for(const output of job.outputs||[{...job,file:'output.mp4'}]) {
          const data=await engine.readFile(output.file);alive();
          await engine.deleteFile(output.file).catch(()=>{});
          if(data.length>=MAX_OUTPUT_BYTES) throw new Error('output-size');
          if(!data.length) throw new Error('encoding');
          onResult(job.outputs?output:job,new Blob([data],{type:'video/mp4'}));
        }
      } catch(error) {
        if(mine!==generation) throw new Error('cancelled');
        // A failed run can leave the worker in an unknown state: start clean next time.
        reset();throw error;
      }
    }
  };
}
