import test from 'node:test';
import assert from 'node:assert/strict';
import {COMPOSITION_SCHEMA,validateComposition,bindComposition,compositionFromStock,withSystemComposition} from '../assets/content-composition.mjs';
import {campaignComposition} from '../adaptaciones/campaign-composition.mjs';
import {DEFAULT_CAMPAIGN,planCampaign} from '../adaptaciones/campaign-core.mjs';
const H='a'.repeat(64),bounds={type:'image',width:1280,height:720};
const declared=()=>({schema:COMPOSITION_SCHEMA,producer:'admira.studio',renderer:'campaign-canvas.v1',mediaType:'image',width:1280,height:720,complete:true,copy:[{role:'headline',text:'UN CAFÉ CON HIELO',box:[50,50,250,900],typography:{family:'sans',weight:900,color:'#00DDEE',align:'center'}},{role:'body',text:'EN LA PLAYA DE BARCELONA · 1,99 €',box:[300,50,450,900]}]});
const entry=c=>({type:'image',ancho:1280,alto:720,contentHash:H,composition:c,motor:'nano-banana',prompt:'invented copy',fuente:'admira.studio'});
const ocr={texts:[{role:'headline',text:'UN CAFE CON HIELO',confidence:.6}],subjects:[{label:'iced coffee glass',box:[500,400,950,700]}],uncertain:true,scene:'beach',needsRecreation:true};
test('exact authored copy retains accents, price, punctuation, style and full blocks independently of free prompt',()=>{
 const stored=bindComposition(declared(),H,bounds),usable=compositionFromStock(entry(stored));
 const doc=withSystemComposition(ocr,usable,bounds);
 assert.deepEqual(doc.texts.map(x=>x.text),declared().copy.map(x=>x.text));assert.equal(doc.texts[0].typography.color,'#00DDEE');assert.equal(doc.uncertain,false);assert.equal(doc.copySource,'system-composition');assert.equal(doc.subjects,ocr.subjects);assert.equal(doc.scene,ocr.scene);
});
test('imported, historical or altered metadata cannot replace OCR merely from model, source, prompt or claimed schema',()=>{
 const valid=bindComposition(declared(),H,bounds);
 for(const item of [entry(null),entry(declared()),entry({...valid,assetHash:'b'.repeat(64)}),entry({...valid,verification:'user'}),{...entry(valid),ancho:1920},{...entry(valid),type:'pdf'},{...entry(valid),contentHash:null},{...entry(valid),ancho:null}])assert.equal(compositionFromStock(item),null);
 assert.equal(withSystemComposition(ocr,null,bounds),ocr);assert.equal(withSystemComposition(ocr,{...valid,complete:false},bounds),ocr);assert.equal(withSystemComposition(ocr,valid,{...bounds,width:1920}),ocr);assert.equal(withSystemComposition(ocr,valid),ocr);
});
test('schema enforces bounded blocks and typed dimensions without evaluating embedded content',()=>{
 const a=declared();a.copy[0].text='<script>literal text</script>';assert.equal(validateComposition(a).copy[0].text,a.copy[0].text);
 for(const change of [{copy:[{...a.copy[0],text:'x'.repeat(2001)}]},{copy:[{...a.copy[0],box:[0,0,1001,500]}]},{copy:[{...a.copy[0],typography:{family:'url(https://evil)',weight:900,color:'#FFFFFF',align:'left'}}]},{complete:'true'},{width:Infinity},{mediaType:'pdf'}])assert.throws(()=>validateComposition({...a,...change}));
 assert.throws(()=>bindComposition(a,'client-hash'));assert.throws(()=>validateComposition(a,{...bounds,height:1920}));
});
test('Creator derives copy only from rendered layers, and import rasters retain OCR',()=>{
 const c={...DEFAULT_CAMPAIGN,headline:'CAFÉ FRÍO',cta:'DISFRUTA HOY',price:'1,99 €'},i=c.installations[0],plan=planCampaign(c,i),composition=campaignComposition(c,i,i.screens[0],plan,{mediaType:'image'});
 assert.equal(composition.complete,true);assert.deepEqual(composition.copy.map(x=>x.text),['SNEAKERS','STORE','CAFÉ FRÍO','DISFRUTA HOY','1,99 €']);assert.equal(composition.copy[0].typography.weight,900);
 const imported=campaignComposition({...c,product:'data:image/png;base64,AA=='},i,i.screens[0],plan);assert.equal(imported.complete,false);assert.equal(imported.mediaType,'video');assert.deepEqual(imported.copy.map(x=>x.text),composition.copy.map(x=>x.text));
});
test('each panel contains its own layers, and rotated output maps text boxes to output coordinates',()=>{
 const c=DEFAULT_CAMPAIGN,installation={width:400,height:300},s={x:100,y:50,w:200,h:100,rotation:90},plan={valid:true,layers:[{role:'headline',text:'THIS PANEL',x:120,y:60,w:100,h:30},{role:'body',text:'OTHER PANEL',x:0,y:0,w:50,h:20}]};
 const p=campaignComposition(c,installation,s,plan);assert.deepEqual([p.width,p.height],[100,200]);assert.deepEqual(p.copy.map(x=>x.text),['THIS PANEL']);assert.deepEqual(p.copy[0].box,[400,100,900,400]);
});
