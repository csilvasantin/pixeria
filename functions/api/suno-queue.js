/* /api/suno-queue — Fase 1 stub de cápsulas musicales Suno.
 *
 * POST { mode, version, prompt, ... } → encola un job en dry-run.
 * GET  ?id=… → estado del job (eco del body; sin persistencia durable aún).
 *
 * IMPORTANTE: por defecto execute=false. No se llama a Suno ni se gastan
 * créditos hasta que Carlos confirme un prompt de prueba y se active la
 * fase de agente (box browser → suno.com como csilva@admira.com → Stock).
 *
 * v.05.10.2026 · Huang · cápsulas Suno fase 1
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
      phase: 1,
      executeDefault: false,
      hint: 'POST a payload de cápsula; GET ?id=jobId para eco de estado (dry-run).',
    });
  }
  // Sin KV aún: el cliente guarda el job en localStorage y reconsulta por eco.
  return json(200, {
    ok: true,
    jobId: id,
    status: 'queued',
    execute: false,
    dryRun: true,
    message: 'Fase 1 · dry-run. Sin persistencia servidor; el cliente conserva el job localmente.',
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

  // Hard gate: never execute Suno in phase 1 even if client sends execute:true.
  const executeRequested = body.execute === true;
  const execute = false;
  const id = jobId();
  const now = new Date().toISOString();

  return json(202, {
    ok: true,
    jobId: id,
    status: 'queued',
    dryRun: true,
    execute,
    executeRequested,
    blockedReason: executeRequested
      ? 'Fase 1: execute forzado a false hasta confirmación de Carlos (no quemar créditos).'
      : null,
    createdAt: now,
    payload: {
      kind,
      mode,
      version,
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
      phase2: 'Agente box browser inicia sesión en suno.com, Create, poll, publica audio+imagen+video en Stock.',
      poll: `/api/suno-queue?id=${id}`,
    },
  });
}
