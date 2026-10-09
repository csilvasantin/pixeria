// A single standard destination; project selections and settings stay in their own families.
export const isClassicFormat = format => !format?.proyecto && !format?.especial && ['9:16','16:9'].includes(format?.id);
export function classicTargets(source, ready) {
  if (!ready || source?.kind !== 'image' || !Number.isInteger(source.ancho) || !Number.isInteger(source.alto) || source.ancho <= 0 || source.alto <= 0) return [];
  return source.ancho > source.alto ? ['9:16'] : source.ancho < source.alto ? ['16:9'] : ['9:16','16:9'];
}
export const extraFormats = (formats, image) => image ? formats.filter(f => !isClassicFormat(f)) : formats;
