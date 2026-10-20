/**
 * Cuánto se achica una foto antes de mandarla (José, 19/10: «sí, comprime»).
 * Como WhatsApp: el lado largo a 1600 px y JPEG al 70 %. Una foto de cámara de
 * 4–12 MB queda en unos cientos de KB y sube en segundos. Con «HD» se manda la
 * original; videos, GIF (animados) y archivos no se tocan. Motor PURO.
 */
export const LADO_MAXIMO = 1600;
export const CALIDAD_JPEG = 0.7;

export type PlanDeCompresion = { redimension: { width: number } | { height: number } | null; calidad: number };

export function planDeCompresion(foto: { width?: number; height?: number; mimeType: string; hd: boolean }): PlanDeCompresion | null {
  if (foto.hd || !foto.mimeType.startsWith('image/') || foto.mimeType === 'image/gif') return null;
  const ancho = foto.width ?? 0;
  const alto = foto.height ?? 0;
  if (Math.max(ancho, alto) <= LADO_MAXIMO) return { redimension: null, calidad: CALIDAD_JPEG };
  return { redimension: ancho >= alto ? { width: LADO_MAXIMO } : { height: LADO_MAXIMO }, calidad: CALIDAD_JPEG };
}

/** El nombre de la foto ya comprimida: misma base, extensión `.jpg`. */
export function nombreComprimido(nombre: string): string {
  const base = nombre.includes('.') ? nombre.slice(0, nombre.lastIndexOf('.')) : nombre;
  return `${base || 'foto'}.jpg`;
}
