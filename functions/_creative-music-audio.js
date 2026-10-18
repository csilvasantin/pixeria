export function validMusicAudioURL(value,clipId){
 let url;try{url=new URL(value);}catch{return null;}
 if(url.protocol!=='https:'||url.username||url.password||url.port)return null;
 if(/(^|\.)suno\.(ai|com)$/i.test(url.hostname)&&/\.(mp3|m4a|aac|wav|ogg)$/i.test(url.pathname))return url.href;
 return null;
}
export const MUSIC_AUDIO_MAX=5*1024*1024;
export function exportedAudioType(bytes,type){
 const data=new Uint8Array(bytes),text=(start,size)=>String.fromCharCode(...data.slice(start,start+size));
 if(type==='audio/mpeg'&&(text(0,3)==='ID3'||data.length>4&&data[0]===255&&(data[1]&224)===224&&(data[1]&6)!==0&&(data[2]&240)!==0&&(data[2]&240)!==240&&(data[2]&12)!==12))return type;
 if(['audio/mp4','audio/x-m4a'].includes(type)&&text(4,4)==='ftyp')return 'audio/mp4';
 return null;
}
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
// Private delivery of the official export. No public URL and no generation call.
export class MusicAudioStore{
 constructor(db){this.db=db;}
 async ready(){
  await this.db.prepare('CREATE TABLE IF NOT EXISTS studio_music_audio(request_id TEXT NOT NULL,clip_id TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,sha256 TEXT NOT NULL,PRIMARY KEY(request_id,clip_id))').run();
  await this.db.prepare('CREATE TABLE IF NOT EXISTS studio_music_audio_chunks(request_id TEXT NOT NULL,clip_id TEXT NOT NULL,seq INTEGER NOT NULL,bytes BLOB NOT NULL,PRIMARY KEY(request_id,clip_id,seq))').run();
 }
 async meta(id,clip){return this.db.prepare('SELECT * FROM studio_music_audio WHERE request_id=? AND clip_id=?').bind(id,clip).first();}
 async save(id,clip,bytes,mime){
  const sha256=await digest(bytes),size=bytes.byteLength,old=await this.meta(id,clip);
  if(old){if(old.sha256!==sha256||old.mime!==mime)throw Error('audio-already-delivered');return old;}
  const statements=[this.db.prepare('INSERT INTO studio_music_audio(request_id,clip_id,mime,size,sha256) VALUES(?,?,?,?,?)').bind(id,clip,mime,size,sha256)],data=new Uint8Array(bytes);
  for(let offset=0,seq=0;offset<size;offset+=131072,seq++)statements.push(this.db.prepare('INSERT INTO studio_music_audio_chunks(request_id,clip_id,seq,bytes) VALUES(?,?,?,?)').bind(id,clip,seq,data.slice(offset,offset+131072).buffer));
  try{await this.db.batch(statements);}catch(error){const saved=await this.meta(id,clip);if(saved?.sha256===sha256&&saved.mime===mime)return saved;if(saved)throw Error('audio-already-delivered');throw error;}
  return this.meta(id,clip);
 }
 async read(id,clip){
  const meta=await this.meta(id,clip);if(!meta)return null;
  const parts=await this.db.prepare('SELECT bytes FROM studio_music_audio_chunks WHERE request_id=? AND clip_id=? ORDER BY seq').bind(id,clip).all();
  const blob=new Blob((parts.results||[]).map(p=>new Uint8Array(p.bytes)),{type:meta.mime});
  if(blob.size!==meta.size||await digest(await blob.arrayBuffer())!==meta.sha256)throw Error('audio-integrity');
  return {blob,meta};
 }
}
