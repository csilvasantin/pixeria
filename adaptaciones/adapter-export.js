// Persistent export engine. FFmpeg.wasm already encodes inside its own Web Worker
// (assets/vendor/ffmpeg/classes.js → new Worker), so the page never blocks while it
// works. The engine stays loaded between jobs and keeps the last source in memory:
// a queue of formats from the same video downloads the engine and the source once.
// Single-threaded core: no SharedArrayBuffer or production isolation headers.
const CORE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/';
export const MAX_SOURCE_BYTES = 100 * 1024 * 1024;
export const MAX_OUTPUT_BYTES = 124 * 1048576;
export function createEngine() {
  let ffmpeg=null, loading=null, inputURL=null, controller=null, generation=0;
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
        if(inputURL!==sourceURL) {
          onStatus({phase:'source'});
          if(inputURL){await engine.deleteFile('input').catch(()=>{});inputURL=null;}
          const bytes=await readSource(sourceURL,signal);alive();
          await engine.writeFile('input',bytes);inputURL=sourceURL;
        }
        const progress=({progress})=>{if(mine===generation)onStatus({phase:'encoding',progress:Math.min(.99,Math.max(0,progress))});};
        engine.on('progress',progress);progress({progress:0});
        let code;
        try {code=await engine.exec(job.args);} finally {engine.off('progress',progress);}
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
