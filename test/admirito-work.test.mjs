import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mountAdmiritoWork} from '../assets/admirito-work.mjs';

function fixture(){
 const document={createElement:tag=>new Element(tag),querySelector:selector=>selector==='link[data-admirito-work]'?document.head.children.find(x=>x.tagName==='link'&&'admiritoWork' in x.dataset)||null:null};
 class Element{
  constructor(tag){this.tagName=tag;this.ownerDocument=document;this.children=[];this.parentNode=null;this.dataset={};this.attrs={};this.hidden=false;this.textContent='';this.className='';}
  append(...items){for(const item of items){item.remove();item.parentNode=this;this.children.push(item);}}
  before(item){const parent=this.parentNode;if(!parent)return;item.remove();item.parentNode=parent;parent.children.splice(parent.children.indexOf(this),0,item);}
  remove(){if(this.parentNode){const items=this.parentNode.children;items.splice(items.indexOf(this),1);this.parentNode=null;}}
  setAttribute(name,value){this.attrs[name]=value;}
  matches(selector){return selector.split(',').some(s=>this.className.split(' ').includes(s.trim().slice(1)));}
 }
 document.head=new Element('head');const card=new Element('article'),stage=new Element('div'),canvas=new Element('canvas'),controls=new Element('button');stage.className='stage';stage.append(canvas);card.append(stage,controls);
 return {document,Element,card,stage,canvas,controls};
}
function withDocument(w,fn){const previous=globalThis.document;globalThis.document=w.document;try{return fn();}finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}}

test('busy companion sits beside the existing image and restores the same stage and controls when idle',()=>{
 const w=fixture(),companion=mountAdmiritoWork({host:w.stage});
 assert.deepEqual(w.card.children,[w.stage,w.controls]);
 companion.update({busy:true,phase:'analyze'});
 const row=w.card.children[0],aside=row.children[1];
 assert.equal(row.className,'admirito-preview-row');assert.equal(row.children[0],w.stage);assert.equal(w.stage.children[0],w.canvas);
 assert.equal(w.card.children[1],w.controls,'approval/export controls stay outside the image row');
 assert.equal(aside.attrs.role,'status');assert.equal(aside.attrs['aria-live'],'polite');assert.equal(aside.attrs['aria-atomic'],'true');
 assert.match(aside.children[0].textContent,/analizando/);assert.doesNotMatch(aside.children[0].textContent,/%/);
 companion.update({busy:true,phase:'recreate'});assert.equal(w.card.children[0],row);assert.match(aside.children[0].textContent,/recreación/);
 companion.update({busy:false});assert.deepEqual(w.card.children,[w.stage,w.controls]);assert.equal(aside.parentNode,null);
 companion.destroy();companion.update({busy:true});assert.deepEqual(w.card.children,[w.stage,w.controls]);
});

test('a grid rebuild relocates the single companion and stylesheet without replacing any canvas',()=>{
 const w=fixture(),other=new w.Element('article'),next=new w.Element('div'),canvas=new w.Element('canvas');next.className='stage';next.append(canvas);other.append(next);let target=w.stage;
 withDocument(w,()=>{
  const companion=mountAdmiritoWork({host:()=>target,t:(_es,en)=>en});companion.update({busy:true});const aside=w.card.children[0].children[1];
  target=next;companion.update({busy:true,phase:'recreate'});
  assert.deepEqual(w.card.children,[w.stage,w.controls]);assert.equal(other.children[0].children[1],aside);assert.equal(next.children[0],canvas);assert.match(aside.children[0].textContent,/image is recreated/);
  const second=mountAdmiritoWork({host:other});assert.equal(w.document.head.children.length,1);assert.match(w.document.head.children[0].href,/admirito-work\.css\?v=admirito-work-1$/);
  target=null;companion.update({busy:true});assert.deepEqual(other.children,[next]);assert.equal(aside.parentNode,null);second.destroy();
 });
});

test('plain job containers support the same lifecycle, with no provider or avatar dependency',()=>{
 const w=fixture(),companion=mountAdmiritoWork({host:w.card,t:(_es,en)=>en});
 companion.update({busy:true,phase:'create'});const aside=w.card.children.at(-1);assert.equal(aside.className,'admirito-work');assert.match(aside.children[0].textContent,/created/);
 companion.destroy();assert.deepEqual(w.card.children,[w.stage,w.controls]);
 const code=readFileSync(new URL('../assets/admirito-work.mjs',import.meta.url),'utf8');assert.doesNotMatch(code,/fetch\(|setInterval\(|<iframe|https:\/\//);assert.match(code,/admirito-pencil-hand/);assert.match(code,/admirito-eraser-hand/);
});

test('motion reduction keeps a static illustration and narrow layouts move it outside the image row',()=>{
 const css=readFileSync(new URL('../assets/admirito-work.css',import.meta.url),'utf8');
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\.admirito-work \*\{animation:none!important\}/);
 assert.match(css,/@media\(max-width:480px\).*flex-wrap:wrap/s);assert.match(css,/\.admirito-work\[hidden\]\{display:none!important\}/);
 assert.doesNotMatch(css,/position:\s*(absolute|fixed)/,'no overlay can cover the product or copy');
});
