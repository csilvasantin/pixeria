(function () {
  var root = document.getElementById('clip-desde-imagen');
  if (!root) return;
  var status = document.getElementById('clip-status');
  var out = document.getElementById('clip-out');
  function say(text) { if (status) status.textContent = text; }

  async function headers() {
    var h = { 'Content-Type': 'application/json' };
    var r = await fetch('/auth/api-token', { credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('hace falta la sesión de Pixeria');
    var data = await r.json();
    if (!data.token) throw new Error('sesión sin token');
    h.Authorization = 'Bearer ' + data.token;
    return h;
  }

  function fileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      if (!file) return resolve('');
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = function () { reject(new Error('no se pudo leer la imagen')); };
      reader.readAsDataURL(file);
    });
  }

  async function startOne(h, prompt, image, stockId) {
    var body = { prompt: prompt, duration: 5, aspect_ratio: '16:9', resolution: '720p' };
    if (image) body.image = image;
    else body.stock_id = stockId;
    var r = await fetch('https://api.admira.store/xai/video', { method: 'POST', headers: h, body: JSON.stringify(body) });
    var data = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error((data && data.error) || ('HTTP ' + r.status));
    return data.request_id;
  }

  async function waitStock(h, requestId) {
    for (var i = 0; i < 60; i++) {
      await new Promise(function (resolve) { setTimeout(resolve, 5000); });
      var r = await fetch('https://api.admira.store/xai/video/' + encodeURIComponent(requestId), { headers: h });
      var data = await r.json().catch(function () { return {}; });
      if (!r.ok) throw new Error((data && data.error) || ('consulta ' + r.status));
      if (data.archived && data.url) return data;
      var st = data.status || data.state || '';
      say('Generando clip de 5 s · ' + (st || 'en curso') + ' · ' + ((i + 1) * 5) + 's');
      if (st === 'failed' || st === 'expired' || st === 'error') throw new Error('el proveedor no completó el clip');
    }
    throw new Error('el clip no llegó a la biblioteca en 5 min');
  }

  function show(url) {
    if (!out) return;
    out.hidden = false;
    out.innerHTML = '<video controls src="' + url.replace(/"/g, '') + '" style="width:100%;max-height:360px"></video><p><a href="' + url.replace(/"/g, '') + '">Pieza en la biblioteca</a></p>';
  }

  var one = document.getElementById('clip-one');
  if (one) one.addEventListener('click', async function () {
    try {
      var prompt = (document.getElementById('clip-prompt').value || '').trim();
      var stockId = (document.getElementById('clip-stock').value || '').trim();
      var file = document.getElementById('clip-file').files[0];
      if (!prompt) return say('Escribe qué debe hacer la imagen.');
      if (!file && !stockId) return say('Sube una imagen o indica un id del Stock.');
      say('Pidiendo el clip de 5 s…');
      var h = await headers();
      var image = file ? await fileToDataUrl(file) : '';
      var id = await startOne(h, prompt, image, stockId);
      var saved = await waitStock(h, id);
      say('Guardado en la biblioteca.');
      show(saved.url);
    } catch (e) {
      say(e.message || String(e));
    }
  });

  var batch = document.getElementById('clip-batch');
  if (batch) batch.addEventListener('click', async function () {
    try {
      var lines = (document.getElementById('clip-scenes').value || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean).slice(0, 6);
      var file = document.getElementById('clip-file').files[0];
      var shared = file ? await fileToDataUrl(file) : '';
      if (!lines.length) return say('Escribe de 1 a 6 escenas, una por línea.');
      var scenes = lines.map(function (line) {
        var parts = line.split('||');
        var text = parts[0].trim();
        var stock = (parts[1] || '').trim() || (document.getElementById('clip-stock').value || '').trim();
        var scene = { text: text, duration: 5 };
        if (shared && !parts[1]) scene.image = shared;
        else scene.stock_id = stock;
        return scene;
      });
      say('Arrancando ' + scenes.length + ' clips de 5 s…');
      var h = await headers();
      var r = await fetch('https://api.admira.store/xai/video/scenes', { method: 'POST', headers: h, body: JSON.stringify({ scenes: scenes, aspect_ratio: '16:9' }) });
      var data = await r.json().catch(function () { return {}; });
      if (!r.ok) throw new Error((data && data.error) || ('HTTP ' + r.status));
      var saved = [];
      for (var i = 0; i < data.scenes.length; i++) {
        say('Escena ' + (i + 1) + ' de ' + data.scenes.length);
        saved.push(await waitStock(h, data.scenes[i].request_id));
      }
      say(saved.length + ' clips en la biblioteca.');
      if (saved[0]) show(saved[0].url);
    } catch (e) {
      say(e.message || String(e));
    }
  });
})();
