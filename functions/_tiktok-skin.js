/**
 * Piel de Pixeria para el compositor de TikTok (FLT-1202, Carlos 5-ago-2026).
 * ==========================================================================
 * El compositor no es nuestro: vive en admiranext.com y aquí sólo se reenvía
 * (ver _admiranext-proxy.js). Copiarlo para repintarlo habría dejado dos bases
 * de código que se separan solas — el error que ya evitó el proxy.
 *
 * Así que no se toca el original: se le pone una piel que SÓLO se sirve por la
 * puerta de Pixeria. admiranext.com/tiktok sigue exactamente igual.
 *
 * Y no repinta a mano cada componente: el compositor está hecho con variables
 * CSS, así que basta con redefinir esas variables con los tokens reales de
 * Pixeria (assets/styles.css). Lo que el compositor cambie mañana seguirá
 * saliendo vestido de Pixeria sin tocar nada aquí.
 *
 * Correspondencia (izquierda compositor · derecha Pixeria):
 *   --bg      #05090d → #0b1117      --ink    #eef8fa → #f4f0e8
 *   --panel   #08131c → #111a20      --muted  #8da3ad → #aeb9bd
 *   --cyan    #65e9f4 → #68dce9      --green  #3df08a → #6bd6a6
 *   --orange  #ff7a30 → #ff6b5c (coral)
 * El rosa y el morado del compositor no existen en Pixeria: se llevan a coral y
 * oro, que son los acentos que sí usa el sitio, en vez de inventar dos colores.
 */
export const SKIN_PATH = '_skin.css';
// Sello propio de la piel. El _headers de Pixeria le impone 4 h de cache y la
// hoja no tiene version en el nombre: sin esto, un retoque tardaba 4 horas en
// verse (paso al repintar el morado). Se sube A MANO al tocar SKIN_CSS.
export const SKIN_VERSION = '2026.08.05.r2';

export const SKIN_CSS = `/* Piel de Pixeria · pixeria.com/tiktok — generada por functions/_tiktok-skin.js */
:root{
  --bg:#0b1117;
  --panel:#111a20;
  --panel-2:#16222a;
  --ink:#f4f0e8;
  --muted:#aeb9bd;
  --line:rgba(244,240,232,.16);
  --line-strong:rgba(244,240,232,.32);
  --cyan:#68dce9;
  --green:#6bd6a6;
  --orange:#ff6b5c;
  --pink:#ff6b5c;
  --purple:#f1c96a;
  --dark-cyan:#0e1a20;
}
/* El sitio es de esquinas suaves; el compositor venía de esquinas duras. */
.pixeria-skin .card,
.pixeria-skin .panel,
.pixeria-skin section > div,
.pixeria-skin .story-card{border-radius:12px}
.pixeria-skin .button,
.pixeria-skin button{border-radius:10px}
/* Los focos del sitio son coral sobre fondo oscuro; se respeta para que el
   recorrido con teclado se vea igual dentro y fuera del compositor. */
.pixeria-skin :focus-visible{outline:2px solid #ff6b5c;outline-offset:2px}

/* El morado del compositor esta ESCRITO A FUEGO en unos cuantos sitios
   —rgba(189,134,255,…)— donde la variable no llega. Se repintan uno a uno con
   el oro de Pixeria; son los que se ven, no una lista a ciegas. */
.pixeria-skin .idea-generator{border-color:rgba(241,201,106,.5);background:rgba(241,201,106,.05)}
.pixeria-skin .idea-generator:hover{background:rgba(241,201,106,.12)}
.pixeria-skin .package-timeline .is-roll{border-color:rgba(241,201,106,.44)}
.pixeria-skin .reference-profile{border-left-color:#f1c96a;background:rgba(241,201,106,.06);color:#e6dcc4}
.pixeria-skin .package-output{border-color:rgba(241,201,106,.45);background:rgba(241,201,106,.05)}
`;

export function skinResponse() {
  return new Response(SKIN_CSS, {
    status: 200,
    headers: {
      'content-type': 'text/css; charset=utf-8',
      // Corta, no inmutable: la piel se retoca a mano y no lleva sello propio.
      'cache-control': 'public, max-age=300, must-revalidate',
      'x-content-type-options': 'nosniff',
    },
  });
}

/**
 * La MARCA de la puerta. Quien entra por pixeria.com/tiktok esta en Pixeria, y
 * la cabecera le decia "ADmiraNeXT". No es un cambio de producto: es la misma
 * herramienta entrando por otra puerta, que es justo lo que ya hace la URL.
 *
 * Se cambian SOLO los rotulos de la cabecera y el titulo, por coincidencia
 * exacta. Nada de un reemplazo global de "ADmiraNeXT": el cuerpo habla de
 * Pixeria y de AdmiraNeXT a proposito en varios sitios, y arrasarlo mentiria.
 * El enlace de la marca pasa a la home de Pixeria, que es donde el visitante
 * espera volver.
 */
function marcaDeLaPuerta(html) {
  return html
    .replace('<span>ADmiraNeXT · TikTok</span>', '<span>Pixeria · TikTok</span>')
    .replace('aria-label="Volver a ADmiraNeXT"', 'aria-label="Volver a Pixeria"')
    .replace('aria-label="Herramientas ADmiraNeXT"', 'aria-label="Herramientas de Pixeria"')
    .replace('<title>TikTok Ads 25s · ADmiraNeXT</title>', '<title>TikTok Ads 25s · Pixeria</title>');
}

/** Cuelga la piel al final del <head> y marca el documento. */
export function injectSkin(html) {
  const enlace = `<link rel="stylesheet" href="/tiktok/${SKIN_PATH}?v=${SKIN_VERSION}">`;
  let out = marcaDeLaPuerta(html);
  // La clase va en <html> para poder vestir también lo que cuelgue del body.
  out = out.replace(/<html\b([^>]*)>/i, (m, attrs) =>
    /class=/i.test(attrs)
      ? `<html${attrs.replace(/class=(["'])(.*?)\1/i, (mm, q, v) => `class=${q}${v} pixeria-skin${q}`)}>`
      : `<html${attrs} class="pixeria-skin">`);
  // Al final del head: gana a las hojas del compositor sin usar !important.
  return /<\/head>/i.test(out) ? out.replace(/<\/head>/i, `${enlace}\n</head>`) : enlace + out;
}
