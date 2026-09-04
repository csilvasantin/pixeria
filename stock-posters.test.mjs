import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// FLT pixeria stock (4-sep-2026): la rejilla pinta pósters, no vídeos; el índice manda al arrancar.
const stock = await readFile(new URL("./stock.html", import.meta.url), "utf8");

test("un vídeo con póster se pinta como <img>; sin póster, el <video> perezoso de respaldo", () => {
  assert.match(stock, /const poster = \/\^https\?:\\\/\\\/\/\.test\(String\(it\.thumbnail \|\| ''\)\) \? it\.thumbnail : '';/);
  assert.match(stock, /<img class="stock-cover stock-video-poster" data-orientation-media src="\$\{escAttr\(poster\)\}" alt="" loading="lazy"/);
  assert.match(stock, /<video class="stock-cover stock-video-preview" data-orientation-media data-src=/);
});

test("al arrancar solo se pide el índice; /stock/list queda de respaldo si falta o está rancio", () => {
  assert.match(stock, /indice = await fetchSource\(STOCK_INDEX_COMPRIMIDO, 12000\)\.catch\(\(\) => fetchSource\(STOCK_LIST_URL, 12000\)\);/);
  assert.match(stock, /if \(!indice \|\| !\(edadMin < 20\)\) \{/);
  assert.doesNotMatch(stock, /Promise\.all\(enCurso\)/);
  assert.match(stock, /items\.builtAt = data\.builtAt \|\| ''/);
});

test("el contador dice «reproducibles de» y cuenta los motores en vivo", () => {
  assert.match(stock, /el\.textContent = playable \+ ' reproducibles de ' \+ total;/);
  assert.match(stock, /<span id="stockMotores">…<\/span> motores\./);
  assert.doesNotMatch(stock, /desde los 4 motores/);
});
