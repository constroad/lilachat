/**
 * El avatar sin foto, igual en toda la app (FL13, auditoría §48). PURO. Como
 * el diseño FL6 de Stitch: dos iniciales sobre un tono por persona. Un número
 * de teléfono no tiene iniciales: va el ícono de persona, como WhatsApp.
 */
export const TONOS_DE_AVATAR = ['avatar-1', 'avatar-2', 'avatar-3', 'avatar-4', 'avatar-5'] as const;
export type TonoDeAvatar = (typeof TONOS_DE_AVATAR)[number];

const primeraLetra = (palabra: string): string => [...palabra].find((caracter) => /\p{L}/u.test(caracter)) ?? '';

export function inicialesDe(nombre: string): string | null {
  const palabras = nombre.trim().split(/\s+/).filter((palabra) => primeraLetra(palabra));
  if (palabras.length === 0) return null;
  if (palabras.length === 1) {
    const letras = [...palabras[0]!].filter((caracter) => /\p{L}/u.test(caracter));
    return letras.slice(0, 2).join('').toUpperCase();
  }
  return (primeraLetra(palabras[0]!) + primeraLetra(palabras[1]!)).toUpperCase();
}

export function tonoDeAvatar(clave: string): TonoDeAvatar {
  let suma = 0;
  for (const caracter of clave) suma = (suma * 31 + caracter.charCodeAt(0)) >>> 0;
  return TONOS_DE_AVATAR[suma % TONOS_DE_AVATAR.length]!;
}
