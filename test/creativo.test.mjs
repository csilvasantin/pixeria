import test from 'node:test';import assert from 'node:assert/strict';
import {parseCreative,creativeJob,voicePayload,musicPayload,recoverJob,canGenerate,musicReferences,VOICES} from '../assets/creativo-core.mjs';
import {mediaPreflight,submitMedia,pollMusic} from '../assets/creativo-media.mjs';
import {wantsAvatar} from '../functions/_avatar-loader.js';
const voice=()=>creativeJob({kind:'locucion',brief:'  Bienvenido.\nTu café te espera.  ',voice:'chico',languages:['ESP'],id:'voice-test'});
const song=()=>creativeJob({kind:'cancion',brief:'Aquí empieza el día\nHere comes the sun',voice:'chica',languages:['ESP','ENG'],style:'funk',id:'song-test'});
test('quoted commands keep literal text, repeated words, attributes inside lyrics and line breaks',()=>{
 assert.deepEqual(parseCreative('/creativo crear locución "La chica dice esp, eng, funk." chico esp'),{kind:'locucion',brief:'La chica dice esp, eng, funk.',voice:'chico',languages:['ESP']});
 assert.deepEqual(parseCreative('crear música “Aquí\nHere we go” chica esp y eng estilo soul'),{kind:'cancion',brief:'Aquí\nHere we go',voice:'chica',languages:['ESP','ENG'],style:'soul'});
 assert.equal(parseCreative('create voice "Welcome, friend." female eng').voice,'chica');
 assert.equal(parseCreative('/creative create music "Exact lyrics" male eng trap').style,'trap');
 assert.deepEqual(parseCreative('/creativo'),{kind:null,brief:''});
});
test('ambiguous voice, invalid language and unquoted text are rejected rather than spoken as attributes',()=>{
 for(const text of ['crear locución Hola chico esp','crear locución "Hola" chico chica esp','crear locución "Hola" chico esp eng','crear locución "Hola" chico francés'])assert.throws(()=>parseCreative(text));
 assert.throws(()=>creativeJob({...voice(),languages:['FR']}));assert.throws(()=>creativeJob({...song(),style:''}));
});
test('real voice selections distinguish gender and language and preserve exact spoken content',()=>{
 const ids=new Set();for(const voiceType of ['chico','chica'])for(const lang of ['ESP','ENG']){const job=creativeJob({...voice(),voice:voiceType,languages:[lang]}),payload=voicePayload(job);ids.add(payload.voice_id);assert.equal(payload.voice_id,VOICES[lang][voiceType]);assert.equal(payload.language_code,lang==='ENG'?'en':'es');assert.equal(payload.text,job.brief);assert.equal(payload.model_id,'eleven_multilingual_v2');}
 assert.equal(ids.size,4);
});
test('music sends literal lyrics in custom lyrics, never in a simple generation prompt',()=>{
 const payload=musicPayload(song());assert.equal(payload.lyrics,song().brief);assert.equal(payload.instrumental,false);assert.match(payload.prompt,/female vocals/);assert.match(payload.prompt,/Spanish and English/);assert.match(payload.prompt,/funk/);assert(!payload.prompt.includes(song().brief));
});
test('reload preserves output references and submission state; no non-prepared job can regenerate',()=>{
 for(const state of ['submitting','unknown','pending','complete','failed']){const saved={...song(),state,ids:['clip-one'],pendingId:'pending-one',clips:[{audio_url:'https://cdn.example/a.mp3'}]};assert.deepEqual(recoverJob(JSON.parse(JSON.stringify(saved))),saved);assert.equal(canGenerate(saved),false);}
 assert(canGenerate(voice()));
});
test('voice preflight requires an authenticated token before any POST',async()=>{
 const calls=[];await assert.rejects(mediaPreflight(voice(),async(url,init)=>{calls.push({url,init});return Response.json({error:'session-required'},{status:401});}),/session/);assert.equal(calls.length,1);assert.equal(calls[0].url,'/auth/api-token');assert(!calls[0].init.method);
});
test('voice generation uses the existing authenticated proxy and returns only an actual audio blob',async()=>{
 let sent;const result=await submitMedia(voice(),'test-token',async(url,init)=>{sent={url,init};return new Response(new Blob(['audio-bytes'],{type:'audio/mpeg'}));});assert.equal(sent.url,'https://api.admira.store/tts');assert.equal(sent.init.headers.Authorization,'Bearer test-token');assert.deepEqual(JSON.parse(sent.init.body),voicePayload(voice()));assert.equal(await result.blob.text(),'audio-bytes');
 await assert.rejects(submitMedia(voice(),'test-token',async()=>Response.json({ok:true})),/audio-invalid/);
});
test('music generation keeps provider references; polling uses GET exclusively',async()=>{
 let sent;const result=await submitMedia(song(),'',async(url,init)=>{sent={url,init};return Response.json({pendingId:'pending-one'});});assert.match(sent.url,/\/generate$/);assert.deepEqual(JSON.parse(sent.init.body),musicPayload(song()));assert.equal(result.pendingId,'pending-one');
 const job={...song(),...result,state:'pending'},calls=[];
 const next=await pollMusic(job,async(url,init)=>{calls.push({url,init});return Response.json({ids:['clip-one','clip-two']});});assert.deepEqual(next.ids,['clip-one','clip-two']);assert.match(calls[0].url,/status\?pending=pending-one/);assert.equal(calls[0].init,undefined);
});
test('partial clips remain pending; completed results expose only HTTPS audio URLs',async()=>{
 const job={...song(),ids:['clip-one','clip-two']};let result=await pollMusic(job,async()=>Response.json([{id:'clip-one',audio_url:'https://cdn.example/a.mp3',status:'complete'}]));assert.equal(result.state,'pending');
 result=await pollMusic(job,async()=>Response.json([{id:'clip-one',audio_url:'https://cdn.example/a.mp3',status:'complete'},{id:'clip-two',audio_url:'javascript:alert(1)',status:'error'}]));assert.equal(result.state,'complete');assert.equal(result.clips.length,1);
 const failed=await pollMusic(job,async()=>Response.json({status:'error',error:'provider-failed'}));assert.equal(failed.state,'failed');
});
test('provider failures and missing references do not claim completion',async()=>{
 await assert.rejects(submitMedia(song(),'',async()=>Response.json({error:'offline'},{status:503})),/provider-503/);
 await assert.rejects(submitMedia(song(),'',async()=>Response.json({ok:true})),/no-reference/);
 assert.deepEqual(musicReferences({ids:['clip-a','../unsafe','clip-a']}),{ids:['clip-a'],pendingId:''});
});
test('Creativo owns its assistant surface without injecting a second generic avatar',()=>{
 const response=new Response('<main></main>',{headers:{'Content-Type':'text/html'}});
 for(const path of ['/creativo/','/en/creativo/'])assert.equal(wantsAvatar(response,new URL('https://admira.studio'+path)),false);
 assert.equal(wantsAvatar(response,new URL('https://admira.studio/creador/')),true);
});
