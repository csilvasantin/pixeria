import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {TARGETS,probe,sourceInfo,renderPlan,verify} from '../scripts/render-adaptaciones-demo.mjs';

const media=fileURLToPath(new URL('../adaptaciones/media/',import.meta.url));
const manifest=JSON.parse(readFileSync(media+'jti-renders.json','utf8'));
test('JTI/Altadis files retain the source message, audio, duration and signage compatibility',()=>{
  const source=probe(media+manifest.source.file),info=sourceInfo(source);
  assert.equal(createHash('sha256').update(readFileSync(media+manifest.source.file)).digest('hex'),manifest.source.sha256);
  for(const target of TARGETS){
    const plan=renderPlan(info,target),entry=manifest.renders.find(r=>r.id===target.id);
    assert.equal(plan.mode,'blur');assert.equal(plan.technical.encaje,'contener');
    assert.deepEqual(plan.focus,{modo:'auto',fx:.5,fy:.5,zoom:1});
    assert.deepEqual(verify(media+target.file,target,source),Object.fromEntries(
      ['width','height','videoCodec','pixelFormat','fps','audioCodec','duration','bytes','sha256'].map(k=>[k,entry[k]])));
    assert.match(plan.job.args[plan.job.args.indexOf('-filter_complex')+1],/gblur=.*overlay=x=/);
    assert.equal(entry.mode,plan.mode);assert.deepEqual(entry.focus,plan.focus);
  }
});
