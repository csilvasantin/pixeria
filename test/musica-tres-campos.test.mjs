import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { musicPublishPlan, musicTitle, musicPrompt, stockLinks, playerAudioUrl } from '../assets/musica-publicar.mjs';

function visible(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '');
}

for (const file of ['musica.html', 'en/musica.html']) {
  test(`${file} muestra estilo, voz y cliente y no dice Suno`, () => {
    const html = visible(fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8'));
    assert.match(html, /id="m-style"/);
    assert.match(html, /list="m-style-list"/);
    assert.match(html, /id="m-style-list"/);
    for (const style of ['blues', 'flamenco', 'samba', 'rap', 'techno', 'pop']) {
      assert.match(html, new RegExp(`value="${style}"`));
    }
    assert.match(html, /id="m-singer"/);
    assert.match(html, /value="voz masculina"/);
    assert.match(html, /value="voz femenina"/);
    assert.match(html, /value="dúo vocal \(hombre y mujer\)"/);
    assert.match(html, /value="coro"/);
    assert.match(html, /id="proj-cliente"/);
    assert.equal(/suno/i.test(html), false);
  });
}

test('el vídeo es la pieza principal y el mp3 va detrás', () => {
  const plan = musicPublishPlan({
    videoUrl: 'https://cdn.example/song.mp4',
    audioUrl: 'https://cdn.example/song.mp3',
  });
  assert.deepEqual(plan.map(p => p.role + ':' + p.type + ':' + p.mime), [
    'primary:video:video/mp4',
    'secondary:music:audio/mpeg',
  ]);
  assert.equal(playerAudioUrl({ videoUrl: 'https://cdn.example/song.mp4', audioUrl: 'https://cdn.example/song.mp3' }), 'https://cdn.example/song.mp4');
});

test('sin vídeo el audio queda como pieza principal', () => {
  const plan = musicPublishPlan({ audioUrl: 'https://cdn.example/song.mp3' });
  assert.equal(plan.length, 1);
  assert.equal(plan[0].role, 'primary');
  assert.equal(plan[0].type, 'music');
});

test('el título lleva el nombre del cliente y el enlace es el del stock', () => {
  assert.equal(musicTitle('blues', 'Aena', 'Medianoche'), 'Aena · Medianoche');
  assert.equal(musicPrompt('flamenco', 'voz femenina', 'duración aproximada 2 min'), 'voz femenina, flamenco, duración aproximada 2 min');
  const links = stockLinks('abc 1');
  assert.equal(links.page, 'https://www.pixeria.com/stock.html?highlight=abc%201');
  assert.equal(links.asset, 'https://api.admira.store/stock/asset/abc%201');
});
