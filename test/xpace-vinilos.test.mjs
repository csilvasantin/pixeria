import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {playCapsule,safeDisc,PREVIEW_SECONDS} from '../assets/xpaces/vinilos.mjs';

test('seis vinilos oficiales, dos por artista, con formatos y preview limitada',()=>{
 const shelf=JSON.parse(fs.readFileSync(new URL('../assets/xpaces/libros/estanteria-libros.json',import.meta.url)));
 const discs=shelf.discos.piezas;
 assert.equal(discs.length,6);assert.equal(PREVIEW_SECONDS,20);
 for(const artist of ['Michael Jackson','Prince','George Michael'])assert.equal(discs.filter(x=>x.artist===artist).length,2);
 for(const d of discs){assert.ok(safeDisc(d));assert.deepEqual(d.formats,['16:9','9:16']);assert.equal(d.durationSeconds,20);}
});

test('la canción espera al fin de la voz y se detiene a los 20 segundos',async()=>{
 const oldSpeech=globalThis.speechSynthesis,oldUtterance=globalThis.SpeechSynthesisUtterance,oldAudio=globalThis.Audio;
 let utterance,audio,phase=[];
 globalThis.speechSynthesis={cancel(){},getVoices(){return [];},speak(u){utterance=u;}};
 globalThis.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
 globalThis.Audio=class{constructor(url){this.url=url;this.currentTime=0;this.events={};audio=this;}addEventListener(k,f){this.events[k]=f;}play(){this.played=true;return Promise.resolve();}pause(){this.paused=true;}removeAttribute(){}load(){}};
 try{
  const d={hook:'Una locución',previewUrl:'https://audio-ssl.itunes.apple.com/example.m4a'};
  let done=0;const p=playCapsule(d,{onPhase:x=>phase.push(x),onDone:()=>done++});
  assert.deepEqual(phase,['voz']);assert.equal(audio,undefined);
  utterance.onend();await Promise.resolve();assert.deepEqual(phase,['voz','preview']);assert.equal(audio.played,true);
  audio.currentTime=20;audio.events.timeupdate();assert.equal(audio.paused,true);assert.equal(done,1);
  p.stop();
 }finally{globalThis.speechSynthesis=oldSpeech;globalThis.SpeechSynthesisUtterance=oldUtterance;globalThis.Audio=oldAudio;}
});
