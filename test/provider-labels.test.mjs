import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const source = read('app.js');
// Evaluate the production functions, replacing only their external dependencies.
// Missing boundaries fail instead of silently exercising a copied implementation.
function between(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, 'production source boundaries: ' + start);
  return source.slice(a, b);
}
const copyAndCatalogue = between('  function providerCopy(', '\n  function loadStore(');
const music = between('  function playMusica()', '\n  const ASPECT_IMAGEN');
const versions = between('  function sunoVersionToModel(', '\n  async function playSunoWebCapsula(');
const audio = between('  async function playAudio()', '\n  let _musicCtx');
const selectors = between('  function renderMotorSelectors()', '\n  // Persistir cambios');
const plain = value => JSON.parse(JSON.stringify(value));

function selectorWorld(lang, selection = {}) {
  const store = {audio:{motor:selection.audio || 'grok-voice'}, musica:{motor:selection.musica || 'pixer-loop'}};
  const hosts = ['audio', 'musica'].map(section => {
    const warning = {hidden:true, innerHTML:'', querySelector:() => null};
    return {dataset:{motorSection:section}, innerHTML:'', warning,
      querySelector:selector => selector === '[data-warning]' ? warning : null,
      querySelectorAll:() => []};
  });
  const context = vm.createContext({document:{documentElement:{lang}, querySelectorAll:() => hosts},
    COSTES_FECHA:'fixture', loadStore:() => store, hasKeyFor:() => true,
    setNested:() => assert.fail('existing IDs must be retained'), saveStore:() => assert.fail('no migration expected')});
  vm.runInContext(copyAndCatalogue + selectors + '\nrenderMotorSelectors();', context);
  return {context, hosts, catalogue:plain(vm.runInContext('MOTORES', context))};
}

for (const lang of ['es', 'en']) test('actual ' + lang + ' selectors show routed providers and credit without changing saved IDs', () => {
  const {hosts, catalogue} = selectorWorld(lang);
  assert.deepEqual(catalogue.audio.map(x => x.id), ['web-speech','grok-voice','elevenlabs-v3']);
  assert.deepEqual(catalogue.musica.map(x => x.id), ['pixer-loop','lyria-3-pro-preview','suno-local-v5','suno-web']);
  for (const [index, model] of ['Suno v4.5','Suno v5','Suno v5.5'].entries()) {
    assert.equal(catalogue.musica[index].nombre, model);
    assert.equal(catalogue.musica[index].tipo, 'pro');
    assert.match(catalogue.musica[index].coste, lang === 'en' ? /credits/ : /créditos/);
  }
  assert.match(hosts[0].innerHTML, /Google TTS/);
  assert.match(hosts[0].innerHTML, /ElevenLabs Flash v2\.5/);
  assert.doesNotMatch(hosts[0].innerHTML, /Grok|voz expresiva de xAI|TTS del sistema operativo/);
  assert.match(hosts[0].warning.innerHTML, /ElevenLabs.*\/tts/);
  assert.match(hosts[1].warning.innerHTML, /Suno.*\/generate/);
  assert.match(hosts[1].warning.innerHTML, lang === 'en' ? /balance are not verified/ : /saldo no verificados/);
  assert.doesNotMatch(hosts[1].innerHTML + hosts[1].warning.innerHTML, /gratis|free|Gemini|GCP|KEY.*configurada/);
  assert.match(catalogue.audio[0].desc, lang === 'en' ? /fallback without a file/ : /respaldo.*sin fichero/);
  const better = selectorWorld(lang, {musica:'lyria-3-pro-preview'}).hosts[1];
  assert.match(better.warning.innerHTML, /Suno.*\/generate/);
  assert.doesNotMatch(better.warning.innerHTML, /Google|Gemini|GCP/);
});

test('saved music IDs and the default dispatch to their actual Suno models; capsule dispatch remains separate', () => {
  let selected;
  const calls = [];
  const context = vm.createContext({loadStore:() => ({musica:{motor:selected}}),
    playSunoLocal:(brief, model) => calls.push({brief, model}),
    playSunoWebCapsula:() => calls.push({capsule:true}),
    fetch:() => assert.fail('network forbidden')});
  vm.runInContext(music, context);
  for (const [id, model] of [[undefined,'chirp-v4-5'], ['pixer-loop','chirp-v4-5'],
    ['lyria-3-pro-preview','chirp-v5'], ['suno-local-v5','chirp-v5-5'], ['suno-local-v45','chirp-v4-5']]) {
    selected = id; context.playMusica();
    assert.equal(calls.at(-1).model, model); assert.equal(calls.at(-1).brief.motor, id);
  }
  selected = 'suno-web'; context.playMusica();
  assert.deepEqual(calls.at(-1), {capsule:true});
  assert.equal(calls.length, 6);
});

test('legacy version value v6 still routes to v5.5 and both rendered options disclose that model', () => {
  const context = vm.createContext({}); vm.runInContext(versions, context);
  for (const [value, model] of [['v6','chirp-v5-5'], ['v5','chirp-v5'], ['v4.5','chirp-v4-5']]) {
    assert.equal(context.sunoVersionToModel(value), model);
  }
  for (const page of ['musica.html','en/musica.html']) {
    const option = read(page).match(/<option\b[^>]*value="v6"[^>]*>([^<]+)<\/option>/);
    assert.ok(option, page + ' retains the saved v6 value');
    assert.match(option[1], /v5\.5.*chirp-v5-5/);
  }
});

function audioWorld({lang = 'es', motor = 'grok-voice', ok = true, confirmed = true} = {}) {
  const calls = [], html = [], prompts = [], spoken = [], publications = [], downloads = [], blobs = [];
  let cancelled = 0;
  const speech = {cancel:() => cancelled++, getVoices:() => [{name:'Local fixture',lang:'es-ES'}], speak:u => spoken.push(u)};
  const context = vm.createContext({document:{documentElement:{lang}},
    loadStore:() => ({audio:{motor,guion:'  Hola <equipo>  ',idioma:'fixture-es'}}),
    loadKeys:() => ({elevenlabs_voice:'fixture-voice'}), ELEVEN_WORKER_URL:'https://api.admira.store',
    LANG_MAP:{'fixture-es':'es-ES'},
    confirmPro:async (...args) => {prompts.push(args); return confirmed;},
    paidFetch:async (url, init) => {calls.push({url,method:init.method,headers:plain(init.headers),body:JSON.parse(init.body)});
      return {ok,status:ok?200:503, blob:async () => new Blob(['fixture'],{type:'audio/mpeg'})};},
    fetch:() => assert.fail('real network forbidden'),
    URL:{createObjectURL:blob => {blobs.push(blob); return 'blob:fixture';}},
    Blob, showPlayer:value => html.push(value), progressHtml:() => '', startProgress:() => () => {},
    deriveAssetTitle:() => 'Fixture', pollinationsCoverFor:() => '', escAttr:value => value,
    publishBtnHTML:meta => {publications.push(meta); return '';},
    downloadBtnHTML:meta => {downloads.push(meta); return '';},
    window:{speechSynthesis:speech}, speechSynthesis:speech,
    SpeechSynthesisUtterance:class {constructor(text){this.text=text;}}});
  vm.runInContext(between('  function providerCopy(', '\n\n  // Catálogo') + audio, context);
  return {run:() => context.playAudio(),calls,html,prompts,spoken,publications,downloads,blobs,cancelled:() => cancelled};
}

test('historical grok-voice emits the exact ElevenLabs request and displays its actual model', async () => {
  const world = audioWorld(); await world.run();
  assert.deepEqual(world.calls, [{url:'https://api.admira.store/tts',method:'POST',headers:{'Content-Type':'application/json'},
    body:{text:'Hola <equipo>',voice_id:'fixture-voice',model_id:'eleven_flash_v2_5',voice_settings:{stability:0.5,similarity_boost:0.75}}}]);
  assert.match(world.prompts[0][0], /ElevenLabs Flash v2\.5/);
  assert.match(world.html.at(-1), /ElevenLabs Flash v2\.5/);
  assert.match(world.html.at(-1), /model_id eleven_flash_v2_5/);
  assert.doesNotMatch(world.html.join(''), /Grok|xAI|model_id grok-voice/);
  assert.equal(world.blobs[0].type, 'audio/mpeg');
  assert.equal(world.publications[0].motor, 'grok-voice', 'saved identity is not migrated');
  assert.equal(world.spoken.length, 0);
});

test('declining a paid voice does not issue any request', async () => {
  const world = audioWorld({confirmed:false}); await world.run();
  assert.equal(world.calls.length, 0); assert.equal(world.publications.length, 0);
});

for (const lang of ['es','en']) test('Google TTS success and local-only fallback are distinguished in ' + lang, async () => {
  const success = audioWorld({lang,motor:'web-speech'}); await success.run();
  assert.deepEqual(success.calls, [{url:'https://api.admira.store/tts/free',method:'POST',headers:{'Content-Type':'application/json'},body:{text:'Hola <equipo>',lang:'es'}}]);
  assert.match(success.html.at(-1), /Google TTS/); assert.match(success.html.at(-1), /MP3/);
  assert.equal(success.blobs.length, 1); assert.equal(success.publications.length, 1); assert.equal(success.spoken.length, 0);
  const failed = audioWorld({lang,motor:'web-speech',ok:false}); await failed.run();
  assert.deepEqual(failed.calls, success.calls);
  assert.match(failed.html.at(-1), /Web Speech/);
  assert.match(failed.html.at(-1), lang === 'en' ? /without a file/ : /sin fichero/);
  assert.equal(failed.blobs.length, 0); assert.equal(failed.publications.length, 0); assert.equal(failed.downloads.length, 0);
  assert.equal(failed.cancelled(), 1); assert.equal(failed.spoken.length, 1);
  assert.equal(failed.spoken[0].text, 'Hola <equipo>'); assert.equal(failed.spoken[0].lang, 'es-ES');
});

test('music capability copy separates Suno generation, prepared samples and unverified usage rights in both languages', () => {
  for (const [path, terms] of [['musica.html', [/Suno/, /crédito/, /pendiente/, /no certifica/]],
    ['en/musica.html', [/Suno/, /credit/, /proposed integration/, /does not certify/]]]) {
    const section = read(path).match(/<section\b[^>]*class="module cap-hilo"[\s\S]*?<\/section>/)?.[0];
    assert.ok(section, path);
    for (const term of terms) assert.match(section, term);
    assert.doesNotMatch(section, /Se produce con|Produced with|apta para difusión|cleared for public-space|sin las zonas grises|without the rights grey/);
  }
  const cc = read('clearchannel/index.html');
  assert.match(cc, /muestras locales preparadas/);
  assert.match(cc, /Flujo propuesto, pendiente de integración/);
  assert.match(cc, /Esta demo no acredita esos derechos/);
  assert.doesNotMatch(cc, /Un solo proveedor de audio|Un solo proveedor para todo el audio|Flujo real en producción|sin zonas grises de derechos|una única integración que mantener/);
});

test('actual Suno generation sends the selected model unchanged and labels the resulting provider/model', async () => {
  const generate = between('  async function playSunoLocal(', '\n  // Traducciones ES→EN para Lyria');
  for (const model of ['chirp-v4-5','chirp-v5','chirp-v5-5']) {
    const calls = [], html = [];
    const context = vm.createContext({document:{documentElement:{lang:'en'}}, SUNO_LOCAL_URL:'https://suno.fixture.invalid',
      setMusicCover:() => {}, updateMusicStage:() => {}, refreshMusicHealth:async () => ({ok:true}),
      loadStore:() => ({}), deriveAssetTitle:() => 'Fixture', showPlayer:s => html.push(s),
      progressHtml:() => '', startProgress:() => () => {}, setProgressLabel:() => {},
      setTimeout:fn => fn(), escAttr:s => s, publishBtnHTML:() => '', downloadBtnHTML:() => '',
      fetch:async (url, init) => {
        calls.push({url, ...(init ? {method:init.method,body:JSON.parse(init.body)} : {})});
        if(url.endsWith('/generate')) return {ok:true,json:async () => ({ids:['fixture-clip']})};
        assert.equal(url,'https://suno.fixture.invalid/status?ids=fixture-clip');
        return {json:async () => [{id:'fixture-clip',status:'complete',audio_url:'https://fixture.invalid/audio.mp3'}]};
      }});
    vm.runInContext(between('  function providerCopy(', '\n\n  // Catálogo') + generate, context);
    await context.playSunoLocal({letra:'Fixture lyrics',style:'jazz',titulo:'Fixture title'},model);
    assert.deepEqual(calls[0],{url:'https://suno.fixture.invalid/generate',method:'POST',
      body:{prompt:'jazz',lyrics:'Fixture lyrics',title:'Fixture title',instrumental:false,model}});
    assert.equal(calls.length,2);
    assert.match(html.at(-1),/HILO MUSICAL · Suno/);
    assert.ok(html.at(-1).includes('model_id '+model));
  }
});

test('voice capability copy describes selectable providers and does not claim PA delivery', () => {
  for (const [page, noDelivery] of [['audio.html',/no acredita entrega/], ['en/audio.html',/does not certify delivery/]]) {
    const section=read(page).match(/<section\b[^>]*class="module cap-megafonia"[\s\S]*?<\/section>/)?.[0];
    assert.ok(section); assert.match(section,/Google TTS/); assert.match(section,/ElevenLabs/); assert.match(section,/Web Speech/);
    assert.match(section,noDelivery); assert.doesNotMatch(section,/lo encola en la zona|enqueues it in the right PA zone|voz al instante con ElevenLabs|voice instantly with ElevenLabs/);
  }
  assert.match(selectorWorld('en').hosts[1].innerHTML,/Engine · music/);
});

test('shared navigation startup preserves truthful provider labels and titles instead of installing a masking observer', () => {
  const nav=read('assets/site-nav.js');
  const start=nav.indexOf('  function forgetOpenPanels()');
  const end=nav.indexOf("  if (document.readyState",start);
  assert.ok(start>=0 && end>start);
  const node={nodeType:3,nodeValue:'Suno v5 · créditos Suno',nextSibling:null};
  const body={nodeType:1,nodeName:'BODY',textContent:node.nodeValue,firstChild:node,
    getAttribute:() => null,querySelector:() => null};node.parentNode=body;
  const document={body,title:'Suno v5.5 · music'};
  let observers=0;
  const context=vm.createContext({document,localStorage:{removeItem:() => {}},
    normalizeInternalNav:() => {},syncRailVersion:() => {},trackTopbarHeight:() => {},setTimeout:() => {},
    MutationObserver:class{constructor(){observers++;}observe(){}}});
  vm.runInContext(nav.slice(start,end)+'\nstart();',context);
  assert.equal(node.nodeValue,'Suno v5 · créditos Suno');assert.equal(document.title,'Suno v5.5 · music');
  assert.equal(observers,0,'common startup must not mask later provider names');
});
