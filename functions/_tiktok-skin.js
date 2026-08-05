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
export const SKIN_VERSION = '2026.08.05.r3';

export const SKIN_CSS = `/* Piel de Pixeria · pixeria.com/tiktok — functions/_tiktok-skin.js */

/* 1. PALETA. La de verdad: el segundo :root de assets/styles.css, el que
      gobierna la portada. La primera pasada uso el primero que aparecia —una
      paleta antigua de cianes y cremas— y por eso no se parecia en nada. */
:root{
  --bg:#020602;
  --bg-soft:rgba(2,16,6,.86);
  --panel:rgba(2,6,2,.84);
  --panel-2:rgba(2,16,6,.86);
  --ink:#c8ffd0;
  --muted:#7cbe84;
  --line:rgba(47,138,62,.58);
  --line-strong:rgba(0,255,65,.62);
  --cyan:#00ff41;
  --green:#00ff41;
  --matrix:#00ff41;
  --matrix-deep:#00b82e;
  --orange:#d4ff5a;
  --pink:#7dff9e;
  --purple:#d4ff5a;
  --dark-cyan:#031205;
  --glow:0 0 7px currentColor;
}

/* 2. TIPOGRAFIA. Pixeria es monoespaciada de arriba abajo; el compositor traia
      Inter para todo lo que no fuera un rotulo. Se iguala, incluidos los
      controles, que por defecto no heredan la fuente del documento. */
.pixeria-skin, .pixeria-skin body,
.pixeria-skin input, .pixeria-skin textarea,
.pixeria-skin select, .pixeria-skin button{
  font-family:"JetBrains Mono","IBM Plex Mono","Fira Code",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
}
.pixeria-skin body{background:var(--bg);color:var(--ink);line-height:1.55;overflow-x:hidden}

/* 3. CUADRATURA. Esquinas RECTAS y marcos planos: es el rasgo que da nombre a
      la interfaz del sitio (assets/cuadratura.css). El compositor venia todo
      redondeado, y eso es lo que mas lo delataba como ajeno. */
.pixeria-skin *,
.pixeria-skin *::before,
.pixeria-skin *::after{border-radius:0 !important}

/* 4. SUPERFICIES. Paneles translucidos sobre el fondo, con linea verde. */
.pixeria-skin .card,.pixeria-skin .panel,.pixeria-skin fieldset,
.pixeria-skin .idea-generator,.pixeria-skin .package-output,
.pixeria-skin .reference-profile,.pixeria-skin .story-card,
.pixeria-skin .meta-studio,.pixeria-skin .grok-studio{
  background:var(--panel);
  border-color:var(--line);
}
.pixeria-skin input,.pixeria-skin textarea,.pixeria-skin select{
  background:rgba(2,16,6,.7);
  border-color:var(--line);
  color:var(--ink);
}

/* 5. RESPLANDOR. En Pixeria el acento no es plano: brilla. */
.pixeria-skin .kicker,.pixeria-skin .section-code,
.pixeria-skin .brand span,.pixeria-skin .st.live,
.pixeria-skin h1 em,.pixeria-skin .accent{ text-shadow:var(--glow) }
.pixeria-skin .button.primary,.pixeria-skin .idea-generator{
  border-color:var(--matrix);
  color:var(--matrix);
  background:rgba(0,255,65,.06);
  text-shadow:var(--glow);
}
.pixeria-skin .button.primary:hover,.pixeria-skin .idea-generator:hover{
  background:rgba(0,255,65,.14);
}

/* 6. FONDO. Los mismos halos y las mismas lineas de barrido de la portada, sin
      la lluvia matrix: ahi el visitante viene a trabajar, no a mirar. */
.pixeria-skin body::before{
  content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;
  background:
    radial-gradient(circle at 14% 8%, rgba(0,255,65,.10), transparent 28%),
    radial-gradient(circle at 86% 6%, rgba(0,255,65,.08), transparent 32%),
    linear-gradient(180deg, rgba(2,6,2,.30), rgba(2,6,2,.46) 48%, rgba(2,6,2,.34));
}
.pixeria-skin body::after{
  content:"";position:fixed;inset:0;z-index:200;pointer-events:none;
  background:repeating-linear-gradient(180deg,
    rgba(0,255,65,.035) 0, rgba(0,255,65,.035) 1px, transparent 1px, transparent 3px);
}

/* 7. FOCO. Verde, visible y cuadrado, como el resto del sitio. */
.pixeria-skin :focus-visible{outline:2px solid var(--matrix);outline-offset:2px}
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
