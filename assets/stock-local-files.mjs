export const MAX_LOCAL_FILES = 5;
export const MAX_LOCAL_BYTES = 100_000_000;
const MIME = {mp4:'video/mp4',m4v:'video/mp4',mov:'video/quicktime',webm:'video/webm',mkv:'video/x-matroska',avi:'video/x-msvideo',mp3:'audio/mpeg',m4a:'audio/mp4',aac:'audio/aac',wav:'audio/wav',ogg:'audio/ogg',flac:'audio/flac',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',gif:'image/gif',webp:'image/webp',avif:'image/avif',heic:'image/heic',heif:'image/heif',svg:'image/svg+xml'};
export function localMedia(file) {
  let mime=String(file.type||'').split(';')[0].toLowerCase();
  if(!mime||mime==='application/octet-stream')mime=MIME[String(file.name||'').split('.').at(-1).toLowerCase()]||'';
  const type=mime.split('/')[0];
  return ['video','audio','image'].includes(type)?{type,mime}:null;
}
export function validateLocalFiles(files) {
  if(!files.length)return 'Selecciona al menos un archivo.';
  if(files.length>MAX_LOCAL_FILES)return 'Puedes subir hasta 5 archivos por carga.';
  for(const f of files){
    if(!Number.isSafeInteger(f.size)||f.size<=0)return 'El archivo «'+f.name+'» está vacío.';
    if(f.size>MAX_LOCAL_BYTES)return '«'+f.name+'» supera los 100 MB por archivo.';
    if(!localMedia(f))return '«'+f.name+'» no es un vídeo, audio o imagen compatible.';
  }
  return '';
}
export function localTags(text) {return [...new Set(String(text||'').split(/[\s,]+/).map(t=>t.replace(/^#+/,'').trim()).filter(Boolean))].slice(0,32);}
