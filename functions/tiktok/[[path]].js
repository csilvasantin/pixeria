// pixeria.com/tiktok/* — el compositor y sus estáticos (ver _admiranext-proxy.js).
import { proxyToAdmiranext } from '../_admiranext-proxy.js';

export const onRequest = (context) => proxyToAdmiranext(context, (context.params.path || []).join('/'), 'tiktok');
