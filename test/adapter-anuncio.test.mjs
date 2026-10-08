import test from 'node:test';import assert from 'node:assert/strict';
import {semanticAction,textLayout,editCopy,wrapCopy,makeVisual,renderAdvertisement,visualPrompt,safeCopyZone} from '../adaptaciones/anuncio-core.mjs';
const doc={texts:[{text:'UN CAFÉ CON HIELO EN LA PLAYA DE BARCELONA',role:'headline'},{text:'2,50 € · Hasta agotar existencias',role:'legal'}],subjects:[{label:'coffee'}],scene:'Barcelona beach',uncertain:false,needsRecreation:false};
const src={ancho:1280,alto:720},measure=(txt,size)=>Array.from(txt).length*size*.57;
test('landscape to portrait is a recreation; uncertain OCR blocks generation',()=>{assert.equal(semanticAction(doc,src,{ancho:1080,alto:1920}).action,'recreate');assert.equal(semanticAction(doc,src,{ancho:1080,alto:1080}).action,'recompose');assert.equal(semanticAction({...doc,needsRecreation:true},src,src).action,'recreate');assert.equal(semanticAction({...doc,uncertain:true},src,src).action,'blocked');});
test('complete copy fits within safe bounds in all four ratios and keeps prices',()=>{for(const [W,H] of [[1080,1920],[1920,1080],[1080,1080],[1080,1350],[300,600]]){const layout=textLayout(doc,W,H,measure);assert.equal(layout.valid,true,`${W}x${H}`);assert.equal(layout.blocks.length,2);for(const b of layout.blocks){assert.equal(b.lines.join(' ').replace(/\s/g,''),b.text.replace(/\s/g,''));assert.ok(b.x>=0&&b.y>=0&&b.x+b.w<=W&&b.y+b.h<=H);assert.ok(b.lines.every(x=>measure(x,b.px)<=b.w));}assert.match(layout.blocks[1].text,/2,50 €/);}});
test('long legal copy cannot silently truncate or shrink below the readable minimum',()=>{const layout=textLayout({...doc,texts:[{text:'CONDICIONES COMPLETAS '.repeat(300),role:'legal'}]},300,250,measure);assert.equal(layout.valid,false);assert.equal(layout.error,'text-overflow');});
test('all word characters survive wrapping, including a long URL',()=>{const text='CAFÉ https://example.test/unalargacadenasinpartir/1234567890';assert.equal(wrapCopy(text,100,20,measure).join('').replace(/\s/g,''),text.replace(/\s/g,''));});
test('OCR copy editing preserves roles and blocks, invalid block counts are rejected',()=>{const d=editCopy({...doc,uncertain:true},'UN CAFÉ CON HIELO\nEN BARCELONA\n\n2,50 € · Hasta agotar existencias');assert.equal(d.uncertain,false);assert.equal(d.texts[1].role,'legal');assert.throws(()=>editCopy(doc,'Only one block'));});
test('videowall copy stays inside one physical screen, not split at the seam',()=>{const zone={x:1080,y:0,w:1080,h:1920},l=textLayout(doc,2160,1920,measure,zone);assert.equal(l.valid,true);assert.ok(l.blocks.every(b=>b.x>1080&&b.x+b.w<2160));});
test('AI visual is verified and rejected when text remains or product is missing',async()=>{for(const verification of [{hasText:true,productPresent:true,issues:[]},{hasText:false,productPresent:false,issues:[]},{hasText:false,productPresent:true,issues:['cut product']}]){await assert.rejects(()=>makeVisual('data:image/png;base64,YQ==',doc,'recreate',{w:1080,h:1400},{fetchImpl:async(url,init)=>url==='/auth/api-token'?Response.json({token:'test'}):url.endsWith('/image/edit')?Response.json({ok:true,image:'data:image/png;base64,YQ=='}):Response.json({ok:true,verification})}),/visual-review-failed/);}});
test('final renderer uses contain for the entire visual and draws each exact text line',()=>{const calls=[],ctx={measureText:txt=>({width:measure(txt,20)}),fillRect(){},drawImage(...args){calls.push(['image',...args]);},fillText(...args){calls.push(['text',...args]);}};const canvas={width:1080,height:1920,getContext:()=>ctx};const l=renderAdvertisement(canvas,{width:1920,height:1080},doc);assert.equal(l.valid,true);assert.equal(calls.filter(x=>x[0]==='text').map(x=>x[1]).join('').replace(/\s/g,''),doc.texts.map(x=>x.text).join('').replace(/\s/g,''));const im=calls.find(x=>x[0]==='image');assert.equal(im.length,6);assert.ok(im[4]<=1080);});

test('recreation preserves iced drink properties and verification receives product and exact copy',async()=>{assert.match(visualPrompt('recreate',doc,{w:100,h:200}),/never steam/);const bodies=[];await makeVisual('data:image/png;base64,YQ==',doc,'recreate',{w:100,h:200},{fetchImpl:async(url,init)=>{if(url==='/auth/api-token')return Response.json({token:'test'});bodies.push(JSON.parse(init.body));return url.endsWith('/image/edit')?Response.json({ok:true,image:'data:image/png;base64,YQ=='}):Response.json({ok:true,verification:{hasText:false,productPresent:true,issues:[]}});}});const expected=JSON.parse(bodies[1].scene);assert.deepEqual(expected.subjects,['coffee']);assert.equal(expected.copy[0],doc.texts[0].text);});
test('advanced reconstruction is explicit even for matching ratios; uncertain OCR still blocks',()=>{assert.equal(semanticAction(doc,src,src,'reconstruct').action,'reconstruct');assert.equal(semanticAction({...doc,uncertain:true},src,src,'reconstruct').action,'blocked');});
test('reconstruction requests missing surroundings, protected elements and reserved copy separately',()=>{const prompt=visualPrompt('reconstruct',doc,{w:1080,h:1920},{textZone:{x:0,y:0,w:1080,h:614},important:'entire glass and spoon',brief:'extend Barcelona beach'});assert.match(prompt,/Infer missing surroundings/);assert.match(prompt,/entire glass and spoon/);assert.match(prompt,/614/);assert.match(prompt,/Do not render any headline/);});
test('reconstruction retains detected boxes for deterministic safe copy reflow',async()=>{const v=await makeVisual('data:image/png;base64,YQ==',doc,'reconstruct',{w:1080,h:1920},{textZone:{x:0,y:0,w:1080,h:614},fetchImpl:async(url)=>url==='/auth/api-token'?Response.json({token:'test'}):url.endsWith('/image/edit')?Response.json({ok:true,image:'data:image/png;base64,YQ=='}):Response.json({ok:true,verification:{hasText:false,productPresent:true,issues:[],compositionSafe:false,protectedSubjects:[{label:'coffee',box:[280,300,950,700]}]}})});assert.equal(v.verification.compositionSafe,false);const z=safeCopyZone(doc,1080,1920,v.verification.protectedSubjects,measure,{preferred:{x:0,y:0,w:1080,h:614}});assert.ok(z.y+z.h<=1920*.28||z.y>=1920*.95||z.x+z.w<=1080*.3||z.x>=1080*.7);assert.equal(textLayout(doc,1080,1920,measure,z).valid,true);});
test('copy reflow blocks when protected elements occupy the whole canvas',()=>{assert.throws(()=>safeCopyZone(doc,1080,1920,[{label:'product',box:[0,0,1000,1000]}],measure),/copy-product-overlap/);});
test('videowall copy reflow stays in its physical screen',()=>{const boundary={x:1080,y:0,w:1080,h:1920},z=safeCopyZone(doc,2160,1920,[{label:'coffee',box:[400,650,950,900]}],measure,{boundary});assert.ok(z.x>=1080&&z.x+z.w<=2160);});
test('immersive reconstruction uses the whole native canvas and exact copy',()=>{const calls=[],ctx={measureText:txt=>({width:measure(txt,20)}),fillRect(){},drawImage(...a){calls.push(a);},fillText(){}};renderAdvertisement({width:1080,height:1920,getContext:()=>ctx},{width:1080,height:1920},doc,{immersive:true});assert.deepEqual(calls[0].slice(1),[0,0,1080,1920]);});
test('iced-drink steam gets one bounded repair, repeated defects remain blocked',async()=>{for(const repairedOK of [true,false]){let edits=0,reviews=0;const run=()=>makeVisual('data:image/png;base64,YQ==',doc,'reconstruct',{w:1080,h:1920},{fetchImpl:async(url,init)=>{if(url==='/auth/api-token')return Response.json({token:'test'});if(url.endsWith('/image/edit')){edits++;if(edits===2)assert.match(JSON.parse(init.body).prompt,/steam/);return Response.json({ok:true,image:'data:image/png;base64,YQ=='});}reviews++;return Response.json({ok:true,verification:{hasText:false,productPresent:true,issues:reviews===1||!repairedOK?['steam above iced drink']:[],protectedSubjects:[{label:'coffee',box:[400,300,950,700]}],compositionSafe:true}});}});if(repairedOK)await run();else await assert.rejects(run,/visual-review-failed/);assert.equal(edits,2);assert.equal(reviews,2);}});

test('observed typography survives copy edits and reaches the same measurement and paint pipeline',async()=>{
 const {fontFor,measureCopy}=await import('../adaptaciones/anuncio-core.mjs');
 const type={family:'condensed',weight:900,color:'#00E8F1',align:'center',italic:false,trackingEm:0,lineHeight:1.05,outlineEm:0,outlineColor:'#102D36',shadow:false};
 const styled={...doc,texts:[{text:'UN CAFÉ CON HIELO',role:'headline',box:[40,0,120,1000],typography:type},{text:'EN LA PLAYA DE BARCELONA',role:'headline',box:[130,0,190,1000],typography:{...type,color:'#FFF000'}}]};
 assert.match(fontFor(100,'headline',type),/400 100px "Pixer Anton"/);assert.match(fontFor(100,'headline',{...type,weight:500}),/Pixer Oswald/);
 assert.equal(editCopy(styled,'UN CAFÉ CON HIELO\n\nEN LA PLAYA DE BARCELONA').texts[1].typography.color,'#FFF000');
 const paints=[],fills=[],seen=[],ctx={letterSpacing:'0px',measureText(txt){seen.push(this.font);return{width:txt.length*parseFloat(this.font.match(/(\d+(?:\.\d+)?)px/)[1])*.42,actualBoundingBoxAscent:75};},fillRect(...r){fills.push([this.fillStyle,...r]);},drawImage(){},strokeText(){},fillText(txt,x,y){paints.push({text:txt,font:this.font,color:this.fillStyle,x,y});}};
 const layout=renderAdvertisement({width:1080,height:1920,getContext:()=>ctx},{width:1080,height:1920},styled,{immersive:true});
 assert.equal(layout.valid,true);assert.ok(seen.every(f=>f.includes('Pixer Anton')));assert.ok(paints.some(p=>p.color==='#00E8F1'));assert.ok(paints.some(p=>p.color==='#FFF000'));assert.equal(fills.length,1,'no opaque blank headline panel on a styled recreated scene');
 assert.equal(paints.map(p=>p.text).join('').replace(/\s/g,''),styled.texts.map(t=>t.text).join('').replace(/\s/g,''));assert.ok(layout.blocks[1].px<layout.blocks[0].px,'observed size hierarchy');
 assert.ok(measureCopy(ctx,'CAFÉ',100,'headline',type)>0);
});
test('font selection is bounded and unavailable catalogue fonts block composition',async()=>{
 const {fontFor,loadDocumentFonts}=await import('../adaptaciones/anuncio-core.mjs');
 const s={family:'url(https://untrusted.test/font)',color:'#FFFFFF',weight:900};assert.doesNotMatch(fontFor(40,'headline',s),/untrusted/);
 await loadDocumentFonts(doc,{Font:null,fontSet:null});
 await assert.rejects(()=>loadDocumentFonts({...doc,texts:[{text:'TEST',role:'headline',typography:{family:'condensed',color:'#00FFFF',weight:900}}]},{Font:null,fontSet:null}),/font-unavailable/);
});
test('old unstyled copy uses a compact backplate ending at the copy bounds',()=>{
 const fills=[],ctx={measureText:t=>({width:measure(t,20)}),drawImage(){},fillText(){},fillRect(...r){fills.push(r);}};
 const l=renderAdvertisement({width:1080,height:1920,getContext:()=>ctx},{width:1080,height:1920},doc,{immersive:true});assert.ok(fills[1][3]<l.panel.h);assert.ok(fills[1][3]>=l.blocks.at(-1).y+l.blocks.at(-1).h);
});

test('narrow free zones shrink whole words instead of producing stacked word fragments',()=>{
 const d={...doc,texts:[{text:'UNA TAZA DE CAFÉ DE STARBUCKS HUMEANTE',role:'headline',typography:{family:'sans',weight:900,color:'#FFFFFF',align:'center',lineHeight:1.08}}]};
 const l=textLayout(d,1080,1920,measure,{x:790,y:0,w:290,h:1920});
 if(l.valid){assert.ok(l.blocks[0].lines.includes('STARBUCKS'));assert.ok(!l.blocks[0].lines.includes('STA'));}
 const z=safeCopyZone(d,1080,1920,[{label:'cup',box:[450,250,850,720]}],measure);
 const full=textLayout(d,1080,1920,measure,z);assert.ok(full.valid);assert.ok(full.blocks[0].lines.join(' ').includes('STARBUCKS'));
});

test('rounded lettering uses its own local display family',async()=>{
 const {fontChoice,fontFor}=await import('../adaptaciones/anuncio-type.mjs');
 const s={family:'rounded',weight:700,color:'#F339A7'};assert.equal(fontChoice('headline',s),'rounded');assert.match(fontFor(80,'headline',s),/Pixer Fredoka/);
});

test('text-free recreation has no phantom reserved rectangle',()=>{
 const prompt=visualPrompt('reconstruct',{...doc,texts:[]},{w:1920,h:1080},{textZone:null});
 assert.match(prompt,/no reserved text zone/);assert.ok(!prompt.includes('Reserve the rectangle null'));
});
test('copy zones prioritize readable headline size over raw rectangle area',()=>{
 const d={...doc,texts:[{text:'BURSTING WITH FUN!',role:'headline',typography:{family:'rounded',weight:700,color:'#FF00AA',lineHeight:1.08}},{text:'100% real fruit flavors',role:'body'}]};
 const z=safeCopyZone(d,1920,1080,[{label:'bag',box:[150,400,840,950]}],measure);
 const l=textLayout(d,1920,1080,measure,z);assert.ok(l.valid);assert.ok(l.blocks[0].px>60);assert.ok(z.x+z.w<=1920*.4||z.y+z.h<=1080*.15);
});

test('human type review preserves words and rejects arbitrary style values',async()=>{
 const {editTypography}=await import('../adaptaciones/anuncio-type.mjs');
 const d=editTypography(doc,0,{family:'rounded',color:'#169FB0',outlineColor:'#8C2675'});
 assert.equal(d.texts[0].text,doc.texts[0].text);assert.equal(d.texts[0].typography.color,'#169FB0');assert.equal(doc.texts[0].typography,undefined);
 for(const patch of [{family:'url(x)'},{color:'red'},{fontSize:1000}])assert.throws(()=>editTypography(doc,0,patch));
});
