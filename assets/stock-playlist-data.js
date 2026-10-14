(function(){
  'use strict';
  let data={rows:[],assignments:[]},pending=null,at=0,error='';
  const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function badge(id){
    const list=StockDestinations.memberships(data,id);if(!list.length)return '';
    const count=new Set(list.map(a=>a.id||a.name)).size,detail=StockDestinations.membershipText(data,id);
    return '<button type="button" class="stock-playlist-badge" data-act="playlist-memberships" title="'+esc(detail)+'" aria-label="'+esc('Playlist: '+detail)+'">Playlist'+(count>1?' · '+count:'')+'</button>';
  }
  function paint(){document.querySelectorAll('.stock-card[data-id]').forEach(card=>{const box=card.querySelector('.stock-card-media');if(!box)return;const old=box.querySelector('.stock-playlist-badge');if(old)old.remove();box.insertAdjacentHTML('beforeend',badge(card.dataset.id));});}
  async function load(force=false){
    if(pending)return pending;
    if(!force&&Date.now()-at<30000)return data;
    pending=(async()=>{try{const r=await fetch('/stock-playlists',{cache:'no-store',credentials:'same-origin'});const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'destinations_unavailable');data=d;at=Date.now();error='';paint();document.dispatchEvent(new CustomEvent('stock:playlists',{detail:data}));return data;}catch(e){error=e.message;throw e;}finally{pending=null;}})();
    return pending;
  }
  window.StockPlaylistData={load,badge,paint,current:()=>data,error:()=>error};
  document.addEventListener('DOMContentLoaded',()=>{load().catch(()=>{});setInterval(()=>{if(!document.hidden)load(true).catch(()=>{});},60000);});
})();
