import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolverDemo} from '../demo/studio-comandos.mjs';
const manifest = JSON.parse(await readFile(new URL('../demo/studio.subdemos.json', import.meta.url)));
const hosts = ['admira.studio', 'www.admira.studio', 'pixeria.com', 'www.pixeria.com'];
for (const host of hosts) {
  for (const [index, demo] of manifest.subdemos.entries()) {
    for (const command of [demo.cmd, ...demo.aliases.map(alias => '/demo ' + alias)]) {
      const result = resolverDemo(command, manifest, host);
      assert.equal(result.clave, 'studio/' + demo.id);
      assert.equal(result.modo, 'muestra');
      assert.equal(result.demo, demo);
    }
    assert.equal(resolverDemo('/demo ' + (index + 1), manifest, host).demo, demo);
  }
  for (const text of ['/demo help', ' /DEMO HELP ', '/demo']) {
    const help = resolverDemo(text, manifest, host);
    assert.equal(help.tipo, 'ayuda');
    assert.deepEqual(help.opciones.map(o => o.id), ['voz', 'musica', 'imagen', 'video', 'adaptar']);
  }
  for (const [text, id] of [[' /DEMO LOCUCIÓN ', 'voz'], ['/demo MÚSICA', 'musica'], ['/demo VÍDEO', 'video']]) {
    assert.equal(resolverDemo(text, manifest, host).demo.id, id);
  }
  for (const text of ['/demo 0', '/demo 6', '/demo 01', '/demo 1 extra', '/demo anonymizer', '/demo toString']) {
    assert.equal(resolverDemo(text, manifest, host).tipo, 'desconocido');
  }
}
assert.equal(resolverDemo('/demo help', manifest, 'www.admira.tv').tipo, 'otra_plataforma');
assert.equal(resolverDemo('/demo 1', manifest, 'pixeria.com.ejemplo.com').tipo, 'otra_plataforma');
assert.equal(resolverDemo('/demografia', manifest, hosts[0]).tipo, 'no_demo');
assert.equal(resolverDemo('hola', manifest, hosts[0]).tipo, 'no_demo');
console.log('OK: números, aliases, tildes, ayuda de Studio, límites y aislamiento de plataforma.');
