// Contrato de publicación de cápsulas Blinkist → Stock (type: capsula).
// Cafebrería las lee con selectBooks (tag blinkist o URL blinkist.com en prompt).
// Este módulo NO llama a la red: solo construye el payload del publish.

export const CONSEJEROS = [
  { id: 'stevejobs', label: 'Steve Jobs', motor: 'Jobs · Grok' },
  { id: 'stevewozniak', label: 'Steve Wozniak', motor: 'Wozniak · Grok' },
  { id: 'waltdisney', label: 'Walt Disney', motor: 'Disney · Grok' },
  { id: 'georgelucas', label: 'George Lucas', motor: 'Lucas · Grok' },
  { id: 'howardschultz', label: 'Howard Schultz', motor: 'Schultz · Grok' },
  { id: 'warrenbuffett', label: 'Warren Buffett', motor: 'Buffett · Grok' },
  { id: 'timcook', label: 'Tim Cook', motor: 'Cook · Grok' },
  { id: 'dieterrams', label: 'Dieter Rams', motor: 'Rams · Grok' },
  { id: 'elonmusk', label: 'Elon Musk', motor: 'Musk · Grok' },
];

export const TEMAS = [
  { id: 'business', label: 'Business' },
  { id: 'tech', label: 'Tech' },
  { id: 'creativity', label: 'Creativity' },
];

/** Extrae slug Blinkist de URLs /en/books/, /es/app/books/, /books/… */
export function blinkistSlug(url) {
  const m = String(url || '').match(/blinkist\.com\/(?:[a-z]{2}\/)?(?:app\/)?books\/([a-z0-9-]+)/i);
  return m ? m[1].toLowerCase() : '';
}

/** Canoniza a https://www.blinkist.com/en/books/<slug> cuando hay slug. */
export function blinkistCanonical(url) {
  const slug = blinkistSlug(url);
  return slug ? `https://www.blinkist.com/en/books/${slug}` : String(url || '').trim();
}

function clean(s) {
  return String(s == null ? '' : s).replace(/\r\n/g, '\n').trim();
}

function autoSilicio(tesis) {
  const t = clean(tesis) || 'esta tesis';
  return `Opera con 3 criterios verificables derivados de «${t}». Descarta lo que no se pueda medir en el siguiente brief o pieza Admira.`;
}

function autoAplicacion(tesis) {
  const t = clean(tesis) || 'esta tesis';
  return `En 48 h, haz un experimento de ≤30 min a partir de «${t}» y anota qué cambió.`;
}

/**
 * Construye comment + tags + motor para POST /stock/publish type:capsula.
 * Entrada: { url?, libro?, autor?, tesis, consejeroId, tema, carbono, silicio?, aplicacion? }
 * El worker sólo admite 4 tags de contenido; quality:good se añade aparte.
 */
export function buildCapsulaPayload(raw) {
  const urlIn = clean(raw.url);
  const libro = clean(raw.libro);
  const autor = clean(raw.autor);
  const tesis = clean(raw.tesis);
  const consejeroId = clean(raw.consejeroId).toLowerCase();
  const tema = clean(raw.tema).toLowerCase();
  const carbono = clean(raw.carbono);
  let silicio = clean(raw.silicio);
  let aplicacion = clean(raw.aplicacion);

  const consejero = CONSEJEROS.find((c) => c.id === consejeroId);
  const temaOk = TEMAS.some((t) => t.id === tema);

  const errors = [];
  if (!tesis) errors.push('falta la tesis / título de la cápsula');
  if (!consejero) errors.push('elige un consejero');
  if (!temaOk) errors.push('elige tema: business, tech o creativity');
  if (!carbono) errors.push('escribe PARA CARBONO');
  if (!urlIn && (!libro || !autor)) errors.push('pega una URL Blinkist o indica título + autor del libro');
  if (urlIn && !blinkistSlug(urlIn) && !/blinkist\.com/i.test(urlIn)) {
    errors.push('la URL no parece de Blinkist');
  }
  if (errors.length) return { ok: false, errors };

  if (!silicio) silicio = autoSilicio(tesis);
  if (!aplicacion) aplicacion = autoAplicacion(tesis);

  const libroFinal = libro || (tesis.includes(':') ? tesis.split(':')[0].trim() : tesis);
  const autorFinal = autor || 'Autor desconocido';
  const fuente = `Fuente: ${libroFinal}, de ${autorFinal} (resumen Blinkist; síntesis original AdmiraNeXT).`;

  const comment = [
    'PARA CARBONO',
    carbono,
    '',
    'PARA SILICIO',
    silicio,
    '',
    'APLICACIÓN',
    aplicacion,
    '',
    fuente,
  ].join('\n');

  // Worker slice(0,4) en tags de entrada; quality se añade en el servidor.
  const tags = ['formacion', consejero.id, tema, 'blinkist'];
  const prompt = urlIn ? blinkistCanonical(urlIn) : `blinkist:manual:${(blinkistSlug(urlIn) || libroFinal).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || 'sin-slug'}`;

  return {
    ok: true,
    payload: {
      type: 'capsula',
      motor: consejero.motor,
      prompt,
      title: tesis,
      comment,
      tags,
      quality: 'good',
      costEst: 'texto',
      // Sin url/base64: el worker convierte comment → text/plain.
      // skipVideo: pista para un futuro flag en pixer-worker; hoy el puente
      // capsule-tiktok sigue disparándose si hay ADMIRANEXT_INGEST_TOKEN.
      skipVideo: true,
    },
  };
}
