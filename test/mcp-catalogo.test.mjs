import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {seleccionarCatalogo, pintarCatalogo, cargarCatalogo} from '../mcp/catalogo.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const fallback = JSON.parse(read('mcp/catalogo.json'));
// Independently listed from the actual MCP contract, rather than deriving the
// expected list from the new fallback being tested.
const names = ['creador_demo','creador_imagen_generar','creador_imagen_guardar',
  'campana_instalacion','altadis_formatos','fondo_adaptacion_ia','demo_muestra',
  'demos_listar','crear_musica','voces_catalogo','crear_locucion','crear_imagen',
  'adaptar_imagen','anuncio_analizar','adaptacion_plan','anonymizer_demo',
  'search_stock','stock_stats','get_asset','clip_desde_imagen','clip_guion','clip_estado'];
const toolNames = catalogue => catalogue.tools.map(tool => tool.name);
const live = tools => ({tools,server:{version:'audit-fixture-r1'}});

test('the documented fallback covers the current 22 tools with bilingual, explicit execution metadata',()=>{
  assert.equal(fallback.version,1);
  assert.ok(Number.isFinite(Date.parse(fallback.verifiedAt)));
  assert.equal(typeof fallback.source,'string');assert.ok(fallback.source.trim());
  assert.deepEqual([...toolNames(fallback)].sort(),[...names].sort());
  for(const tool of fallback.tools){
    for(const key of ['category','mode','auth','cost']) assert.ok(typeof tool[key]==='string'&&tool[key].trim(),tool.name+': '+key);
    for(const language of ['es','en']) assert.ok(typeof tool.description[language]==='string'&&tool.description[language].trim(),tool.name+': '+language);
  }
});

test('a valid live list is authoritative, including future tools and omitting removed tools',()=>{
  const original=JSON.stringify(fallback);
  const result=seleccionarCatalogo(live(['search_stock','future_tool']),fallback);
  assert.equal(result.source,'live');
  assert.deepEqual(toolNames(result),['search_stock','future_tool']);
  assert.equal(result.server,'audit-fixture-r1');
  assert.equal(result.tools.find(tool=>tool.name==='future_tool').category,'other');
  for(const language of ['es','en']) assert.ok(result.tools[1].description[language].trim());
  assert.equal(JSON.stringify(fallback),original,'selection does not mutate the saved catalogue');
});

test('live duplicates collapse without inventing tools, and all current tools survive',()=>{
  const result=seleccionarCatalogo(live([...names,names[0],names[0]]),fallback);
  assert.equal(result.source,'live');assert.deepEqual(toolNames(result),names);
});

test('missing, empty, malformed and hostile live names use an honest fallback',()=>{
  for(const value of [null,{}, {...live(['search_stock']),ok:false},live([]),live('search_stock'),live([null]),live([{}]),
    live(['Search_stock']),live(['1tool']),live(['x'.repeat(81)]),
    live(['search_stock','<img src=x onerror=alert(1)>']),live(['bad-tool']),live(['a\n'])]){
    const result=seleccionarCatalogo(value,fallback);
    assert.equal(result.source,'fallback',JSON.stringify(value));
    assert.deepEqual(toolNames(result),toolNames(fallback));
  }
});

test('live catalogues accept the 100-tool boundary and reject oversized responses',()=>{
  const hundred=Array.from({length:100},(_,i)=>'tool_'+i);
  const accepted=seleccionarCatalogo(live(hundred),fallback);
  assert.equal(accepted.source,'live');assert.equal(accepted.tools.length,100);
  const rejected=seleccionarCatalogo(live([...hundred,'tool_100']),fallback);
  assert.equal(rejected.source,'fallback');assert.deepEqual(toolNames(rejected),toolNames(fallback));
});

test('loading only reads the local fallback and credential-free public health endpoint',async()=>{
  const calls=[];
  const result=await cargarCatalogo({fetchImpl:async(url,init)=>{
    calls.push({url:String(url),init});
    if(String(url).endsWith('/catalogo.json')) return Response.json(fallback);
    assert.equal(String(url),'https://mcp-pixeria.admira.store/');
    assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');
    assert.equal(init.cache,'no-store');assert.ok(init.signal instanceof AbortSignal);
    assert.equal(init.body,undefined);assert.equal(init.headers,undefined);
    return Response.json(live(['search_stock','future_tool']));
  }});
  assert.equal(calls.length,2);assert.equal(result.source,'live');
  assert.deepEqual(toolNames(result),['search_stock','future_tool']);
});

test('unavailable public health or invalid JSON preserves the explicit fallback',async()=>{
  for(const failure of ['network','http','json']){
    let calls=0;
    const result=await cargarCatalogo({fetchImpl:async(url)=>{
      calls++;
      if(String(url).endsWith('/catalogo.json')) return Response.json(fallback);
      if(failure==='network') throw Error('offline fixture');
      if(failure==='http') return new Response(null,{status:503});
      return new Response('not JSON');
    }});
    assert.equal(calls,2);assert.equal(result.source,'fallback');
    assert.equal(result.updatedAt,fallback.verifiedAt);
    assert.deepEqual(toolNames(result),toolNames(fallback));
  }
});

function fakeDOM(){
  const document={createElement:tag=>new Node(tag),createTextNode:value=>{const n=new Node('#text');n.textContent=value;return n;}};
  class Node{
    constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.ownerDocument=document;this.dataset={};this.attributes={};this._text='';}
    set innerHTML(_){throw Error('HTML parsing is forbidden for catalogue rendering');}
    set textContent(value){this._text=String(value);this.children=[];}
    get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
    append(...children){this.children.push(...children.map(child=>typeof child==='string'?document.createTextNode(child):child));}
    appendChild(child){this.append(child);return child;}
    replaceChildren(...children){this._text='';this.children=[];this.append(...children);}
    setAttribute(key,value){this.attributes[key]=String(value);}
  }
  return new Node('div');
}

test('rendering keeps hostile descriptions inert, includes ES/EN and replaces old results',()=>{
  const container=fakeDOM(),hostile='<img src=x onerror="alert(1)">';
  const catalogue=seleccionarCatalogo(live(['search_stock']),fallback);
  catalogue.tools[0]={...catalogue.tools[0],description:{es:hostile,en:'English safe fixture'}};
  pintarCatalogo(container,catalogue);
  assert.ok(container.textContent.includes('search_stock'));
  assert.ok(container.textContent.includes(hostile));assert.ok(container.textContent.includes('English safe fixture'));
  const walk=node=>[node,...node.children.flatMap(walk)];
  assert.equal(walk(container).some(node=>['SCRIPT','IMG','IFRAME'].includes(node.tagName)),false);
  assert.ok(walk(container).some(node=>node.lang==='es'&&node.textContent===hostile));
  assert.ok(walk(container).some(node=>node.lang==='en'&&node.textContent==='English safe fixture'));
  assert.ok(walk(container).some(node=>node.tagName==='H3'&&node.textContent.trim()),'tools are grouped under a visible category');
  pintarCatalogo(container,seleccionarCatalogo(live(['stock_stats']),fallback));
  assert.ok(container.textContent.includes('stock_stats'));assert.equal(container.textContent.includes(hostile),false);
});

test('the public page provides one connection configuration and no executable tool-call UI',()=>{
  const html=read('mcp/index.html');
  assert.equal((html.match(/"mcpServers"/g)||[]).length,1);
  assert.match(html,/https:\/\/mcp-pixeria\.admira\.store\/mcp/);
  assert.match(html,/catalogo\.mjs/);
  const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(match=>match[1]).join('\n');
  assert.doesNotMatch(scripts,/tools\/call|method\s*:\s*['"]POST['"]|X-Fleet-Key|X-Notify-Key/);
});
