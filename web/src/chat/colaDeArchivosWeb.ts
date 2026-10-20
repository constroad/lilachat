import { nombreComprimido, planDeCompresion } from '@lilachat/shared';
import { crearColaDeArchivos } from './colaDeArchivos';
import { medidasDeImagen } from './EnviarArchivos';
import { subirArchivo } from './mediaUpload';

/** El JWT vigente: se renueva en memoria y la cola lo lee al subir. */
let jwtVigente = '';
export function usarJwtParaSubir(jwt: string): void {
  jwtVigente = jwt;
}

/**
 * Achica una foto en el navegador con la MISMA regla que la app
 * (`planDeCompresion`: lado largo 1600 px, JPEG 70 %). Con «HD», sin soporte de
 * canvas o si algo falla, va la original.
 */
async function preparar(archivo: File, hd: boolean) {
  const medidas = await medidasDeImagen(archivo);
  const original = { archivo: archivo as Blob, nombre: archivo.name, mime: archivo.type, ...medidas };
  const plan = planDeCompresion({ ...medidas, mimeType: archivo.type, hd });
  if (!plan || typeof createImageBitmap !== 'function' || !medidas.width || !medidas.height) return original;
  const escala = plan.redimension ? Math.min(1, ('width' in plan.redimension ? plan.redimension.width / medidas.width : plan.redimension.height / medidas.height)) : 1;
  const ancho = Math.round(medidas.width * escala);
  const alto = Math.round(medidas.height * escala);
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const imagen = await createImageBitmap(archivo);
  lienzo.getContext('2d')?.drawImage(imagen, 0, 0, ancho, alto);
  imagen.close();
  const comprimida = await new Promise<Blob | null>((resolver) => lienzo.toBlob(resolver, 'image/jpeg', plan.calidad));
  return comprimida ? { archivo: comprimida, nombre: nombreComprimido(archivo.name), mime: 'image/jpeg', width: ancho, height: alto } : original;
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
