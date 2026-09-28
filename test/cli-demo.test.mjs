import assert from 'node:assert/strict';
import fs from 'node:fs';

const cli = fs.readFileSync(new URL('../assets/expert-cli.js', import.meta.url), 'utf8');
const doc = fs.readFileSync(new URL('../docs/expert-cli.md', import.meta.url), 'utf8');
assert.match(cli, /case 'demo':/);
assert.match(cli, /name\.charAt\(0\) === '\/'/);
assert.match(cli, /demo · \/demo — dos locuciones/);
assert.match(cli, /demo · \/demo — two voice lines/);
assert.match(cli, /tts\/free/);
assert.match(cli, /type: 'video'/);
assert.match(cli, /Pixeria demo abre la puerta/);
assert.match(cli, /Pixeria demo opens the door/);
assert.doesNotMatch(cli, /suno/i);
assert.doesNotMatch(doc, /suno/i);
assert.match(doc, /`demo`/);
console.log('cli-demo: help ES/EN, voz de Audio, vídeo de canción, sin la palabra prohibida');
