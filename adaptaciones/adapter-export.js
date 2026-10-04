// Single-threaded encoder: no SharedArrayBuffer or production isolation headers.
const CORE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/';
export const MAX_SOURCE_BYTES = 100 * 1024 * 1024;
export function createExporter() {
  let worker, controller, cancelled=false;
  const urls=[];
  return {
    cancel() { cancelled=true;controller?.abort();worker?.terminate(); },
    async run(sourceURL,jobs,onStatus,onResult) {
      controller=new AbortController();
      try {
        onStatus({phase:'loading'});
        const {FFmpeg}=await import('/assets/vendor/ffmpeg/index.js');
        if(cancelled) throw new Error('cancelled');
        worker=new FFmpeg();
        const blobURL=async (file,type)=>{
          const response=await fetch(CORE+file,{signal:controller.signal});
          if(!response.ok) throw new Error('engine-download');
          const url=URL.createObjectURL(new Blob([await response.arrayBuffer()],{type}));urls.push(url);return url;
        };
        const [coreURL,wasmURL]=await Promise.all([blobURL('ffmpeg-core.js','text/javascript'),blobURL('ffmpeg-core.wasm','application/wasm')]);
        if(cancelled) throw new Error('cancelled');
        await worker.load({coreURL,wasmURL});
        onStatus({phase:'source'});
        const response=await fetch(sourceURL,{signal:controller.signal});
        if(!response.ok) throw new Error('source-download');
        if(+response.headers.get('content-length')>MAX_SOURCE_BYTES) throw new Error('source-size');
        const chunks=[];let length=0;
        const reader=response.body.getReader();
        try {while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>MAX_SOURCE_BYTES)throw new Error('source-size');chunks.push(value);}}
        finally {await reader.cancel();}
        const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
        chunks.length=0;
        await worker.writeFile('input',bytes);
        for(let i=0;i<jobs.length;i++) {
          if(cancelled) throw new Error('cancelled');
          const job=jobs[i];
          const progress=({progress})=>onStatus({phase:'encoding',job,index:i,total:jobs.length,progress:Math.min(.99,Math.max(0,progress))});
          worker.on('progress',progress);progress({progress:0});
          let code;
          try {code=await worker.exec(job.args);} finally {worker.off('progress',progress);}
          if(code!==0) throw new Error('encoding');
          // A special-layout job writes one MP4 per screen in a single pass.
          for(const output of job.outputs||[{...job,file:'output.mp4'}]) {
            const data=await worker.readFile(output.file);
            if(data.length>=124*1048576) throw new Error('output-size');
            if(!data.length) throw new Error('encoding');
            onResult(job.outputs?output:job,new Blob([data],{type:'video/mp4'}));
            await worker.deleteFile(output.file);
          }
        }
      } catch(error) { if(cancelled) throw new Error('cancelled');throw error; }
      finally {controller.abort();worker?.terminate();urls.forEach(url=>URL.revokeObjectURL(url));}
    }
  };
}
