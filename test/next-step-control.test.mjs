import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayback,playbackAction,twinURL} from '../campanas/next-step/control.mjs';
import {INSTALLATIONS,DURATION} from '../campanas/next-step/render.mjs';
test('start, pause, resume, stop and restart share a deterministic clock',()=>{
 let now=10;const playback=createPlayback(()=>now);assert.deepEqual(playback.snapshot(),{state:'stopped',seconds:0,duration:32});
 playback.run('start');now=15;assert.equal(playback.snapshot().seconds,5);
 playback.run('pause');now=100;assert.deepEqual(playback.snapshot(),{state:'paused',seconds:5,duration:32});
 playback.run('start');now=102;assert.equal(playback.snapshot().seconds,7);
 playback.run('stop');now=200;assert.deepEqual(playback.snapshot(),{state:'stopped',seconds:0,duration:32});
 playback.run('start');now=203;assert.equal(playback.snapshot().seconds,3);
 playback.run('pause');playback.run('restart');now=205;assert.deepEqual(playback.snapshot(),{state:'playing',seconds:2,duration:32});
 assert.throws(()=>playback.run('erase'),/unknown/);
});
test('ES/EN command aliases and status do not silently start an unknown action',()=>{
 for(const [expected,values]of Object.entries({start:['','iniciar','start','reanudar','resume','continuar'],pause:['pausa','pause','pausar'],stop:['parar','stop','detener','off'],restart:['reiniciar','restart'],status:['estado','status']}))for(const value of values)assert.equal(playbackAction(value),expected,value);
 assert.equal(playbackAction('desconocido'),null);const p=createPlayback(()=>0);p.run('status');assert.equal(p.snapshot().state,'stopped');
});
test('seven maps retain thirteen even native formats and an uncovered door',()=>{
 assert.equal(DURATION,32);assert.equal(INSTALLATIONS.length,7);assert.equal(INSTALLATIONS.reduce((n,i)=>n+i.screens.length,0),13);
 for(const i of INSTALLATIONS)for(const s of i.screens){assert.equal(s.w%2,0);assert.equal(s.h%2,0);for(const m of i.masks||[])assert(s.x>=m.x+m.w||s.x+s.w<=m.x||s.y>=m.y+m.h||s.y+s.h<=m.y);}
});
test('preview navigation only accepts the Store project, never arbitrary origins or credentials',()=>{
 assert.equal(new URL(twinURL(null,'en','admira.studio')).origin,'https://www.admira.store');
 const url=twinURL('https://example.admira-store.pages.dev','en','example.pixeria.pages.dev');assert.equal(new URL(url).searchParams.get('campaign'),'next-step');assert.equal(new URL(url).searchParams.get('lang'),'en');
 for(const origin of [null,'https://evil.example','https://admira-store.pages.dev','https://user:password@example.admira-store.pages.dev','https://example.admira-store.pages.dev/other','http://example.admira-store.pages.dev'])assert.equal(twinURL(origin,'es','example.pixeria.pages.dev'),null);
 assert.equal(new URL(twinURL('http://127.0.0.1:8482','es','127.0.0.1')).port,'8482');
});
