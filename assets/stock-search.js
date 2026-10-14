(function (root) {
  const aliases = {music:'musica', songs:'cancion', song:'cancion', canciones:'cancion', muscia:'musica', technology:'tecnologia', tech:'tecnologia'};
  function normalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
      .replace(/#/g,'').replace(/[^\p{L}\p{N}_:/.-]+/gu,' ').trim().split(/\s+/).map(t=>aliases[t] || t).join(' ');
  }
  function matches(item, query) {
    const words=normalize(query).split(/\s+/).filter(Boolean);
    const hay=normalize([item?.title,item?.prompt,item?.comment,...(Array.isArray(item?.tags)?item.tags:[])].filter(Boolean).join(' '));
    return words.every(word=>hay.includes(word));
  }
  root.AdmiraStockSearch={normalize,matches};
})(globalThis);
