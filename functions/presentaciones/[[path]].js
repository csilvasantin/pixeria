// pixeria.com/presentaciones/* — las 4 APIs del compositor (ad-idea, grok-video,
// video-reference, video-package) y su pantalla de acceso. La verja de admiranext
// sigue intacta: sin cookie válida, 401. Ver _admiranext-proxy.js.
import { proxyToAdmiranext } from '../_admiranext-proxy.js';

export const onRequest = (context) => proxyToAdmiranext(context, (context.params.path || []).join('/'), 'presentaciones');
