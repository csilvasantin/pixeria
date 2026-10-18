export class QueueError extends Error{constructor(message,status=400){super(message);this.status=status;}}
const fail=(message,status)=>{throw new QueueError(message,status);};
const idOk=value=>typeof value==='string'&&/^[a-z0-9_-]{1,100}$/i.test(value);
const phases=['en_cola','recibido','auditoria','en_suno','generando','recuperando_audio','terminado','bloqueado','sin_confirmar'];
const rank={en_cola:0,recibido:1,auditoria:1,en_suno:2,generando:3,recuperando_audio:4,terminado:5};
const iso=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('');
export function validateSong(data){
 if(!idOk(data?.request_id)||typeof data.lyrics!=='string'||!data.lyrics.trim()||data.lyrics.length>5000||!['chico','chica'].includes(data.voice)||!Array.isArray(data.languages)||!data.languages.length||data.languages.length>2||data.languages.some(x=>!['ESP','ENG'].includes(x))||typeof data.style!=='string'||!data.style.trim()||data.style.length>120||typeof data.title!=='string'||data.title.length>200)fail('invalid-song');
 if(data.previous_pending_id!==undefined&&!idOk(data.previous_pending_id))fail('invalid-reference');if(data.previous_clip_ids!==undefined&&(!Array.isArray(data.previous_clip_ids)||data.previous_clip_ids.length>4||data.previous_clip_ids.some(x=>!idOk(x))))fail('invalid-reference');
 return {request_id:data.request_id,lyrics:data.lyrics,voice:data.voice,languages:[...new Set(data.languages)],style:data.style.trim(),title:data.title,...(data.previous_pending_id?{previous_pending_id:data.previous_pending_id}:{}),...(data.previous_clip_ids?.length?{previous_clip_ids:data.previous_clip_ids}:{})};
}
export function validatePart(data){
 if(!idOk(data?.request_id)||!idOk(data.claim_token)||!Number.isSafeInteger(data.revision)||data.revision<1||!phases.includes(data.phase)||typeof data.message!=='string'||!data.message.trim()||data.message.length>600)fail('invalid-progress');
 const value={request_id:data.request_id,claim_token:data.claim_token,revision:data.revision,phase:data.phase,message:data.message};
 if(data.encargo!==undefined){if(!Number.isSafeInteger(data.encargo)||data.encargo<1)fail('invalid-assignment');value.encargo=data.encargo;}
 if(data.started_at!==undefined){if(!iso(data.started_at)||Date.parse(data.started_at)>Date.now()+60000)fail('invalid-start');value.started_at=iso(data.started_at);}
 if(data.remaining_min_seconds!==undefined||data.remaining_max_seconds!==undefined){if(!Number.isFinite(data.remaining_min_seconds)||!Number.isFinite(data.remaining_max_seconds)||data.remaining_min_seconds<0||data.remaining_max_seconds<data.remaining_min_seconds||data.remaining_max_seconds>86400||typeof data.eta_basis!=='string'||!data.eta_basis.trim()||data.eta_basis.length>200)fail('invalid-estimate');Object.assign(value,{remaining_min_seconds:data.remaining_min_seconds,remaining_max_seconds:data.remaining_max_seconds,eta_basis:data.eta_basis});}
 if(data.clips!==undefined){
  if(!Array.isArray(data.clips)||data.clips.length>4)fail('invalid-clips');
  value.clips=data.clips.map(clip=>{let url;try{url=new URL(clip.audio_url);}catch{fail('invalid-clip-url');}if(url.protocol!=='https:'||url.username||url.password||!/(^|\.)suno\.(ai|com)$/i.test(url.hostname)||!idOk(clip.id))fail('invalid-clip-url');return {id:clip.id,audio_url:url.href,title:String(clip.title||'').slice(0,200)};});
 }
 return value;
}
function view(row){const progress=JSON.parse(row.progress);return {request_id:row.request_id,action:row.action,state:row.state,revision:row.revision,submitted_at:row.submitted_at,tracking_at:row.tracking_at,updated_at:row.updated_at,claimed_at:row.claimed_at,finished_at:row.finished_at,...progress,clips:progress.clips||[]};}
const SCHEMA=`CREATE TABLE IF NOT EXISTS studio_music_requests(request_id TEXT PRIMARY KEY,owner TEXT NOT NULL,payload TEXT NOT NULL,payload_hash TEXT NOT NULL,action TEXT NOT NULL,state TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0,submitted_at TEXT,tracking_at TEXT NOT NULL,updated_at TEXT NOT NULL,claimed_at TEXT,claim_hash TEXT,claimed_by TEXT,finished_at TEXT,progress TEXT NOT NULL)`;
export class MusicQueue{
 constructor(db,now=()=>new Date().toISOString()){this.db=db;this.now=now;}
 async ready(){await this.db.prepare(SCHEMA).run();}
 async row(id){if(!idOk(id))fail('invalid-reference');const row=await this.db.prepare('SELECT * FROM studio_music_requests WHERE request_id=?').bind(id).first();if(!row)fail('request-not-found',404);return row;}
 async get(id,owner,operator=false){const row=await this.row(id);if(row.owner!==owner.toLowerCase()&&!operator)fail('request-not-found',404);return view(row);}
 async list(){const result=await this.db.prepare("SELECT * FROM studio_music_requests WHERE state NOT IN ('complete','failed') ORDER BY tracking_at LIMIT 100").all();return (result.results||[]).map(row=>({...view(row),song:JSON.parse(row.payload)}));}
 async create(owner,song,audit=false){
  owner=owner.toLowerCase();const now=this.now(),digest=await hash(JSON.stringify(song)),action=audit?'audit_only':'create_song';
  const progress={phase:audit?'auditoria':'en_cola',message:audit?'Comprobando el intento anterior con los consejeros. No se vuelve a generar.':'Esperando a que un consejero recoja el encargo.'};
  await this.db.prepare('INSERT OR IGNORE INTO studio_music_requests(request_id,owner,payload,payload_hash,action,state,submitted_at,tracking_at,updated_at,progress) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(song.request_id,owner,JSON.stringify(song),digest,action,audit?'unknown':'pending',audit?null:now,now,now,JSON.stringify(progress)).run();
  const row=await this.row(song.request_id);if(row.owner!==owner)fail('request-id-conflict',409);if(row.payload_hash!==digest)fail('request-content-conflict',409);
  if(row.action!==action&&action==='create_song')fail('request-already-tracked',409);return view(row);
 }
 async claim(id,operator){
  const row=await this.row(id);if(row.claim_hash||['complete','failed'].includes(row.state))fail('already-claimed',409);
  const token=crypto.randomUUID(),now=this.now(),progress={...JSON.parse(row.progress),phase:row.action==='audit_only'?'auditoria':'recibido',message:row.action==='audit_only'?'El consejero está comprobando el intento anterior.':'El consejero ha recibido el encargo.'};
  const changed=await this.db.prepare('UPDATE studio_music_requests SET claim_hash=?,claimed_by=?,claimed_at=?,updated_at=?,revision=revision+1,progress=? WHERE request_id=? AND claim_hash IS NULL AND revision=?').bind(await hash(token),operator.toLowerCase(),now,now,JSON.stringify(progress),id,row.revision).run();
  if(changed.meta.changes!==1)fail('already-claimed',409);return {...await this.get(id,operator,true),claim_token:token,song:JSON.parse(row.payload)};
 }
 async update(part,operator){
  part=validatePart(part);
  const row=await this.row(part.request_id),old=JSON.parse(row.progress);
  if(row.claimed_by!==operator.toLowerCase()||!row.claim_hash||await hash(part.claim_token)!==row.claim_hash)fail('claim-required',403);
  if(row.revision!==part.revision)fail('stale-progress',409);
  if(['complete','failed'].includes(row.state))fail('request-finished',409);
  if(row.action==='audit_only'&&['en_suno','generando'].includes(part.phase))fail('audit-cannot-generate',409);
  if(part.phase==='en_cola'||part.phase==='recibido'||part.phase==='en_suno'&&old.generation_attempted_at)fail('cannot-restart',409);
  if(rank[part.phase]!==undefined&&rank[part.phase]<(old.max_phase_rank||0))fail('cannot-go-back',409);
  const now=this.now(),progress={phase:part.phase,message:part.message,encargo:part.encargo||old.encargo,max_phase_rank:Math.max(old.max_phase_rank||0,rank[part.phase]||0),started_at:old.started_at||part.started_at||null,generation_attempted_at:old.generation_attempted_at||(part.phase==='en_suno'?now:null),clips:part.clips||old.clips||[]};
  if(row.action==='create_song'&&progress.started_at&&Date.parse(progress.started_at)<Date.parse(row.submitted_at||row.tracking_at)-60000)fail('invalid-start');
  if(part.phase==='en_suno')progress.started_at=progress.started_at||now;
  if(part.remaining_min_seconds!==undefined&&!['terminado','bloqueado','sin_confirmar'].includes(part.phase))Object.assign(progress,{remaining_min_seconds:part.remaining_min_seconds,remaining_max_seconds:part.remaining_max_seconds,eta_basis:part.eta_basis});
  if(part.phase==='terminado'&&row.action==='create_song'&&!progress.clips.length)fail('audio-required');
  const state=part.phase==='terminado'?(progress.clips.length?'complete':'failed'):part.phase==='bloqueado'?'blocked':part.phase==='sin_confirmar'?'unknown':'pending';
  const result=await this.db.prepare('UPDATE studio_music_requests SET state=?,progress=?,updated_at=?,finished_at=?,revision=revision+1 WHERE request_id=? AND revision=?').bind(state,JSON.stringify(progress),now,part.phase==='terminado'?now:null,part.request_id,part.revision).run();
  if(result.meta.changes!==1)fail('stale-progress',409);return this.get(part.request_id,operator,true);
 }
}
