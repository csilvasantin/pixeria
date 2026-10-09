const ENDPOINT = 'https://mcp-pixeria.admira.store/';
const NAME = /^[a-z][a-z0-9_]{0,79}$/;
const GROUPS = {
  library: 'Biblioteca y voces / Library and voices',
  plans: 'Planes y contratos / Plans and contracts',
  samples: 'Muestras preparadas / Prepared samples',
  generation: 'Análisis y creación / Analysis and creation',
  archive: 'Resultados y archivo / Results and archiving',
  visitors: 'Visitante de ensayo / Trial visitor',
  other: 'Otras herramientas anunciadas / Other announced tools',
};
const MODES = {read:'Consulta / Query',query_archive:'Consulta y puede archivar / Query may archive',plan:'Sólo plan / Plan only',sample:'Muestra existente / Existing sample',generate_sync:'Generación síncrona / Synchronous generation',generate_async:'Trabajo asíncrono / Asynchronous job',save:'Guarda en Stock / Saves to Stock',mixed:'Depende de la acción / Depends on action'};
const AUTH = {public:'Sin clave de flota / No fleet key',fleet:'Clave de flota existente / Existing fleet key',mixed:'info/status públicos; send con clave / Public info/status; authenticated send'};
const COST = {none:'Sin generación de pago / No paid generation',provider:'Puede gastar crédito del proveedor / May use provider credit',mixed:'free sin crédito; ElevenLabs puede gastar / free uses no credit; ElevenLabs may use credit'};

export function seleccionarCatalogo(live, fallback) {
  const entries = Array.isArray(fallback?.tools) ? fallback.tools.slice(0,100) : [];
  const known = new Map(entries.filter(t => typeof t?.name === 'string' && NAME.test(t.name)).map(t => [t.name,t]));
  const valid = live?.ok !== false && Array.isArray(live?.tools) && live.tools.length > 0 && live.tools.length <= 100 && live.tools.every(n => typeof n === 'string' && NAME.test(n));
  const names = valid ? [...new Set(live.tools)] : [...known.keys()];
  return {
    source: valid ? 'live' : 'fallback',
    updatedAt: fallback?.verifiedAt,
    server: valid && typeof live.server?.version === 'string' ? live.server.version.slice(0,100) : fallback?.serverVersion,
    tools: names.map(name => known.get(name) || {name,category:'other',description:{es:'Anunciada por el servidor. Consulta su esquema MCP antes de usarla; efectos, autenticación y coste sin clasificar aquí.',en:'Announced by the server. Read its MCP schema before use; effects, authentication and cost are not classified here.'}}),
  };
}

function text(doc, tag, value, className) {
  const node = doc.createElement(tag);
  node.textContent = value;
  if (className) node.className = className;
  return node;
}

export function pintarCatalogo(container, catalogue) {
  const doc = container.ownerDocument;
  container.replaceChildren();
  for (const [group,label] of Object.entries(GROUPS)) {
    const tools = catalogue.tools.filter(t => (Object.hasOwn(GROUPS,t.category) ? t.category : 'other') === group);
    if (!tools.length) continue;
    const section = doc.createElement('section');
    section.className = 'catalog-group';
    section.append(text(doc,'h3',label));
    const list = doc.createElement('ul');
    list.className = 'catalog-tools';
    for (const tool of tools) {
      const item = doc.createElement('li');
      item.append(text(doc,'code',tool.name));
      for (const lang of ['es','en']) {
        const description = text(doc,'p',tool.description?.[lang] || '', 'catalog-description');
        description.lang = lang;
        item.append(description);
      }
      const labels = [MODES[tool.mode],AUTH[tool.auth],COST[tool.cost]].filter(Boolean);
      if (labels.length) item.append(text(doc,'p',labels.join(' · '),'catalog-effects'));
      list.append(item);
    }
    section.append(list);
    container.append(section);
  }
}

export async function cargarCatalogo({fetchImpl=fetch, timeout=8000}={}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(),timeout);
  try {
    const fallbackResponse = await fetchImpl(new URL('./catalogo.json',import.meta.url),{cache:'no-store',signal:controller.signal});
    if (!fallbackResponse.ok) throw Error('catalogue-unavailable');
    const fallback = await fallbackResponse.json();
    try {
      const response = await fetchImpl(ENDPOINT,{method:'GET',credentials:'omit',cache:'no-store',signal:controller.signal});
      if (!response.ok) throw Error('catalogue-offline');
      return seleccionarCatalogo(await response.json(),fallback);
    } catch (_) {
      return seleccionarCatalogo(null,fallback);
    }
  } finally { clearTimeout(timer); }
}

export async function iniciarCatalogo(doc=document) {
  const container = doc.getElementById('mcp-catalogue');
  const status = doc.getElementById('catalogue-status');
  if (!container || !status) return;
  try {
    const catalogue = await cargarCatalogo();
    pintarCatalogo(container,catalogue);
    status.textContent = catalogue.source === 'live'
      ? `${catalogue.tools.length} herramientas anunciadas ahora / tools currently announced · ${catalogue.server || ''}`
      : `Catálogo de respaldo: ${catalogue.tools.length} herramientas verificadas el ${catalogue.updatedAt || '—'}. Servidor no verificado ahora. / Fallback catalogue; server not currently verified.`;
    status.dataset.source = catalogue.source;
    const dot = doc.getElementById('dot');
    if (dot) dot.className = 'dot ' + (catalogue.source === 'live' ? 'up' : 'down');
  } catch (_) {
    status.textContent = 'No se pudo cargar el catálogo. Consulta el esquema tools/list con tu cliente MCP. / Catalogue unavailable. Read tools/list with your MCP client.';
    status.dataset.source = 'unavailable';
  }
}
