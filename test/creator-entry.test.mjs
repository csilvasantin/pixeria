import test from 'node:test';
import assert from 'node:assert/strict';
import {newCampaign,CREATOR_KEY,orientationPair} from '../adaptaciones/campaign-entry.mjs';
import {DEFAULT_CAMPAIGN,restoreCampaign,planCampaign} from '../adaptaciones/campaign-core.mjs';
test('a fresh Creator campaign has neutral assets and valid native plans, separate from the store pilot',()=>{
 const c=newCampaign(false,'test-campaign');assert.equal(c.name,'Nueva campaña');assert.equal(c.installations.length,3);assert.notEqual(c.product,DEFAULT_CAMPAIGN.product);assert.notEqual(CREATOR_KEY,DEFAULT_CAMPAIGN.schema);assert.deepEqual(restoreCampaign(c),c);
 for(const i of c.installations)assert.ok(planCampaign(c,i).valid);
 c.installations[0].width=2560;assert.equal(DEFAULT_CAMPAIGN.installations[0].width,1920);
});
test('new campaign identities and copy are independent across starts and languages',()=>{
 const a=newCampaign(true,'campaign-a'),b=newCampaign(false,'campaign-b');assert.equal(a.headline,'YOUR HEADLINE');assert.equal(b.headline,'TU TITULAR');assert.notEqual(a.id,b.id);assert.notEqual(a.installations,b.installations);assert.notEqual(a.placements,b.placements);
});
test('new campaigns already prepare both orientations from the same content; finding previews never mutates saved destinations',()=>{
 for(const en of [false,true]){
  const c=newCampaign(en,'pair-test'),pair=orientationPair(c.installations);
  assert.deepEqual(pair.map(i=>[i.id,i.width,i.height]),[['landscape',1920,1080],['portrait',1080,1920]]);
  for(const i of pair){assert.notEqual(i.enabled,false);assert.deepEqual(planCampaign(c,i).layers.filter(l=>l.text).map(l=>l.text),[c.headline,c.cta]);}
  pair[1].enabled=false;const before=structuredClone(c.installations);
  assert.equal(orientationPair(c.installations)[1],pair[1]);assert.deepEqual(c.installations,before);
  assert.deepEqual(orientationPair(c.installations.filter(i=>i.id!=='portrait')).map(i=>i.id),['landscape']);
 }
});
