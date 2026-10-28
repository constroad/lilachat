import { crearColaDeArchivos } from './colaDeArchivos';
import { medidasDeImagen } from './EnviarArchivos';
import { subirArchivo } from './mediaUpload';
import { shrinkPhotoBlob } from './shrinkPhoto';

/** El JWT vigente: se renueva en memoria y la cola lo lee al subir. */
let jwtVigente = '';
export function usarJwtParaSubir(jwt: string): void {
  jwtVigente = jwt;
}

/**
 * The photo with Portal's standard (`shrinkPhotoBlob`, 28/10), the SAME rule as
 * the app. With «HD», a light photo, no canvas or a failure, the original.
 */
async function preparar(archivo: File, hd: boolean) {
  const shrunk = await shrinkPhotoBlob(archivo, archivo.name, { hd });
  if (shrunk.blob !== archivo) return { archivo: shrunk.blob, nombre: shrunk.name, mime: shrunk.mime, width: shrunk.width, height: shrunk.height };
  return { archivo: archivo as Blob, nombre: archivo.name, mime: archivo.type, ...(await medidasDeImagen(archivo)) };
}

/** La cola de la pestaña: una sola para todos los chats. */
export const colaDeArchivosWeb = crearColaDeArchivos({
  subir: (datos) => subirArchivo({ ...datos, jwt: jwtVigente, mime: datos.archivo.type || 'application/octet-stream' }),
  preparar,
  crearVista: (archivo) => URL.createObjectURL(archivo),
  revocarVista: (url) => URL.revokeObjectURL(url),
  uuid: () => crypto.randomUUID(),
  ahora: () => new Date().toISOString(),
});
