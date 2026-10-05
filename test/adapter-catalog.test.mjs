import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatalog,CAMPAIGNS,matchingFormats,customFormat,restoreCustomFormats,LIBRARY_SIZE_COUNT,isLibrarySize,applyCampaign,setGroupSelected,groupSelection,selectAllSizes} from '../adaptaciones/format-catalog.mjs';
import {restore,snapshot,defaults} from '../adaptaciones/adapter-core.mjs';
import {pngDensity} from '../adaptaciones/png-density.mjs';
test('campaigns have unique dimensions/IDs and correct PNG/mobile membership',()=>{
 const f=createCatalog();assert.equal(new Set(f.map(x=>x.id)).size,f.length);
 assert.equal(CAMPAIGNS[0].id,'altadis');
 assert.deepEqual(CAMPAIGNS.filter(c=>c.id!=='altadis').map(c=>f.filter(c.matches).length),[8,23,3]);
 const display=CAMPAIGNS.find(c=>c.id==='display');
 assert.ok(f.filter(display.matches).every(x=>x.output==='png'&&x.category==='display'));
 assert.deepEqual(f.filter(x=>x.on).map(x=>x.id),['9:16','16:9','1:1','4:5']);
});
test('search normalises dimensions and orientation without changing selection',()=>{
 const f=createCatalog(),before=f.filter(x=>x.on).map(x=>x.id);
 assert.equal(matchingFormats(f,{query:'300 × 250'}).length,1);
 assert.equal(matchingFormats(f,{query:'300x250',orientation:'portrait'}).length,0);
 assert.equal(matchingFormats(f,{query:'poster'}).length,1);
 assert.deepEqual(f.filter(x=>x.on).map(x=>x.id),before);
});
test('custom storage validates size, caps count, removes duplicates and preserves selection',()=>{
 assert.equal(customFormat(65,100),null);assert.equal(customFormat(3840,3840),null);
 const raw=[[500,500],[500,500],['<script>',100],[400,300]],custom=restoreCustomFormats(raw);
 assert.equal(custom.length,2);const f=[...createCatalog(),...custom];custom[0].on=true;
 const state={profile:'standard',compat:'fhd',modoGlobal:'auto',fmt:Object.fromEntries(f.map(x=>[x.id,defaults()]))};
 const saved=snapshot(state,f);assert.deepEqual(saved.custom,[[500,500],[400,300]]);
 assert.ok(restore(saved,f).selected.includes('custom-500x500'));
 assert.equal(restoreCustomFormats(Array.from({length:20},(_,i)=>[100+i*2,100])).length,12);
});
test('campaigns replace the library selection, groups toggle, and all sizes marks 42',()=>{
 const f=createCatalog();
 assert.equal(f.filter(isLibrarySize).length,LIBRARY_SIZE_COUNT);
 assert.deepEqual(CATEGORIES_OK(f),[8,6,23,5]);
 assert.equal(applyCampaign(f,'mobile'),3);
 assert.deepEqual(f.filter(x=>x.on).map(x=>[x.custom[0],x.custom[1]]),[[300,50],[320,50],[320,100]]);
 assert.equal(applyCampaign(f,'social'),8);
 assert.equal(f.filter(x=>x.on&&x.category==='social').length,8);
 assert.equal(f.filter(x=>x.on&&x.category!=='social').length,0);
 assert.equal(applyCampaign(f,'display'),23);
 assert.equal(selectAllSizes(f),42);
 assert.equal(f.filter(x=>isLibrarySize(x)&&x.on).length,42);
 assert.equal(groupSelection(f,'digital').total,6);
 setGroupSelected(f,'social',false);
 assert.deepEqual(groupSelection(f,'social'),{total:8,on:0,all:false,none:true});
 assert.equal(f.filter(x=>x.on).length,34);
 f.find(x=>x.id==='social-story').on=true;
 const partial=groupSelection(f,'social');
 assert.equal(partial.on,1);assert.equal(partial.all,false);assert.equal(partial.none,false);
 assert.equal(groupSelection(f,'print').on,5);
});
function CATEGORIES_OK(f){return ['social','digital','display','print'].map(id=>f.filter(x=>isLibrarySize(x)&&x.category===id).length);}
test('print PNG density retains pixels and inserts valid pHYs CRC at 150 ppi',()=>{
 const original=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9JkAAAAASUVORK5CYII=','base64'));
 const output=pngDensity(original),view=new DataView(output.buffer);
 assert.equal(output.length,original.length+21);assert.equal(view.getUint32(41),5906);
 assert.equal(view.getUint32(45),5906);assert.equal(output[49],1);
 let crc=0xffffffff;for(const byte of output.slice(37,50)){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}assert.equal(view.getUint32(50),(crc^0xffffffff)>>>0);
 assert.deepEqual(output.slice(54),original.slice(33));assert.equal(pngDensity(output).length,output.length);
});
