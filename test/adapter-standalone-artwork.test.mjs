import test from 'node:test';
import assert from 'node:assert/strict';
import {makeVisual,visualPrompt} from '../adaptaciones/anuncio-core.mjs';

const source='data:image/jpeg;base64,YQ==',candidate='data:image/png;base64,Yg==';
const doc={texts:[],subjects:[{label:'coffee cup',box:[400,250,900,750]}],scene:'Coffee artwork inside a photographed shop display. Preserve its installation.',needsRecreation:true,uncertain:false};
const good={hasText:false,productPresent:true,issues:[],hasDisplayMockup:false};
function fake(verification,requests=[]){return async(url,init)=>{
 if(url==='/auth/api-token')return Response.json({token:'test'});
 requests.push({url,body:JSON.parse(init.body)});
 return url.endsWith('/image/edit')?Response.json({ok:true,image:candidate}):Response.json({ok:true,verification});
};}

test('both adaptation recreation paths explicitly require standalone artwork, independent of reference or free direction',async()=>{
 for(const action of ['recreate','reconstruct']){
  const requests=[];
  const result=await makeVisual(source,doc,action,{w:1080,h:1920},{brief:'Preserve the installation',deliveryMode:'installation',fetchImpl:fake(good,requests)});
  assert.equal(result.url,candidate);
  assert.equal(requests[1].body.deliveryMode,'standalone-artwork');
  assert.equal(requests[1].body.referenceImage,source);
  assert.match(requests[0].body.prompt,/Extract the inner advertising artwork/);
  assert.match(requests[0].body.prompt,/even when.*scene.*subjects/s);
  assert.match(requests[0].body.sys,/standalone artwork/);
 }
});

test('a complete text-free product inside a display is blocked; missing or malformed display evidence also fails closed',async()=>{
 for(const action of ['recreate','reconstruct'])for(const flag of [true,undefined,null,'false',0]){
  const verdict={...good,hasDisplayMockup:flag};if(flag===undefined)delete verdict.hasDisplayMockup;
  await assert.rejects(()=>makeVisual(source,doc,action,{w:1080,h:1920},{fetchImpl:fake(verdict)}),e=>{
   assert.equal(e.message,'visual-review-failed');
   assert.equal(e.details,flag===true?'display-mockup':'invalid-display-verification');
   assert.equal(e.candidate,candidate);return true;
  });
 }
});

test('standalone evidence never clears residual copy, missing product or critical visual defects',async()=>{
 for(const [verdict,reason] of [[{...good,hasText:true},'residual-text'],[{...good,productPresent:false},'incomplete-product'],[{...good,issues:['wrong ingredients']},'wrong ingredients']]){
  await assert.rejects(()=>makeVisual(source,doc,'reconstruct',{w:1080,h:1920},{fetchImpl:fake(verdict)}),e=>e.message==='visual-review-failed'&&e.details===reason);
 }
});

test('display detection blocks before the bounded steam repair and never approves the candidate',async()=>{
 const requests=[];
 await assert.rejects(()=>makeVisual(source,doc,'reconstruct',{w:1080,h:1920},{fetchImpl:fake({...good,hasDisplayMockup:true,issues:['steam above iced drink']},requests)}),e=>e.details==='display-mockup');
 assert.equal(requests.filter(r=>r.url.endsWith('/image/edit')).length,1);
});

test('legacy recompose does not opt into the new delivery contract',async()=>{
 const requests=[],legacy={hasText:false,productPresent:true,issues:[]};
 await makeVisual(source,{...doc,needsRecreation:false},'recompose',{w:1920,h:1080},{fetchImpl:fake(legacy,requests)});
 assert.equal(Object.hasOwn(requests[1].body,'deliveryMode'),false);
});

test('reconstruction preserves actual products, package labels and text separation while removing only the outer advertising carrier',()=>{
 const prompt=visualPrompt('reconstruct',{...doc,packageLabels:[{text:'CAFÉ 100%'}]},{w:1080,h:1920});
 assert.match(prompt,/CAFÉ 100%/);assert.match(prompt,/same products, packaging, shape, colours/);
 assert.match(prompt,/Do not render any headline, price, legal copy/);
 assert.match(prompt,/outer advertising carrier/);
 assert.match(prompt,/not product packaging/);
});
