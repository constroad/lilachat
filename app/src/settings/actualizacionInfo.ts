/**
 * Los datos para autoactualizar, y la decisión de si alcanzan. Motor PURO
 * (sin `expo-file-system` ni nada nativo), para poder testearlo en Jest sin
 * emulador — el hook `useActualizador` lo importa.
 */
export type InfoActualizacion = {
  downloadUrl: string;
  releaseId: string;
  sha256: string;
  size: number;
};

/** Sin URL, sin hash o sin tamaño no se puede verificar → no se instala. */
export function hayConQueActualizar(info: InfoActualizacion): boolean {
  return info.downloadUrl !== '' && info.sha256 !== '' && info.size > 0 && info.releaseId !== '';
}

/**
 * Con qué versión actualizar al tocar «Actualizar»: la recién consultada si
 * llegó completa; si no (sin red), la que se tenía. Antes se usaba siempre la
 * del arranque y, con publicaciones seguidas, se bajaba una vieja.
 */
export function infoParaActualizar(fresca: InfoActualizacion, guardada: InfoActualizacion): InfoActualizacion {
  return hayConQueActualizar(fresca) ? fresca : guardada;
}
