import assert from 'node:assert/strict';
import fs from 'node:fs';
import { phaseFromClip, progressView, realPercent } from '../assets/musica-progreso.mjs';

const src = fs.readFileSync(new URL('../assets/musica-progreso.mjs', import.meta.url), 'utf8');
assert.doesNotMatch(src, /suno/i);

assert.equal(realPercent(40), 40);
assert.equal(realPercent(140), null);
assert.equal(realPercent('40'), null);

assert.equal(phaseFromClip(null), 'cola');
assert.equal(phaseFromClip({ status: 'streaming' }), 'audio');
assert.equal(phaseFromClip({ status: 'complete', audio_url: 'https://cdn.example/a.mp3' }), 'listo');
assert.equal(phaseFromClip({ status: 'complete', audio_url: 'https://cdn.example/a.mp3', video_pending: true }), 'video');
assert.equal(phaseFromClip({ status: 'error' }), 'fallo');

const audio = progressView({ phase: 'audio', elapsedSec: 42, en: false });
assert.equal(audio.percent, null);
assert.match(audio.label, /Generando audio/);
assert.match(audio.time, /42s/);
assert.match(audio.time, /96s/);
assert.doesNotMatch(audio.time, /%/);

const letra = progressView({ phase: 'letra', elapsedSec: 5, en: false });
assert.match(letra.time, /sin media/);
assert.equal(letra.percent, null);

const video = progressView({ phase: 'video', elapsedSec: 8, percent: 40, en: false });
assert.equal(video.percent, 40);
assert.match(video.time, /13s/);

const fallo = progressView({ phase: 'fallo', elapsedSec: 3, error: 'timeout en suno.com', en: false });
assert.match(fallo.label, /Falló/);
assert.doesNotMatch(fallo.label, /suno/i);
assert.match(fallo.label, /motor/);

console.log('musica-progreso: fases reales, porcentaje solo si es un número, sin marca');
