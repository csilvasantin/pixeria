// Contrato de resolución para Experto y avatar. No ejecuta generación ni navegación.
const normalizar = value => String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function resolverDemo(texto, manifest, hostname) {
  const command = normalizar(texto);
  if (!/^\/demo(?:\s|$)/.test(command)) return {tipo: 'no_demo'};
  if (!manifest.activacion.hosts.includes(String(hostname).toLowerCase())) {
    return {tipo: 'otra_plataforma'};
  }
  const arg = command.slice(5).trim();
  const opciones = manifest.subdemos.map((demo, index) => ({
    numero: index + 1, id: demo.id, nombre: demo.nombre,
    comando: demo.cmd, alias: '/demo ' + demo.aliases[0]
  }));
  if (!arg || arg === 'help') return {tipo: 'ayuda', plataforma: manifest.plataforma, opciones};
  const demo = manifest.subdemos.find((item, index) => arg === String(index + 1) || item.aliases.some(alias => normalizar(alias) === arg));
  if (!demo) return {tipo: 'desconocido', mensaje: 'Demo desconocida. Escribe /demo help.', opciones};
  return {tipo: 'demo', plataforma: manifest.plataforma, clave: manifest.plataforma + '/' + demo.id, modo: manifest.default_mode, demo};
}
