import test from 'node:test';
import assert from 'node:assert/strict';
import {newCampaign,CREATOR_KEY} from '../adaptaciones/campaign-entry.mjs';
import {DEFAULT_CAMPAIGN,restoreCampaign,planCampaign} from '../adaptaciones/campaign-core.mjs';
test('a fresh Creator campaign has neutral assets and valid native plans, separate from the store pilot',()=>{
 const c=newCampaign(false,'test-campaign');assert.equal(c.name,'Nueva campaña');assert.equal(c.installations.length,3);assert.notEqual(c.product,DEFAULT_CAMPAIGN.product);assert.notEqual(CREATOR_KEY,DEFAULT_CAMPAIGN.schema);assert.deepEqual(restoreCampaign(c),c);
 for(const i of c.installations)assert.ok(planCampaign(c,i).valid);
 c.installations[0].width=2560;assert.equal(DEFAULT_CAMPAIGN.installations[0].width,1920);
});
test('new campaign identities and copy are independent across starts and languages',()=>{
 const a=newCampaign(true,'campaign-a'),b=newCampaign(false,'campaign-b');assert.equal(a.headline,'YOUR HEADLINE');assert.equal(b.headline,'TU TITULAR');assert.notEqual(a.id,b.id);assert.notEqual(a.installations,b.installations);assert.notEqual(a.placements,b.placements);
});
