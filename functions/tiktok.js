// pixeria.com/tiktok exacto (sin barra). Cloudflare Pages NO lo cubre con
// functions/tiktok/[[path]].js — esa ruta es /tiktok/* — y `wrangler pages dev`
// sí lo servía, que fue justo lo que lo escondió hasta producción.
import { proxyToAdmiranext } from './_admiranext-proxy.js';

export const onRequest = (context) => proxyToAdmiranext(context, '', 'tiktok');
