import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {DEFAULT_CAMPAIGN,INSTALLATIONS,DIRECTIONS,planCampaign,validateInstallation,restoreCampaign,campaignContract,campaignJob,intersects} from '../adaptaciones/campaign-core.mjs';
import {twinGeometry} from '../adaptaciones/gemelo-core.mjs';import {displayPlacementForReference} from '../adaptaciones/gemelo-catalog.mjs';
const clone=x=>JSON.parse(JSON.stringify(x));
test('all fifteen pilot compositions preserve verbatim copy and protect critical layers from every opening and joint',()=>{
 for(const i of INSTALLATIONS)for(const direction of DIRECTIONS){const plan=planCampaign(DEFAULT_CAMPAIGN,i,direction.id);assert.equal(plan.valid,true,`${i.id}:${direction.id} ${plan.errors}`);for(const layer of plan.layers.filter(l=>l.role!=='echo')){assert.ok(i.screens.some(s=>layer.x>=s.x&&layer.y>=s.y&&layer.x+layer.w<=s.x+s.w+.01&&layer.y+layer.h<=s.y+s.h+.01));assert.ok(!(i.masks||[]).some(m=>intersects(layer,m)));if(layer.text)assert.equal(layer.lines.join(' '),layer.text);}}
});
test('a manually moved headline over the doorway blocks export, and the original campaign stays intact',()=>{
 const c=clone(DEFAULT_CAMPAIGN);c.placements={'rear:hero:headline':{x:.4,y:.5,w:.2,h:.2}};const p=planCampaign(c,INSTALLATIONS.find(i=>i.id==='rear'));assert.equal(p.valid,false);assert.ok(p.errors.some(e=>e.startsWith('unsafe-layer:')));assert.deepEqual(DEFAULT_CAMPAIGN.placements,{});
});
test('long unbreakable copy cannot be silently cropped or split into unreadable fragments',()=>{
 const p=planCampaign({...DEFAULT_CAMPAIGN,headline:'X'.repeat(500)},INSTALLATIONS[0]);assert.equal(p.valid,false);assert.ok(p.errors.includes('text-overflow:headline'));
});
test('invalid imports reject overlapping screens, duplicate IDs, invalid durations and executable asset URLs',()=>{
 for(const mutate of [c=>c.product='javascript:alert(1)',c=>c.logo='//other.test/logo.png',c=>c.seconds=NaN,c=>c.id='../secret',c=>c.installations[0].screens.push({...c.installations[0].screens[0],id:'duplicate'}),c=>c.installations.push(c.installations[0]),c=>c.installations[0].masks={},c=>c.placements={'rear:hero:headline':{x:NaN,y:0,w:1,h:1}}]){const c=clone(DEFAULT_CAMPAIGN);mutate(c);assert.throws(()=>restoreCampaign(c));}
 const c=clone(DEFAULT_CAMPAIGN);c.installations[0].screens[0].w=1921;assert.ok(validateInstallation(c.installations[0]).includes('screen-bounds'));
});
test('a portable campaign round trip retains assets, colour, custom maps and manual positions without trusting old approvals',()=>{
 const c=clone(DEFAULT_CAMPAIGN);c.product='data:image/png;base64,AA==';c.headline='NUEVO PASO';c.placements={'landscape:hero:product':{x:.6,y:.2,w:.3,h:.6}};c.revision=8;const contract=campaignContract(c);assert.deepEqual(restoreCampaign(JSON.parse(JSON.stringify(contract.campaign))),c);assert.equal(contract.delivery.hardwareVerified,false);assert.equal(contract.limits.anamorphicExport,false);assert.equal(contract.derived.length,11);assert.ok(contract.derived.every(d=>d.tags.includes('campaign:sneakers-store')));
});
test('all native screen jobs have matching frame clocks, dimensions and traceable filenames; 90-degree panels compensate delivery',()=>{
 for(const i of INSTALLATIONS)for(const s of i.screens){const j=campaignJob(DEFAULT_CAMPAIGN,i,s);assert.equal(j.W,s.w);assert.equal(j.H,s.h);assert.equal(j.args[j.args.indexOf('-r')+1],'25');assert.equal(j.args[j.args.indexOf('-g')+1],'25');assert.equal(j.args[j.args.indexOf('-t')+1],'10');assert.ok(j.filename.includes(s.id));assert.ok(j.args.includes('-an'));}
 const i=clone(INSTALLATIONS[0]);i.screens[0].rotation=90;const j=campaignJob(DEFAULT_CAMPAIGN,i,i.screens[0]);assert.equal(j.W,1080);assert.equal(j.H,1920);
 i.screens[0].w=1919;assert.throws(()=>campaignJob(DEFAULT_CAMPAIGN,i,i.screens[0]),/even-resolution/);
});
test('existing renderer preserves Jordan staggering and the rear doorway while legacy incomplete walls remain rejected',()=>{
 for(const i of INSTALLATIONS){const g=twinGeometry({installation:i},{}),p=displayPlacementForReference(g,'mural');assert.equal(g.segments.length,i.screens.length);assert.equal(p.pieces.length,i.screens.length);assert.deepEqual(g.segments.map(s=>s.wall),i.screens.map(({x,y,w,h})=>({x,y,w,h})));}
 assert.throws(()=>displayPlacementForReference({pared:{ancho:100,alto:100},segments:[{n:1,N:1,wall:{x:0,y:0,w:90,h:90}}]},'mural'),/incomplete-wall/);
});
test('all twenty-nine Altadis IDs can be registered without rewriting the original delivery profiles',()=>{
 const read=name=>JSON.parse(fs.readFileSync(new URL('../adaptaciones/'+name,import.meta.url))),a=read('perfil-cliente-18.json'),b=read('perfil-cliente-especiales.json');assert.equal(a.formats.length+b.layouts.length,29);for(const f of a.formats){const i={id:f.id,width:f.custom[0],height:f.custom[1],screens:[{id:f.id,x:0,y:0,w:f.custom[0],h:f.custom[1]}]};assert.deepEqual(validateInstallation(i),[]);const p=planCampaign(DEFAULT_CAMPAIGN,i);assert.ok(p.valid||p.errors.some(e=>e.startsWith('text-overflow')));}
});

test('excluded installations retain editable geometry but cannot leak into the delivery manifest',()=>{const c=structuredClone(DEFAULT_CAMPAIGN);c.installations[1].enabled=false;const restored=restoreCampaign(c);assert.equal(restored.installations.length,5);const contract=campaignContract(restored);assert.equal(contract.derived.length,10);assert(!contract.derived.some(x=>x.installation==='portrait'));assert.equal(validateInstallation({...c.installations[0],enabled:'false'}).includes('installation-enabled'),true);});
