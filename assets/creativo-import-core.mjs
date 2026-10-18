const SOCIAL=/(^|\.)(youtube\.com|youtu\.be|vimeo\.com|twitter\.com|x\.com|tiktok\.com|instagram\.com|facebook\.com|fb\.watch)$/i;
const DIRECT=/\.(mp4|webm|mov|m4v|mp3|wav|m4a|aac|ogg|flac|png|jpe?g|webp|gif|avif)(?:$)/i;
export function publicImportURL(value){
 let url;try{url=new URL(value);}catch{throw Error('import-url');}
 const host=url.hostname.toLowerCase();
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.port||host==='localhost'||host.endsWith('.local')||host.endsWith('.localhost')||host.startsWith('[')||/^\d+\.\d+\.\d+\.\d+$/.test(host))throw Error('import-url');
 url.hash='';return url.href;
}
export function parseImportCommand(value){
 const text=String(value||'').trim(),command=/^\/?(?:importar|import)\b\s*([\s\S]*)$/i.exec(text);
 if(!command&&!/^https?:\/\//i.test(text))return null;
 let input=command?command[1].trim():text;if(!input||/^(help|ayuda)$/i.test(input))return {help:true};
 const parts=/^(?:"([^"]+)"|'([^']+)'|([^\s]+))(?:\s+(audio|video))?$/i.exec(input);if(!parts)throw Error('import-url');
 const url=publicImportURL(parts[1]||parts[2]||parts[3]),path=new URL(url).pathname;
 return {url,format:parts[4]?.toLowerCase()||(/\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(path)?'audio':'video'),direct:DIRECT.test(path)||!SOCIAL.test(new URL(url).hostname)};
}
export async function importIdentity(order){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(order.url+'\n'+order.format)));return 'url-'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');}
export function importMessage(error,en=false){const known={'import-url':en?'Paste one public media URL after /import.':'Pega una URL pública de contenido después de /importar.','import-offline':en?'The importer is unavailable. Your URL is saved.':'El importador no responde. La URL queda guardada.','import-too-large':en?'The file exceeds 100 MB.':'El archivo supera los 100 MB.','import-not-media':en?'This URL did not return audio, image or video.':'La URL no ha devuelto audio, imagen o vídeo.','import-unknown':en?'The result is unconfirmed. It will not be sent again automatically.':'No se pudo confirmar el resultado. No se volverá a enviar automáticamente.'};return known[error?.message]||(en?'Could not complete the import. The URL is saved.':'No se ha podido completar la importación. La URL queda guardada.');}
