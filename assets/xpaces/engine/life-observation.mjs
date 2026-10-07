// Optional fixed perspective camera for viewing anamorphic content. No warp/export ownership.
export function normalizeObservation(raw){
  if(!raw)return null;
  const vector=v=>v&&['x','y','z'].every(k=>Number.isFinite(v[k]));
  if(!vector(raw.position)||!vector(raw.target)||!Number.isFinite(raw.fov)||raw.fov<10||raw.fov>100||Math.hypot(...['x','y','z'].map(k=>raw.position[k]-raw.target[k]))<.1)throw new TypeError('invalid-observation');
  return {position:{...raw.position},target:{...raw.target},fov:raw.fov};
}
