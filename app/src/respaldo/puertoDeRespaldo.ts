import * as FileSystem from 'expo-file-system/legacy';
import { respuestaDeStatus, type ElementoDelRollo, type Huella, type PuertoDeSubida } from '@lilachat/shared';
import { BASE_URL, huellasDeRespaldoQueFaltan } from '../api/client';
import { huellaDeArchivo, listarRespaldos, uriDeRespaldo } from './archivosDeRespaldo';
import { anotar, leerLibro } from './libroDeRespaldos';

/**
 * El puerto de verdad del corredor (`shared/subida`): los archivos de
 * respaldo del teléfono y el `PUT /api/respaldos` del server. `uploadAsync`
 * (legacy) sube en streaming NATIVO: el archivo no pasa por la memoria de JS y
 * funciona igual desde la tarea de fondo. Contrato: `server/src/respaldoRoutes.ts`.
 */
export function puertoDeRespaldo(jwt: string): PuertoDeSubida<ElementoDelRollo> {
  return {
    rollo: async () => listarRespaldos(),
    libro: () => leerLibro(),
    anotar,
    completar: async (elemento) => elemento,
    huellaDe: (elemento) => huellaDeArchivo(uriDeRespaldo(elemento.nombre)),
    huellasQueFaltan: async (huellas) => {
      const respuesta = await huellasDeRespaldoQueFaltan(jwt, huellas);
      return respuesta.ok ? new Set<Huella>(respuesta.data.faltan) : null;
    },
    subir: async (elemento, huella) => {
      try {
        const respuesta = await FileSystem.uploadAsync(`${BASE_URL}/api/respaldos`, uriDeRespaldo(elemento.nombre), {
          httpMethod: 'PUT',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: {
            Authorization: `Bearer ${jwt}`,
            'Content-Type': 'application/octet-stream',
            'x-huella': huella,
            'x-nombre': elemento.nombre,
          },
        });
        return respuestaDeStatus(respuesta.status);
      } catch {
        return 'sin_respuesta';
      }
    },
    ahora: () => Date.now(),
  };
}
