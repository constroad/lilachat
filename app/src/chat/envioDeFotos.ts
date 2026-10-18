/**
 * Varias fotos con su pie (FL9b; auditoría §46.2: una foto por vez y sin
 * previsualizar, aunque el server ya aceptaba pie). Motor PURO.
 */
export const MAXIMO_DE_FOTOS = 10;

/** Lo que devuelve el selector (expo-image-picker), lo justo. */
export type FotoElegida = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  /** Lo que dio la galería o la cámara (FL9): la burbuja respeta la forma. */
  width?: number;
  height?: number;
};

export type FotoAEnviar = {
  uri: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  caption?: string;
  width?: number;
  height?: number;
};

/** Cada foto con su pie (por `uri`), en el orden en que se eligieron. */
export function armarEnvioDeFotos(fotos: readonly FotoElegida[], pies: Readonly<Record<string, string>>): FotoAEnviar[] {
  return fotos.map((foto) => {
    const pie = pies[foto.uri]?.trim();
    return {
      uri: foto.uri,
      fileName: foto.fileName ?? 'foto.jpg',
      mimeType: foto.mimeType ?? 'image/jpeg',
      sizeBytes: foto.fileSize ?? 0,
      caption: pie ? pie : undefined,
      width: foto.width,
      height: foto.height,
    };
  });
}

/** Sacar una foto de la previsualización sin que la que se ve quede fuera. */
export function quitarFoto<T>(fotos: readonly T[], indice: number, actual: number): { fotos: T[]; actual: number } {
  const quedan = fotos.filter((_, i) => i !== indice);
  // Si se saca una de antes, la que se estaba viendo corre un lugar.
  const siguiente = indice < actual ? actual - 1 : actual;
  return { fotos: quedan, actual: Math.max(0, Math.min(siguiente, quedan.length - 1)) };
}
