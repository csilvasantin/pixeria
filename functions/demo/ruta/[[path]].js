// pixeria.com/demo/ruta/* → ruta /distribucion de Smith, con el motor /demo inyectado. Ver _demo-ruta.js.
import { proxyRuta } from '../../_demo-ruta.js';

export const onRequest = (context) => proxyRuta(context, '/demo/ruta');
