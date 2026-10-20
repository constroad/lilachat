import * as FileSystem from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { PlanDeCompresion } from './compresionDeFoto';

export type FotoComprimida = { uri: string; width: number; height: number; sizeBytes: number };

/**
 * Achica una foto según su plan (`compresionDeFoto`). Corre mientras la burbuja
 * ya se ve (etapa «preparando» de la cola): el usuario no espera esto. El
 * resultado queda en la caché; la cola lo copia a su carpeta.
 */
export async function comprimirFoto(uri: string, plan: PlanDeCompresion): Promise<FotoComprimida> {
  const contexto = ImageManipulator.manipulate(uri);
  if (plan.redimension) contexto.resize(plan.redimension);
  const imagen = await contexto.renderAsync();
  try {
    const guardada = await imagen.saveAsync({ compress: plan.calidad, format: SaveFormat.JPEG });
    const info = await FileSystem.getInfoAsync(guardada.uri);
    return { uri: guardada.uri, width: guardada.width, height: guardada.height, sizeBytes: info.exists ? info.size : 0 };
  } finally {
    imagen.release();
    contexto.release();
  }
}
