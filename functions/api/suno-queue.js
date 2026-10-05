/* /api/suno-queue — Cápsulas musicales Suno.
 *
 * POST { mode, version, prompt, languages[], execute, ... } → encola job.
 * GET  ?id=… → eco de estado (cliente guarda el job en localStorage).
 *
 * execute=true permitido (Carlos confirmó demo bilingüe ESP+ENG). El cliente
 * dispara suno-local /generate tras el 202; este endpoint no llama a Suno
 * directamente (sin secretos en el Worker).
 *
 * v.05.10.2026 · Huang · cápsulas Suno + idiomas + execute
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
  });
}

function jobId() {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `suno-${t}-${r}`;
}

function normalizeLanguages(raw) {
  const allowed = new Set(['ESP', 'ENG']);
  const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  const out = [];
  for (const x of list) {
    const u = String(x || '').trim().toUpperCase();
    if (allowed.has(u) && !out.includes(u)) out.push(u);
  }
  return out.length ? out : ['ESP'];
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const id = (url.searchParams.get('id') || '').trim();
  if (!id) {
    return json(200, {
      ok: true,
      service: 'suno-queue',
      phase: 2,
      executeDefault: true,
      languages: ['ESP', 'ENG'],
      hint: 'POST cápsula con languages[] + execute; cliente llama suno-local /generate.',
    });
  }
  return json(200, {
    ok: true,
    jobId: id,
    status: 'queued',
    execute: true,
    dryRun: false,
    message: 'Sin persistencia servidor; el cliente conserva el job y hace poll a suno-local /status.',
  });
}

export async function onRequestPost(context) {
  let body;
  try {
    body = await context.request.json();
  } catch {
    return json(400, { ok: false, error: 'json_invalido' });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json(400, { ok: false, error: 'payload_invalido' });
  }

  const kind = String(body.kind || 'songs').toLowerCase();
  if (!['songs', 'speech', 'sounds'].includes(kind)) {
    return json(400, { ok: false, error: 'kind_invalido', hint: 'songs|speech|sounds' });
  }
  const mode = String(body.mode || 'simple').toLowerCase();
  if (!['simple', 'advanced'].includes(mode)) {
    return json(400, { ok: false, error: 'mode_invalido' });
  }
  const version = String(body.version || 'v6').slice(0, 16);
  const prompt = String(body.prompt || '').trim();
  if (!prompt || prompt.length > 4000) {
    return json(400, { ok: false, error: 'prompt_requerido', hint: '1–4000 caracteres' });
  }
  const languages = normalizeLanguages(body.languages);
  // Carlos confirmó: execute real desde el panel studio.
  const execute = body.execute !== false;
  const dryRun = !execute;
  const id = jobId();
  const now = new Date().toISOString();

  return json(202, {
    ok: true,
    jobId: id,
    status: execute ? 'executing' : 'queued',
    dryRun,
    execute,
    createdAt: now,
    payload: {
      kind,
      mode,
      version,
      languages,
      prompt: prompt.slice(0, 4000),
      title: String(body.title || '').slice(0, 200) || null,
      attachments: {
        audio: Boolean(body.audio),
        voice: Boolean(body.voice),
        image: Boolean(body.image),
      },
      accountHint: 'csilva@admira.com',
      destination: 'stock',
    },
    next: {
      generate: 'Cliente → suno-local /generate (Mac Mini) con prompt + languages.',
      poll: `/api/suno-queue?id=${id}`,
      stock: 'Tras clips listos → Stock (audio + imagen + video si hay).',
    },
  });
}
