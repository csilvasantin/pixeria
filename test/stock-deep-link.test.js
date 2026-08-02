const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');

for(const page of ['stock.html', 'en/stock.html']){
  test(`${page} abre el activo enlazado directamente en el visor`, () => {
    const html = readFileSync(join(__dirname, '..', page), 'utf8');
    const start = html.indexOf('function highlightFromQuery()');
    assert.notEqual(start, -1);
    const implementation = html.slice(start, start + 900);

    assert.match(implementation, /allItems\.find\(it => it && it\.id === safeId\)/);
    assert.match(implementation, /openLightbox\(item\)/);
    assert.doesNotMatch(implementation, /if \(!card\) return/);
  });
}
