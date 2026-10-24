import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

for (const path of ['stock.html', 'en/stock.html']) {
  test(`${path}: cabezal completo de ordenación multimedia`, () => {
    const html = readFileSync(new URL('../' + path, import.meta.url), 'utf8');
    assert.equal((html.match(/id="stockSortBar"/g) || []).length, 1);
    for (const key of ['name', 'date', 'format', 'type', 'motor']) {
      assert.match(html, new RegExp(`class="stock-sort-th" data-key="${key}"`));
      assert.match(html, new RegExp(`'${key}-asc'`));
      assert.match(html, new RegExp(`'${key}-desc'`));
    }
    assert.match(html, /'format-asc':\s*\(a, b\)/);
    assert.match(html, /'format-desc':\s*\(a, b\)/);
  });
}

test('el cabezal ocupa la franja y se adapta a móvil', () => {
  const css = readFileSync(new URL('../workspace.css', import.meta.url), 'utf8');
  assert.match(css, /\.stock-order-head\s*\{[^}]*display:\s*grid;/s);
  assert.match(css, /\.stock-order-head\s*\{[^}]*grid-template-columns:/s);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*\.stock-order-head/);
});
