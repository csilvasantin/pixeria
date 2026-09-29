// Los puntos de la ruta de Smith (la ruta los pide en la raíz del origen). Ver _demo-ruta.js.
import { proxyRuta } from '../../_demo-ruta.js';

export const onRequest = (context) => proxyRuta(context, '');
