/* Newsletter Pixeria — captura de emails del radar.
 * POST a pixer-eleven /newsletter/subscribe. Si el worker no es alcanzable
 * (ISP españoles bloquean *.workers.dev), cae a un fallback mailto para no
 * perder la suscripcion. Honeypot anti-bots + validacion basica en cliente.
 */
(function () {
  var WORKER = 'https://pixer-eleven.csilvasantin.workers.dev';
  var ENDPOINT = WORKER + '/newsletter/subscribe';
  var MAILTO = 'mailto:csilvasantin@gmail.com?subject=Pixeria%20radar&body=I%20want%20to%20receive%20the%20Pixeria%20radar.';
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var isEN = (document.documentElement.lang || 'es').toLowerCase().indexOf('en') === 0;
  var T = isEN ? {
    sending: 'Sending…',
    ok: 'Done. We will email you the next radar.',
    already: 'You were already on the list. Thanks.',
    invalid: 'Check the email, it looks incomplete.',
    failGeneric: 'Could not complete. Please try again.',
    fallback: 'We could not connect. Write us and we will add you: ',
    fallbackLink: 'send email'
  } : {
    sending: 'Enviando…',
    ok: 'Hecho. Te avisamos del proximo radar.',
    already: 'Ya estabas en la lista. Gracias.',
    invalid: 'Revisa el email, parece incompleto.',
    failGeneric: 'No se pudo completar. Intenta de nuevo.',
    fallback: 'No pudimos conectar. Escribenos y te damos de alta: ',
    fallbackLink: 'enviar email'
  };

  function setMsg(form, text, kind) {
    var el = form.querySelector('.news-msg');
    if (!el) return;
    el.textContent = text;
    el.className = 'news-msg' + (kind ? ' is-' + kind : '');
  }

  function fallback(form, email) {
    var link = MAILTO + '%0A' + encodeURIComponent(email);
    setMsg(form, '', null);
    var el = form.querySelector('.news-msg');
    if (el) {
      el.className = 'news-msg is-err';
      el.innerHTML = T.fallback + '<a href="' + link + '">' + T.fallbackLink + '</a>.';
    }
  }

  function handle(form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = form.querySelector('input[type="email"]');
      var hp = form.querySelector('.news-hp');
      var btn = form.querySelector('button[type="submit"]');
      var email = (input && input.value || '').trim().toLowerCase();

      // Honeypot relleno => bot. Fingimos exito sin enviar nada.
      if (hp && hp.value) { setMsg(form, T.ok, 'ok'); form.reset(); return; }

      if (!EMAIL_RE.test(email)) { setMsg(form, T.invalid, 'err'); return; }

      if (btn) { btn.disabled = true; }
      setMsg(form, T.sending, null);

      var payload = {
        email: email,
        source: form.getAttribute('data-source') || 'pixeria',
        ref: location.pathname
      };

      // timeout manual (algunos bloqueos cuelgan la conexion)
      var done = false;
      var timer = setTimeout(function () { if (!done) { done = true; if (btn) btn.disabled = false; fallback(form, email); } }, 8000);

      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function (data) {
          if (done) return; done = true; clearTimeout(timer);
          if (btn) btn.disabled = false;
          if (data && data.ok) {
            setMsg(form, data.status === 'already' ? T.already : T.ok, 'ok');
            form.reset();
          } else {
            setMsg(form, T.failGeneric, 'err');
          }
        })
        .catch(function () {
          if (done) return; done = true; clearTimeout(timer);
          if (btn) btn.disabled = false;
          fallback(form, email);
        });
    });
  }

  document.querySelectorAll('.news-form').forEach(handle);
})();
