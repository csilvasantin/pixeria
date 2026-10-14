// Small real-frame samples, independent of YouTube thumbnails. CORS/decoding failure leaves
// the import usable with text classification; it never claims that video/audio was analyzed.
export const DEFAULT_IMPORT_FORMAT = 'video';
export async function sampleImportVideo(src, {timeout=12000}={}) {
  return new Promise(resolve=>{
    const video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='auto';
    if(!/^(blob|data):/.test(src))video.crossOrigin='anonymous';
    let finished=false,frames=[],times=[];
    const finish=()=>{if(finished)return;finished=true;clearTimeout(timer);video.removeAttribute('src');video.load();resolve(frames);};
    const timer=setTimeout(finish,timeout);video.onerror=finish;
    video.onloadedmetadata=()=>{const d=video.duration;if(!(Number.isFinite(d)&&d>0))return finish();times=[0.1,0.5,0.85].map(t=>Math.min(d-0.05,Math.max(0,d*t)));video.currentTime=times.shift();};
    video.onseeked=()=>{try{const scale=Math.min(1,640/video.videoWidth,960/video.videoHeight);const canvas=document.createElement('canvas');canvas.width=Math.max(2,Math.round(video.videoWidth*scale));canvas.height=Math.max(2,Math.round(video.videoHeight*scale));canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);const frame=canvas.toDataURL('image/jpeg',0.65);if(frame.length<280000)frames.push(frame);}catch{return finish();}if(!times.length)return finish();video.currentTime=times.shift();};
    video.src=src;
  });
}
