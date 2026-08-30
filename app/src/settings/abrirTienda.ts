import { Linking } from 'react-native';

/**
 * Mandar a LilaStore a actualizar, y si no está, al navegador.
 *
 * Vive acá porque lo usan DOS lugares —la banda de la lista y «Buscar
 * actualizaciones» de Ajustes— y hasta hoy hacían cosas distintas: la banda
 * abría la tienda y el botón de Ajustes abría el navegador con el APK suelto.
 * El mismo pedido resuelto de dos formas es, para quien lo usa, una app que a
 * veces funciona.
 *
 * **No se pregunta con `canOpenURL`**: en Android 11+ eso exige declarar la app
 * en `<queries>` y contesta `false` sin decirlo, que se leería como «no tenés la
 * tienda» a quien sí la tiene. Se intenta y, si no hay nadie, se cae al enlace.
 */
const LILASTORE = 'lilastore://';

export async function abrirActualizacion(downloadUrl: string): Promise<void> {
  try {
    await Linking.openURL(LILASTORE);
  } catch {
    // Sin la tienda instalada, el navegador es el único camino que queda.
    if (downloadUrl) void Linking.openURL(downloadUrl);
  }
}
