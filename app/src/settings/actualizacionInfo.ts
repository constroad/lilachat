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
