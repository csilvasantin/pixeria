// node --test test/stock-subir-py.test.mjs — lanza las pruebas de scripts/stock-subir.py
// (test/stock-subir.test.py, Worker falso en 127.0.0.1) dentro de la batería de node.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const python = spawnSync('python3', ['--version']);
test('scripts/stock-subir.py: base64 hasta 8 MB, por partes por encima (streaming, reintentos, abort)', {skip: python.status !== 0 && 'sin python3'}, () => {
  const r = spawnSync('python3', ['-I', fileURLToPath(new URL('./stock-subir.test.py', import.meta.url))], {encoding: 'utf8', timeout: 120000});
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stderr, /OK/);
});
