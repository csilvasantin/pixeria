// Stock stores some binary uploads with ext=bin; MIME is authoritative.
export function isXpace(item) {
  return !!item && item.type!=='furni' && (Array.isArray(item.tags) ? item.tags : []).some(tag => String(tag).toLowerCase() === '3d') &&
    (String(item.mime).split(';')[0] === 'model/gltf-binary' || String(item.ext).toLowerCase() === 'glb' || /\.glb(?:[?#]|$)/i.test(item.url || ''));
}
export function blendFor(item, items) {
  const explicit=families[item.id]?.blend;
  if(explicit)return items.find(other=>other.id===explicit) || null;
  const candidates = items.filter(other => other.id !== item.id && (other.mime === 'application/x-blender' || other.ext === 'blend' || /\.blend(?:[?#]|$)/i.test(other.url || '')));
  const matches = candidates.filter(other => item.externalRef && other.externalRef === item.externalRef);
  if (matches.length === 1) return matches[0];
  // Without an explicit asset-family reference, never guess another model's source.
  return null;
}
// Verified Stock delivery #4364 predates externalRef; explicit links avoid tag guesses.
const families = {
  '1790365002072-l9tpjw': {blend:'1790365036008-xn4dg1',poster:'1790364854974-klpanl'}
};
export function xpacePoster(item, items) {
  if (item.poster || item.thumbnail) return item.poster || item.thumbnail;
  const id=families[item.id]?.poster;
  if(id)return items.find(other=>other.id===id)?.url || `https://api.admira.store/stock/asset/${id}`;
  const render=items.find(other=>item.externalRef && other.externalRef===item.externalRef && other.type==='image' && /isom|iso\b/i.test(other.title || ''));
  return render?.url || '';
}
