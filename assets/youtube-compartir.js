/* «Compartir» en el Stock: ▸ YouTube (vía /api/youtube/upload) y enlace (Web Share o copiar).
 * Expone window.YTCompartir.abrir(item). Ver docs/youtube-compartir.md.
 */
(function () {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const EN = /^en\b/i.test(document.documentElement.lang || '');
  const T = EN ? {
    head: 'Share ▸ YouTube', title: 'Title', desc: 'Description', priv: 'Privacy', unlisted: 'Unlisted', private: 'Private', public: 'Public',
    publish: '▸ Publish to YouTube', link: '🔗 Share link', close: 'Close', copied: 'Link copied', notConn: 'YouTube not connected',
    uploading: 'Uploading to YouTube…', published: 'Published', error: 'Error',
  } : {
    head: 'Compartir ▸ YouTube', title: 'Título', desc: 'Descripción', priv: 'Privacidad', unlisted: 'Oculto', private: 'Privado', public: 'Público',
    publish: '▸ Publicar en YouTube', link: '🔗 Compartir enlace', close: 'Cerrar', copied: 'Enlace copiado', notConn: 'YouTube no conectado',
    uploading: 'Subiendo a YouTube…', published: 'Publicado', error: 'Error',
  };
  const ERRORES = EN ? {
    'youtube-no-conectado': 'YouTube not connected', 'session-required': 'Please sign in',
    'solo-superusuario': 'Superusers only', 'youtube-cuota': 'Daily YouTube quota exhausted',
    'no-es-video': 'Stock videos only',
  } : {
    'youtube-no-conectado': 'YouTube no conectado', 'session-required': 'Inicia sesión',
    'solo-superusuario': 'Solo superusuarios', 'youtube-cuota': 'Cuota diaria de YouTube agotada',
    'no-es-video': 'Solo vídeos del Stock',
  };
  function esVideo(it) {
    return Boolean(it && it.url && (it.type === 'video' || String(it.mime || '').startsWith('video/') || /\.(mp4|webm|mov)(\?|$)/i.test(it.url)));
  }
  async function compartirEnlace(it, st) {
    const data = {title: it.title || 'Admira Stock', url: it.url};
    try {
      if (navigator.share) { await navigator.share(data); return; }
      await navigator.clipboard.writeText(it.url);
      st.textContent = T.copied;
    } catch (e) { if (e && e.name !== 'AbortError') st.textContent = it.url; }
  }
  function abrir(it) {
    if (!esVideo(it)) return;
    const dlg = document.createElement('dialog');
    dlg.className = 'yt-share';
    dlg.style.cssText = 'max-width:520px;width:92vw;background:#0a0f0a;color:inherit;border:1px solid #2a4;border-radius:10px;padding:16px;';
    dlg.innerHTML = `<form method="dialog" style="display:flex;flex-direction:column;gap:8px">
      <strong>${T.head}</strong>
      <label>${T.title}<input name="title" maxlength="100" value="${esc((it.title || it.prompt || '').slice(0, 100))}" style="width:100%"></label>
      <label>${T.desc}<textarea name="description" rows="4" style="width:100%">${esc(it.comment || it.prompt || '')}</textarea></label>
      <label>${T.priv} <select name="privacyStatus"><option value="unlisted" selected>${T.unlisted}</option><option value="private">${T.private}</option><option value="public">${T.public}</option></select></label>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="btn" data-yt="subir">${T.publish}</button>
        <button type="button" class="btn" data-yt="enlace">${T.link}</button>
        <button type="submit" class="btn">${T.close}</button>
      </div>
      <span data-yt="estado" role="status" style="font-size:12px"></span></form>`;
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    const st = dlg.querySelector('[data-yt="estado"]');
    const subir = dlg.querySelector('[data-yt="subir"]');
    dlg.querySelector('[data-yt="enlace"]').onclick = () => compartirEnlace(it, st);
    fetch('/api/youtube/upload').then(r => r.json()).then(j => {
      if (j && j.conectado === false) { subir.disabled = true; st.textContent = T.notConn; }
    }).catch(() => {});
    subir.onclick = async () => {
      const f = dlg.querySelector('form');
      subir.disabled = true; st.textContent = T.uploading;
      try {
        const r = await fetch('/api/youtube/upload', {method: 'POST', headers: {'Content-Type': 'application/json'}, credentials: 'same-origin',
          body: JSON.stringify({id: it.id, title: f.title.value, description: f.description.value, privacyStatus: f.privacyStatus.value})});
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.ok) throw new Error(j.mensaje || ERRORES[j.error] || j.error || ('HTTP ' + r.status));
        st.innerHTML = `${T.published}: <a href="${esc(j.url)}" target="_blank" rel="noopener">${esc(j.url)}</a>`;
      } catch (e) { st.textContent = T.error + ': ' + e.message; subir.disabled = false; }
    };
    dlg.showModal();
  }
  window.YTCompartir = {abrir, esVideo, T};
})();
