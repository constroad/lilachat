import * as Notifications from 'expo-notifications';

/**
 * Registro del token de push (F4).
 *
 * Dos reglas que evitan el fallo clásico de esta pieza:
 *
 * 1. **El permiso se pide TARDE**, no al abrir la app por primera vez. Pedirlo
 *    antes de que la persona vea un solo mensaje se contesta que no, y en
 *    Android reabrir ese diálogo es imposible: hay que ir a Ajustes. Se llama
 *    cuando ya hay sesión y la lista de chats está en pantalla.
 * 2. **Un permiso negado NO es un error.** La app funciona igual con la
 *    pantalla abierta; simplemente no avisa con el teléfono guardado. No se
 *    reintenta ni se molesta.
 */
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://lilachat.constroad.com';

export async function registerPushToken(jwt: string): Promise<'ok' | 'denied' | 'unsupported'> {
  /**
   * **No se descarta el emulador de antemano** (27/08/2026).
   *
   * Antes había acá un `if (!Device.isDevice) return 'unsupported'`. La
   * intención era buena —un emulador pelado no entrega token— pero la
   * consecuencia era que **FCM no se podía probar en ningún lado**: en el
   * emulador se rendía sin intentar, y en un teléfono real no hay forma de
   * depurar. Un emulador CON Google Play sí entrega token, y este lo tiene.
   *
   * El `try/catch` de abajo ya cubre el caso de que no se pueda: se intenta y se
   * degrada, en vez de adivinar por el tipo de aparato.
   */
  const existing = await Notifications.getPermissionsAsync();
  const granted =
    existing.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return 'denied';

  try {
    const token = await Notifications.getDevicePushTokenAsync();
    const pushToken = String(token.data ?? '');
    if (!pushToken) return 'unsupported';

    await fetch(`${BASE_URL}/api/chats/push-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ pushToken }),
      signal: AbortSignal.timeout(10_000),
    });
    return 'ok';
  } catch (error) {
    // Sin proyecto de Firebase, `getDevicePushTokenAsync` lanza. Es config
    // faltante, no un bug de la app: se dice y se sigue.
    console.warn('[push] no se pudo registrar el token:', error);
    return 'unsupported';
  }
}

/**
 * Cómo se muestra una notificación con la app ABIERTA: no se muestra. El chat
 * ya está en pantalla y el mensaje llegó por el socket; un banner encima sería
 * el mismo aviso dos veces.
 */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: true,
    }),
  });
}
