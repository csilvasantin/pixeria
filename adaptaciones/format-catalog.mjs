// Dimensions are presets, not a promise of acceptance by an advertising network.
// Display reference: https://support.google.com/google-ads/answer/1722096
export const CATEGORIES = [
  {id:'social',es:'Redes sociales',en:'Social media'},
  {id:'digital',es:'Digital · pantallas',en:'Digital · screens'},
  {id:'display',es:'Anuncios display',en:'Display ads'},
  {id:'print',es:'Tamaños de impresión',en:'Print sizes'},
];
const format=(id,es,en,w,h,category,extra={})=>({id,nombre:es,nameEn:en,uso:es,useEn:en,custom:[w,h],category,on:false,native:true,...extra});
export function createCatalog(en=false) {
 const formats=[
  {id:'9:16',nombre:'Vertical 9:16',nameEn:'Portrait 9:16',uso:'tótem / escaparate',useEn:'totem / shop window',category:'digital',on:true},
  {id:'16:9',nombre:'Horizontal 16:9',nameEn:'Landscape 16:9',uso:'mostrador / LED',useEn:'counter / LED',category:'digital',on:true},
  {id:'1:1',nombre:'Cuadrado 1:1',nameEn:'Square 1:1',uso:'pantalla cuadrada / redes',useEn:'square screen / social',category:'digital',on:true},
  {id:'4:5',nombre:'Retrato 4:5',nameEn:'Portrait 4:5',uso:'feed / mupi pequeño',useEn:'feed / small display',category:'digital',on:true,custom:[1080,1350]},
  format('digital-bar','Barra LED','LED bar',1920,540,'digital'),
  format('digital-wide','Barra panorámica','Panoramic bar',3840,600,'digital'),
  format('social-instagram','Instagram · publicación','Instagram · post',1080,1080,'social'),
  format('social-facebook','Facebook · publicación cuadrada','Facebook · square post',1080,1080,'social'),
  format('social-story','Story / Reel','Story / Reel',1080,1920,'social'),
  format('social-portrait','Publicación vertical','Portrait post',1080,1350,'social'),
  format('social-pin','Pinterest · pin','Pinterest · pin',1000,1500,'social'),
  format('social-x-header','X · cabecera','X · header',1500,500,'social'),
  format('social-fb-cover','Facebook · portada','Facebook · cover',820,360,'social'),
  format('social-youtube','YouTube · portada','YouTube · cover',2560,1440,'social'),
 ];
 const display=[
  ['Small square',200,200],['Vertical rectangle',240,400],['Square',250,250],['Triple widescreen',250,360],
  ['Medium rectangle',300,250],['Large rectangle',336,280],['Netboard',580,400],
  ['Skyscraper',120,600],['Wide skyscraper',160,600],['Half page',300,600],['Portrait',300,1050],
  ['Banner',468,60],['Leaderboard',728,90],['Top banner',930,180],['Large leaderboard',970,90],
  ['Billboard',970,250],['Panorama',980,120],
  ['PL billboard',750,100],['PL double billboard',750,200],['PL triple billboard',750,300],
  ['Mobile banner',300,50],['Mobile leaderboard',320,50],['Large mobile banner',320,100],
 ];
 display.forEach(([name,w,h],i)=>formats.push(format(`display-${w}x${h}`,name,name,w,h,'display',{output:'png',mobile:i>=20,regional:i>=17&&i<20})));
 [[ 'a4','A4',1240,1754,'210 × 297 mm'],['a3','A3',1754,2480,'297 × 420 mm'],
  ['a5','A5',874,1240,'148 × 210 mm'],['card','Tarjeta / Business card',531,295,'90 × 50 mm'],
  ['poster','Póster / Poster',2362,3543,'400 × 600 mm']].forEach(([id,name,w,h,mm])=>formats.push(format(`print-${id}`,name,name,w,h,'print',{output:'png',print:true,uso:`${mm} · referencia 150 ppp`,useEn:`${mm} · 150 ppi reference`})));
 if(en) formats.forEach(f=>{f.nombre=f.nameEn;f.uso=f.useEn;});
 return formats;
}
// Formatos propios de un proyecto (ficha adaptaciones/proyectos/<id>.json): estándar,
// MyBlu y videowalls segmentados. Antes de las fichas era «perfil de cliente» (Altadis).
export const isProjectFormat = f => !!f.proyecto;
// Campañas generales (sin cliente). Las de cada proyecto salen de su ficha (projectCampaigns).
export const CAMPAIGNS=[
 {id:'social',es:'Campaña de redes sociales',en:'Social media campaign',descriptionEs:'Publicaciones, stories y portadas',descriptionEn:'Posts, stories and covers',matches:f=>f.category==='social'},
 {id:'display',es:'Anuncios display',en:'Display ads',descriptionEs:'Rectángulos, banners y formatos regionales',descriptionEn:'Rectangles, banners and regional sizes',matches:f=>f.category==='display'},
 {id:'mobile',es:'Anuncios móviles',en:'Mobile ads',descriptionEs:'Tres banners para móvil',descriptionEn:'Three mobile banners',matches:f=>f.mobile},
];
export const formatFamily=f=>f.especial?'especiales':f.proyecto?'proyecto':'standard';
export function matchingFormats(formats,{query='',orientation='all',category,profile='standard'}={}) {
 const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[×:]/g,'x').replace(/\s+/g,'');
 const q=norm(query);
 return formats.filter(f=>{
  if(profile==='proyecto'){ if(!isProjectFormat(f)) return false; }
  else if(formatFamily(f)!==profile) return false;
  if(category&&f.category!==category) return false;
  const [w,h]=f.custom||({'9:16':[1080,1920],'16:9':[1920,1080],'1:1':[1080,1080],'4:5':[1080,1350]}[f.id]||[0,0]);
  if(orientation!=='all'&&(orientation==='portrait'?h<=w:orientation==='landscape'?w<=h:w!==h)) return false;
  return !q||norm([f.nombre,f.nameEn,f.uso,f.id,`${w}x${h}`,w,h].join(' ')).includes(q);
 });
}
export function customFormat(width,height,en=false) {
 const w=Number(width),h=Number(height);
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<64||h<64||w>3840||h>3840||w%2||h%2||w*h>3840*2160) return null;
 return format(`custom-${w}x${h}`,`${en?'Custom':'Personalizado'} ${w}×${h}`,`Custom ${w}×${h}`,w,h,'digital',{user:true});
}
export function restoreCustomFormats(raw,en=false) {
 if(!Array.isArray(raw)) return [];
 const seen=new Set();return raw.slice(0,12).flatMap(size=>{
  if(!Array.isArray(size))return [];const f=customFormat(size[0],size[1],en);
  if(!f||seen.has(f.id))return [];seen.add(f.id);return [f];
 });
}
// The size library is the 42 presets (social 8, digital 6, display 23, print 5).
// Project formats and sizes the user typed are other families.
export const LIBRARY_SIZE_COUNT = 42;
export const isLibrarySize = f => !f.proyecto && !f.especial && !f.user;
export function applyCampaign(formats, campaignId, campaigns = CAMPAIGNS) {
 const campaign = campaigns.find(c => c.id === campaignId);
 if (!campaign) return 0;
 let n = 0;
 const profile = campaign.profile || 'standard';
 for (const f of formats) {
  // Biblioteca: solo presets de redes/digital/display/impresión.
  // Campañas de proyecto (ficha): activan la familia «proyecto» y sus formatos.
  if (profile === 'standard') {
   if (!isLibrarySize(f)) continue;
  } else if (profile === 'proyecto') {
   if (!isProjectFormat(f) || (campaign.proyecto && f.proyecto !== campaign.proyecto)) continue;
  } else if (formatFamily(f) !== profile) continue;
  f.on = !!campaign.matches(f);
  if (f.on) n++;
 }
 return n;
}
export function setGroupSelected(formats, categoryId, on) {
 let n = 0;
 for (const f of formats) {
  if (!isLibrarySize(f) || f.category !== categoryId) continue;
  f.on = !!on;
  if (f.on) n++;
 }
 return n;
}
export function groupSelection(formats, categoryId) {
 const group = formats.filter(f => isLibrarySize(f) && f.category === categoryId);
 const on = group.filter(f => f.on).length;
 return { total: group.length, on, all: group.length > 0 && on === group.length, none: on === 0 };
}
export function selectAllSizes(formats) {
 let n = 0;
 for (const f of formats) {
  if (!isLibrarySize(f)) continue;
  f.on = true;
  n++;
 }
 return n;
}

// ── Selección por grupos del panel ☰ (Carlos, 6-oct-2026) ──────────────────
// Un clic en el control de un grupo marca el grupo entero; si ya estaba entero, lo desmarca.
// Los grupos dependen de la familia activa: en la biblioteca, las cuatro categorías (con los
// tamaños propios dentro de Digital); en un proyecto, estándar, MyBlu y especiales (videowalls).
// Con búsqueda u orientación activas, el control actúa solo sobre lo visible.
export const PROJECT_GROUPS = [
 {id:'estandar',es:'Estándar',en:'Standard',matches:f=>!f.especial&&!f.myblu},
 {id:'myblu',es:'MyBlu',en:'MyBlu',matches:f=>!f.especial&&!!f.myblu},
 {id:'especiales',es:'Especiales · videowalls',en:'Specials · video walls',matches:f=>!!f.especial},
];
export const inFamily = (f, profile = 'standard') => profile === 'proyecto' ? isProjectFormat(f) : formatFamily(f) === profile;
export function sizeGroups(formats, profile = 'standard') {
 const family = formats.filter(f => inFamily(f, profile));
 const defs = profile === 'standard' ? CATEGORIES.map(c => ({...c, matches: f => f.category === c.id})) : PROJECT_GROUPS;
 return defs.map(({matches, ...d}) => ({...d, members: family.filter(matches)})).filter(g => g.members.length);
}
// Tri-estado: 'true' (todos), 'false' (ninguno) o 'mixed' (algunos), como aria-checked.
export function selectionState(members) {
 const total = members.length, on = members.filter(f => f.on).length;
 const all = total > 0 && on === total, none = on === 0;
 return {total, on, all, none, partial: !all && !none, checked: all ? 'true' : none ? 'false' : 'mixed'};
}
// Todos marcados → desmarca todos; ninguno o algunos → marca todos. Devuelve el nuevo valor.
export function toggleSelection(members) {
 const value = !selectionState(members).all;
 for (const f of members) f.on = value;
 return value;
}
// Rótulo de la acción que hará el próximo clic: «Marcar los 8», «Desmarcar los 8»,
// «Marcar 5 visibles» (con filtro activo).
export function selectionAction(state, {filtered = false, en = false} = {}) {
 const n = state.total, off = state.all;
 if (filtered) return en ? `${off ? 'Clear' : 'Select'} ${n} visible` : `${off ? 'Desmarcar' : 'Marcar'} ${n} ${n === 1 ? 'visible' : 'visibles'}`;
 if (n === 1) return en ? (off ? 'Clear 1' : 'Select 1') : (off ? 'Desmarcar 1' : 'Marcar 1');
 return en ? `${off ? 'Clear' : 'Select'} all ${n}` : `${off ? 'Desmarcar' : 'Marcar'} los ${n}`;
}
