import test from 'node:test';import assert from 'node:assert/strict';
import {musicRequest} from '../functions/creativo-music/[action].js';
import {MusicQueue,validatePart} from '../functions/_creative-music.js';
import {MusicAudioStore,exportedAudioType,validMusicAudioURL,MUSIC_AUDIO_MAX} from '../functions/_creative-music-audio.js';
import {db} from './helpers/music-db.mjs';
const owner='owner@example.test',operator='csilvasantin@gmail.com',clip='2e19e5a7-b065-4044-b268-a4dfc54f059b';
const song={request_id:'delivery-one',lyrics:'Tu pausa empieza aquí',voice:'chica',languages:['ESP'],style:'funk',title:'Tu pausa'};
const bytes=new TextEncoder().encode('ID3\x04\x00\x00\x00\x00\x00\x00test official export');
async function setup(){
 const env={AUTH_DB:db()},q=new MusicQueue(env.AUTH_DB);await q.ready();await q.create(owner,song);const claim=await q.claim(song.request_id,operator);
 const final=await q.update({request_id:song.request_id,claim_token:claim.claim_token,revision:claim.revision,phase:'terminado',message:'Finished',clips:[{id:clip,audio_url:'https://cdn1.suno.ai/'+clip+'.mp3'}]},operator);
 // A legacy delivery already closed with the song page, as observed in production.
 const progress=JSON.parse((await q.row(song.request_id)).progress);progress.clips[0].audio_url='https://suno.com/song/'+clip;
 await env.AUTH_DB.prepare('UPDATE studio_music_requests SET progress=? WHERE request_id=?').bind(JSON.stringify(progress),song.request_id).run();
 const context=(action,{token=claim.claim_token,body=bytes,mime='audio/mpeg',id=clip,origin='https://admira.studio'}={})=>({request:new Request('https://admira.studio/creativo-music/'+action+'?request_id='+song.request_id+(action==='deliver'?'&clip_id='+id:''),{method:action==='deliver'?'POST':'GET',headers:{Origin:origin,'Content-Type':mime,'X-Music-Claim':token},...(action==='deliver'?{body}:{})}),env,params:{action}});
 return {env,q,claim,final,context};
}
const never=()=>{throw Error('Must not generate or fetch upstream');},counselor=async()=>({email:operator}),user=async()=>({email:owner});
test('official export is private, tied to the original claim and leaves the finished generation unchanged',async()=>{
 const {q,context,final}=await setup(),before=await q.get(song.request_id,owner);
 const delivery=await musicRequest(context('deliver'),never,counselor);assert.equal(delivery.status,200);const proof=await delivery.json();assert.equal(proof.generation,false);assert.equal(proof.publication,false);
 const audio=await musicRequest(context('audio'),never,user);assert.equal(audio.status,200);assert.deepEqual(new Uint8Array(await audio.arrayBuffer()),bytes);
 assert.deepEqual(await q.get(song.request_id,owner),before);assert.equal(before.revision,final.revision);
 assert.equal((await q.create(owner,song)).state,'complete');
 const outsider=await musicRequest(context('audio'),never,async()=>({email:'other@example.test'}));assert.equal(outsider.status,404);
});
test('delivery requires operator, original claim, registered clip and same origin',async()=>{
 const {context}=await setup();
 for(const [ctx,auth,status] of [[context('deliver'),user,403],[context('deliver',{token:'wrong'}),counselor,403],[context('deliver',{id:'other'}),counselor,409],[context('deliver',{origin:'https://evil.test'}),counselor,403]])assert.equal((await musicRequest(ctx,never,auth)).status,status);
});
test('delivery replay preserves the identical bytes; a different replacement is rejected',async()=>{
 const {context}=await setup();const [one,two]=await Promise.all([musicRequest(context('deliver'),never,counselor),musicRequest(context('deliver'),never,counselor)]);assert.equal(one.status,200);assert.equal(two.status,200);assert.equal((await one.json()).sha256,(await two.json()).sha256);
 const changed=new TextEncoder().encode('ID3a different export');assert.equal((await musicRequest(context('deliver',{body:changed}),never,counselor)).status,409);
});
test('HTML pages, random player payloads, wrong MIME and oversized uploads cannot become an audio export',async()=>{
 const {context}=await setup();for(const body of [new TextEncoder().encode('<html>song</html>'),new Uint8Array([56,32,129,78,93,68,12,111]),new Uint8Array(0)])assert.equal((await musicRequest(context('deliver',{body}),never,counselor)).status,415);
 assert.equal((await musicRequest(context('deliver',{mime:'text/html'}),never,counselor)).status,415);
 assert.equal((await musicRequest(context('deliver',{body:new Uint8Array(MUSIC_AUDIO_MAX+1)}),never,counselor)).status,413);
});
test('private export chunks round-trip across storage instances and detect incomplete bytes',async()=>{
 const sql=db(),store=new MusicAudioStore(sql);await store.ready();const content=new Uint8Array(300000).fill(17);await store.save('a','b',content.buffer,'audio/mpeg');const reload=new MusicAudioStore(sql),saved=await reload.read('a','b');assert.deepEqual(new Uint8Array(await saved.blob.arrayBuffer()),content);
 await sql.prepare('DELETE FROM studio_music_audio_chunks WHERE request_id=? AND seq=?').bind('a',1).run();await assert.rejects(reload.read('a','b'),/integrity/);
});
test('new progress rejects song pages and arbitrary distributions, and accepts actual Suno file URL shapes',()=>{
 const part={request_id:'a',claim_token:'b',revision:1,phase:'terminado',message:'done',clips:[{id:clip,audio_url:'https://suno.com/song/'+clip}]};assert.throws(()=>validatePart(part),/clip-url/);
 assert.equal(validMusicAudioURL('https://d2lwuy8qc234o3.cloudfront.net/1/clip/'+clip+'.m4a',clip),null);
 assert.equal(validMusicAudioURL('https://cdn1.suno.ai/'+clip+'.mp3',clip),'https://cdn1.suno.ai/'+clip+'.mp3');
 assert.equal(exportedAudioType(new TextEncoder().encode('....ftypM4A '),'audio/mp4'),'audio/mp4');
});
