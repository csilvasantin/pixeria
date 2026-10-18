export const COMBO_SCHEMA='admira.creativo.combo.v1';
const text=(value,max)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw Error('combo-fields');return value;};
export function parseComboCommand(input){
 const value=String(input||'').trim().replace(/^\/?(?:admirito\s+creativo|creativo|creative)\s+/i,'');
 if(!/^\/?(?:crear|create)?\s*combo\b/i.test(value))return null;
 const m=/^\/?(?:(?:crear|create)\s+)?combo\s+(?:imagen|image)\s+(locuci[oó]n|voz|voice|m[uú]sica|music)\s+(\d+)\s*(?:segundos?|seconds?|s)(?:\s+([\s\S]*))?$/i.exec(value);
 if(!m||+m[2]!==10)throw Error('combo-command');
 const order={kind:/^(m[uú]sica|music)$/i.test(m[1])?'musica':'locucion',seconds:10};
 if(!m[3])return order;
 // JSON string literals keep quotes, whitespace and line breaks unambiguous.
 const rest=/^imagen\s+("(?:[^"\\]|\\[\s\S])*")\s+(?:texto|letra)\s+("(?:[^"\\]|\\[\s\S])*")\s*(.*)$/i.exec(m[3]);
 if(!rest)throw Error('combo-command');
 let imagePrompt,audioText;try{imagePrompt=JSON.parse(rest[1]);audioText=JSON.parse(rest[2]);}catch{throw Error('combo-command');}
 const attrs=rest[3].normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const voices=attrs.match(/\b(chico|chica)\b/g)||[];if(new Set(voices).size>1)throw Error('combo-fields');
 const languages=[...new Set((attrs.match(/\b(esp|eng)\b/g)||[]).map(x=>x.toUpperCase()))];
 const orientation=/\bvertical\b/.test(attrs)?'vertical':'horizontal';
 const style=attrs.replace(/\b(chico|chica|esp|eng|y|e|horizontal|vertical|estilo)\b/g,' ').replace(/\s+/g,' ').trim();
 if(order.kind==='locucion'&&style)throw Error('combo-fields');
 return {...order,imagePrompt,audioText,...(voices.length?{voice:voices[0]}:{}),...(languages.length?{languages}:{}),orientation,...(style?{style}:{})};
}
export function comboSpec(value){
 if(!value||!['locucion','musica'].includes(value.kind)||value.seconds!==10||value.kind==='locucion'&&value.style&&value.style.trim())throw Error('combo-command');
 const voice=value.voice||'chica',languages=value.languages||['ESP'],orientation=value.orientation||'horizontal';
 if(!['chico','chica'].includes(voice)||!['horizontal','vertical'].includes(orientation)||!Array.isArray(languages)||!languages.length||languages.length>2||languages.some(x=>!['ESP','ENG'].includes(x))||value.kind==='locucion'&&languages.length!==1)throw Error('combo-fields');
 return {schema:COMBO_SCHEMA,kind:value.kind,seconds:10,imagePrompt:text(value.imagePrompt,5000),audioText:text(value.audioText,5000),voice,languages:[...new Set(languages)],style:value.kind==='musica'?text(value.style,120):'',orientation};
}
export async function comboHash(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)))),x=>x.toString(16).padStart(2,'0')).join('');}
export async function comboIdentity(value){return 'combo-'+await comboHash(comboSpec(value));}
export async function comboImageIdentity(value){const s=comboSpec(value);return 'combo-image-'+await comboHash([s.imagePrompt,s.orientation,'grok-imagine-image-pro']);}
export function comboCommand(value){const s=comboSpec(value);return '/crear combo imagen '+s.kind+' 10 segundos imagen '+JSON.stringify(s.imagePrompt)+' '+(s.kind==='musica'?'letra':'texto')+' '+JSON.stringify(s.audioText)+' '+s.voice+' '+s.languages.map(x=>x.toLowerCase()).join(' y ')+(s.style?' '+s.style:'')+' '+s.orientation;}
export function comboURL(value,language='es'){
 const spec=comboSpec(value),bytes=new TextEncoder().encode(JSON.stringify(spec));let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
 return (language==='en'?'/en/creativo/':'/creativo/')+'?lang='+(language==='en'?'en':'es')+'&combo='+spec.kind+'#combo='+btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export function comboFromFragment(hash){
 const raw=new URLSearchParams(String(hash).replace(/^#/,'' )).get('combo');if(!raw)return null;if(raw.length>30000)throw Error('combo-fields');
 try{return comboSpec(JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(raw.replace(/-/g,'+').replace(/_/g,'/')),x=>x.charCodeAt(0)))));}catch{throw Error('combo-fields');}
}
export function comboExportJob(spec,{audioDuration,start=0,imageMime='image/png'}={}){
 const s=comboSpec(spec);if(!(audioDuration>0)||!Number.isFinite(start)||start<0)throw Error('combo-audio');
 if(s.kind==='locucion'&&audioDuration>10.05)throw Error('combo-voice-long');
 if(s.kind==='musica'&&start+Math.min(10,audioDuration)>audioDuration+.05)throw Error('combo-audio');
 const width=s.orientation==='horizontal'?1920:1080,height=s.orientation==='horizontal'?1080:1920;
 const input=imageMime==='image/jpeg'?'image.jpg':imageMime==='image/webp'?'image.webp':'image.png';
 return {input,filename:'combo-'+s.kind+'-10s.mp4',file:'output.mp4',durationSeconds:10,width,height,args:['-loop','1','-framerate','25','-i',input,...(start?['-ss',String(start)]:[]),'-i','audio','-vf',`scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1`,'-af','apad,atrim=duration=10,asetpts=PTS-STARTPTS','-map','0:v:0','-map','1:a:0','-t','10','-r','25','-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart','-y','output.mp4']};
}
