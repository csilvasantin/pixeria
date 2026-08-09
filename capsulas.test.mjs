import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const home = await readFile(new URL("./index.html", import.meta.url), "utf8");
const stock = await readFile(new URL("./stock.html", import.meta.url), "utf8");

test("Pixeria presenta Cápsulas como formato de conocimiento", () => {
  assert.match(home, /<h3>Cápsulas<\/h3>/);
  assert.match(home, /fuente verificable/);
  assert.match(stock, /<option value="capsula">Cápsulas<\/option>/);
  assert.doesNotMatch(stock, />Guiones<\/option>/);
});

test("el Stock pinta cápsulas nuevas y guiones históricos bajo el mismo nombre", () => {
  assert.match(stock, /function isCapsule\(it\)/);
  assert.match(stock, /it\.type === 'capsula' \|\| it\.type === 'guion'/);
  assert.match(stock, /capsula: 'Cápsula', guion: 'Cápsula'/);
  assert.match(stock, /class="stock-capsula"/);
});

test("el detalle de una cápsula permite valorar de una a cinco estrellas", () => {
  assert.match(stock, /function renderRatingHtml\(it\)/);
  assert.match(stock, /data-act="rate-capsule"/);
  assert.match(stock, /\/rating`/);
  assert.match(stock, /ratingVoterId\(\)/);
  assert.match(stock, /rememberRating\(it\.id, value\)/);
});
