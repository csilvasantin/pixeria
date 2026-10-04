import {test} from 'node:test';
import assert from 'node:assert/strict';
import {adaptationTitle, shortFormat, stockPayload} from '../adaptaciones/stock-publish.mjs';
test('adaptation title: «<title> · <client> · <format>», without client when «Todos»',()=>{
 assert.equal(adaptationTitle('I want true love',{id:'altadis',nombre:'Altadis'},'9:16'),'I want true love · Altadis · 9:16');
 assert.equal(adaptationTitle('I want true love',null,'9:16'),'I want true love · 9:16');
 assert.equal(shortFormat({id:'9:16',nombre:'Vertical 9:16'},{label:'Vertical 9:16'}),'9:16');
 assert.equal(shortFormat({id:'cliente-03',nombre:'Pantalla 3'},{label:'Pantalla 3'}),'Pantalla 3');
});
test('payload keeps origin, format, resolution and client in fields the Stock stores',()=>{
 const p=stockPayload({base64:'AA==',size:1048576,title:'t',originId:'1790883135453-96r1uk',client:{id:'altadis',nombre:'Altadis'},format:'9:16',width:1080,height:1920,duration:30.08});
 assert.equal(p.externalRef,'1790883135453-96r1uk');assert.equal(p.motor,'adaptador');assert.equal(p.type,'video');
 assert.deepEqual(p.tags,['adaptación','9:16','altadis']);assert.equal(p.validacion.ancho,1080);assert.equal(p.validacion.alto,1920);
 assert.match(p.prompt,/origen 1790883135453-96r1uk · formato 9:16 · 1080×1920 · cliente altadis/);
 const local=stockPayload({base64:'AA==',size:1,title:'t',originId:null,client:null,format:'1:1',width:1080,height:1080,duration:5});
 assert.equal(local.externalRef,null);assert.deepEqual(local.tags,['adaptación','1:1']);
});
