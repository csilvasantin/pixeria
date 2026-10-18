export const TYPES = {locucion:{es:'Locución',en:'Voice-over'},cancion:{es:'Música',en:'Music'}};
export const STYLES = ['rap','trap','flamenco','funk','soul','pop','rock','jazz','electrónica','otro'];
// Same language/gender voices used by the ecosystem's announcement service.
export const VOICES = {ESP:{chico:'Nh2zY9kknu6z4pZy6FhD',chica:'KHCvMklQZZo0O30ERnVn'},ENG:{chico:'EkK5I93UQWFDigLMpZcX',chica:'56AoDkrOh6qfVPDXZ7Pt'}};
const plain = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function parseCreative(text) {
  const input=String(text||'').trim().replace(/^\/?(?:creativo|creative)\b\s*/i,'').replace(/^(?:crear|create)\s+/i,'');
  if(input.length>6500)throw Error('creative-too-long');
  if(!input)return {kind:null,brief:''};
  const match=/^(locuci[oó]n|voz|voice(?:-over)?|m[uú]sica|music|canci[oó]n|song)\s+([\s\S]+)$/i.exec(input);
  if(!match)throw Error('creative-command');
  const kind=/^(locucion|voz|voice)/.test(plain(match[1]))?'locucion':'cancion',rest=match[2];
  // Quotes delimit literal content. Attributes never come from the spoken text or lyrics.
  const quoted=/^(?:"([\s\S]*)"|“([\s\S]*)”|«([\s\S]*)»)\s*([^"“”«»]*)$/.exec(rest);
  if(!quoted)throw Error('creative-quotes');
  const brief=quoted[1]??quoted[2]??quoted[3],attrs=plain(quoted[4]).replace(/[,;()]/g,' ');
  const gender=attrs.match(/\b(chico|chica|male|female)\b/g)||[];
  const toVoice=x=>/^(chico|male)$/.test(x)?'chico':'chica';
  if(new Set(gender.map(toVoice)).size>1)throw Error('creative-voice');
  const voice=gender.length?toVoice(gender[0]):undefined;
  const languages=[...new Set((attrs.match(/\b(esp|eng|es|en)\b/g)||[]).map(l=>/^(esp|es)$/.test(l)?'ESP':'ENG'))];
  const style=attrs.replace(/\b(chico|chica|male|female|esp|eng|es|en|e|y|and|voz|voice|idioma|language|estilo|style)\b/g,' ').replace(/[=:,+]/g,' ').replace(/\s+/g,' ').trim();
  if(kind==='locucion'&&style)throw Error('creative-attributes');
  if(kind==='locucion'&&languages.length>1)throw Error('creative-language');
  return {kind,brief,...(voice?{voice}:{}),...(languages.length?{languages}:{}),...(style?{style}:{})};
}
export function creativeJob({kind,brief,voice='chica',languages,language='es',style='',id=crypto.randomUUID(),name=''}={}) {
  if(!TYPES[kind])throw Error('creative-kind');
  if(typeof id!=='string'||!/^[a-z0-9_-]{1,100}$/i.test(id))throw Error('creative-id');
  if(typeof brief!=='string'||!brief.trim()||brief.length>5000)throw Error('creative-brief');
  if(!['chico','chica'].includes(voice))throw Error('creative-voice');
  languages=languages||[language==='en'?'ENG':'ESP'];
  if(!Array.isArray(languages)||!languages.length||languages.some(l=>!['ESP','ENG'].includes(l))||(kind==='locucion'&&languages.length!==1))throw Error('creative-language');
  if(typeof style!=='string'||style.length>120||(kind==='cancion'&&!style.trim()))throw Error('creative-style');
  return {schema:'admira.creativo.v2',id,kind,brief,voice,languages:[...new Set(languages)],style:kind==='cancion'?style.trim():'',name:String(name||brief.trim().slice(0,60)),state:'prepared',updatedAt:new Date().toISOString()};
}
export function voicePayload(job) {
  job=creativeJob(job);if(job.kind!=='locucion')throw Error('creative-kind');
  return {text:job.brief,voice_id:VOICES[job.languages[0]][job.voice],language_code:job.languages[0]==='ENG'?'en':'es',model_id:'eleven_multilingual_v2',output_format:'mp3_44100_128',voice_settings:{stability:.5,similarity_boost:.75}};
}
export function musicPayload(job) {
  job=creativeJob(job);if(job.kind!=='cancion')throw Error('creative-kind');
  const lang=job.languages.length===2?'Spanish and English bilingual vocals':job.languages[0]==='ENG'?'English vocals':'Spanish vocals';
  return {prompt:[job.voice==='chico'?'male vocals':'female vocals',lang,job.style].join(', '),lyrics:job.brief,title:job.name,instrumental:false,model:'chirp-v5-5'};
}
export function recoverJob(job) {
  const normalized=creativeJob(job),states=['prepared','submitting','pending','complete','unknown','failed'];
  return {...job,...normalized,updatedAt:job.updatedAt||normalized.updatedAt,state:states.includes(job.state)?job.state:'unknown'};
}
export function canGenerate(job){return job?.state==='prepared';}
export function musicReferences(data) {
  const ids=(data.ids||(data.clips||[]).map(c=>c.id)).filter(id=>typeof id==='string'&&/^[a-z0-9_-]{1,120}$/i.test(id));
  return {ids:[...new Set(ids)],pendingId:typeof data.pendingId==='string'?data.pendingId.slice(0,200):''};
}
