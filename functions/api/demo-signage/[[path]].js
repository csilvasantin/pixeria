// Puente de la pantalla de sala de la demo (en previews *.pages.dev la ruta lo pide aquí). Ver _demo-ruta.js.
import { proxyRuta } from '../../_demo-ruta.js';

export const onRequest = (context) => proxyRuta(context, '');
