/** Ficha ITIL de una unidad de la Cafebrería. Lo que no consta queda en «pendiente». */
export const SCHEMA = 'admira.xpacio.ci/1';
export const PENDIENTE = 'pendiente';

const CATEGORIA = {
  Mobiliario: 'mobiliario',
  Pantallas: 'pantallas',
  Equipamiento: 'equipamiento',
  Iluminacion: 'iluminacion',
  Vegetacion: 'plantas',
  IoT: 'iot',
  Arquitectura: 'arquitectura',
};
const ESTADOS = new Set(['operativo', 'averia', 'mantenimiento', 'baja', 'pendiente']);

export function urlUnidad(unidad) {
  return 'https://www.pixeria.com/xpacios/cafebreria/ci/?u=' + encodeURIComponent(unidad);
}

function texto(value) {
  const s = String(value ?? '').trim();
  return s || PENDIENTE;
}

export function fichaDe(row) {
  const unidad = String(row?.id || '');
  const categoria = CATEGORIA[row?.categoria] || PENDIENTE;
  const estado = ESTADOS.has(row?.estado) ? row.estado : PENDIENTE;
  const relaciones = [];
  if (row?.runtime?.junto) relaciones.push({ tipo: 'junto-a', id: String(row.runtime.junto) });
  return {
    schema: SCHEMA,
    id: 'alsea:' + unidad,
    unidad,
    nombre: texto(row?.nombre),
    categoria,
    fabricante: texto(row?.fabricante),
    modelo: texto(row?.modelo),
    serie: texto(row?.serie),
    compra: {
      fecha: texto(row?.compraFecha),
      proveedor: texto(row?.compraProveedor),
      factura: texto(row?.factura),
    },
    garantia: {
      inicio: texto(row?.garantiaInicio),
      fin: texto(row?.garantiaFin || row?.garantia),
    },
    estado,
    ubicacion: texto(row?.runtime?.ubicacion || row?.ubicacion),
    responsable: texto(row?.responsable),
    red: categoria === 'iot' ? { ip: texto(row?.ip), mac: texto(row?.mac), firmware: texto(row?.firmware) } : null,
    relaciones,
    incidencias: Array.isArray(row?.incidencias) ? row.incidencias : [],
    orientacion: row?.orientacion || null,
    sinGeometria: !!row?.sinGeometria,
    modelo3d: row?.modelo3d || null,
  };
}

/** En garantía manda el fabricante; si no, el portal del equipo conectado; si no, una incidencia. */
export function accion(ficha, ahora = Date.now()) {
  const base = urlUnidad(ficha.unidad);
  const fin = Date.parse(ficha.garantia?.fin);
  if (Number.isFinite(fin) && fin > ahora) {
    return { tipo: 'garantia', etiqueta: 'Reclamar al fabricante', provisional: true, href: base + '&accion=garantia' };
  }
  if (ficha.red) {
    return { tipo: 'iot', etiqueta: 'Portal IoT', provisional: true, href: base + '&accion=portal-iot' };
  }
  return {
    tipo: 'incidencia',
    etiqueta: 'Incidencia en Yokup',
    provisional: true,
    href: 'https://www.yokup.com/incidencias?origen=pixeria&u=' + encodeURIComponent(ficha.unidad),
  };
}

export function semaforoEstado(estado) {
  return { operativo: 'verde', averia: 'rojo', mantenimiento: 'ambar', baja: 'apagado', pendiente: 'ambar' }[estado] || 'ambar';
}

export function semaforoGarantia(ficha, ahora = Date.now()) {
  const fin = Date.parse(ficha.garantia?.fin);
  if (!Number.isFinite(fin)) return 'ambar';
  return fin > ahora ? 'verde' : 'rojo';
}
