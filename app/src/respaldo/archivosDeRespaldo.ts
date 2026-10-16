import { Directory, File, Paths } from 'expo-file-system';
import { huellaDeTrozos, type ElementoDelRollo, type Huella } from '@lilachat/shared';
import { elementoDeArchivo } from './planDeRespaldo';

/**
 * Los archivos de respaldo en el teléfono (F12.1): `<documentos>/respaldos/`.
 * Es el «rollo» que el corredor (`shared/subida`) recorre. Se conserva
 * solo el último subido; los anteriores se borran, el historial lo guarda la
 * mini.
 */
function carpeta(): Directory {
  const dir = new Directory(Paths.document, 'respaldos');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

export function listarRespaldos(): ElementoDelRollo[] {
  try {
    return carpeta()
      .list()
      .filter((entrada): entrada is File => entrada instanceof File && entrada.name.endsWith('.lcb'))
      .map((archivo) =>
        elementoDeArchivo({
          nombre: archivo.name,
          bytes: archivo.size ?? 0,
          modificadoEn: Math.round((archivo.modificationTime ?? 0) * 1000) || Date.now(),
        })
      );
  } catch {
    return [];
  }
}

export function uriDeRespaldo(nombre: string): string {
  return new File(carpeta(), nombre).uri;
}

export function escribirRespaldo(nombre: string, contenido: string): { bytes: number } {
  const archivo = new File(carpeta(), nombre);
  archivo.write(contenido);
  return { bytes: archivo.size ?? contenido.length };
}

export function borrarRespaldo(nombre: string): void {
  try {
    const archivo = new File(carpeta(), nombre);
    if (archivo.exists) archivo.delete();
  } catch {
    // Un archivo que no se pudo borrar se vuelve a intentar en la próxima corrida.
  }
}

/** Borra todo menos `conservar`: después de subir, el teléfono guarda un solo respaldo. */
export function conservarSolo(conservar: string): void {
  for (const elemento of listarRespaldos()) {
    if (elemento.nombre !== conservar) borrarRespaldo(elemento.nombre);
  }
}

/**
 * La huella por trozos: `arrayBuffer()` de Expo corrompe archivos grandes
 * (memoria `expo-arraybuffer-corrupts-large-files`). Copiado de Lilafotos.
 */
export async function huellaDeArchivo(uri: string): Promise<{ huella: Huella; bytes: number }> {
  const lector = new File(uri).readableStream().getReader();
  let bytes = 0;
  async function* trozos(): AsyncGenerator<Uint8Array> {
    for (;;) {
      const { done, value } = await lector.read();
      if (done) return;
      bytes += value.byteLength;
      yield value;
    }
  }
  const huella = await huellaDeTrozos(trozos());
  return { huella, bytes };
}
