import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_CAMPAIGN,INSTALLATIONS,DIRECTIONS,planCampaign,safeRegions,intersects,restoreCampaign,campaignContract,campaignJob,validateInstallation} from '../adaptaciones/campaign-core.mjs';
const copy=x=>structuredClone(x);
const contains=(a,b)=>a.x>=b.x&&a.y>=b.y&&a.x+a.w<=b.x+b.w+.01&&a.y+a.h<=b.y+b.h+.01;
test('all fifteen compositions preserve exact copy and keep critical elements off joints and doorway',()=>{
 for(const i of INSTALLATIONS)for(const d of DIRECTIONS){
  const p=planCampaign(DEFAULT_CAMPAIGN,i,d.id);assert.equal(p.valid,true,`${i.id}/${d.id}: ${p.errors}`);
  assert.equal(p.layers.find(l=>l.role==='headline').lines.join(' '),DEFAULT_CAMPAIGN.headline);
  for(const l of p.layers.filter(l=>l.role!=='echo')){assert(p.regions.some(r=>contains(l,r)));for(const m of i.masks||[])assert(!intersects(l,m));}
 }
 const i=INSTALLATIONS[0];assert.notDeepEqual(planCampaign(DEFAULT_CAMPAIGN,i,'hero').layers,planCampaign(DEFAULT_CAMPAIGN,i,'sequence').layers);
});
test('unreadable text blocks delivery rather than truncating words',()=>{
 const c={...DEFAULT_CAMPAIGN,headline:'EXTRAORDINARIAMENTE'.repeat(100)};
 for(const i of INSTALLATIONS){const p=planCampaign(c,i);assert.equal(p.valid,false);assert(p.errors.includes('text-overflow:headline'));}
});
test('malformed external maps fail validation without crashing',()=>{
 for(const change of [{screens:[null]},{masks:{}},{masks:[null]},{width:1080.5},{screens:[{...INSTALLATIONS[0].screens[0],rotation:45}]}])assert(validateInstallation({...copy(INSTALLATIONS[0]),...change}).length);
 const overlapping=copy(INSTALLATIONS[0]);overlapping.screens.push({...overlapping.screens[0],id:'overlap'});assert(validateInstallation(overlapping).includes('screen-overlap'));
 const c=copy(DEFAULT_CAMPAIGN);c.installations=[null];assert.throws(()=>restoreCampaign(c),/campaign-installations/);
});
test('saved contracts retain identity, versions, masks and native rotation dimensions',()=>{
 const c=copy(DEFAULT_CAMPAIGN);c.id='my-sneakers';c.revision=7;c.installations[0].screens[0].rotation=90;
 const contract=campaignContract(c,{'landscape:hero:r7':{revision:7}}),restored=restoreCampaign(JSON.parse(JSON.stringify(contract.campaign)));
 assert.deepEqual(restored,c);assert.equal(contract.derived.length,11);
 assert.deepEqual([contract.derived[0].width,contract.derived[0].height],[1080,1920]);
 assert.equal(contract.delivery.hardwareVerified,false);assert.equal(contract.limits.measuredGeometry,false);
 const job=campaignJob(c,c.installations[0],c.installations[0].screens[0]);assert.deepEqual([job.W,job.H],[1080,1920]);assert.match(job.filename,/my-sneakers.*r7/);assert(job.args.includes('-an'));assert(job.args.includes('yuv420p'));
 for(const revision of [Infinity,NaN,-1,0,1.5,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>restoreCampaign({...c,revision}),/campaign-revision/);
 const odd=copy(INSTALLATIONS[0]);odd.screens[0].w=1919;assert.throws(()=>campaignJob(c,odd,odd.screens[0]),/even-resolution/);
});
test('openings within a single LED are subtracted from safe copy regions',()=>{
 const i={...copy(INSTALLATIONS[0]),masks:[{id:'opening',x:800,y:400,w:320,h:680}]};
 for(const r of safeRegions(i))assert(!intersects(r,i.masks[0]));
});
