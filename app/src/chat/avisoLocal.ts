import * as Notifications from 'expo-notifications';
import { armarAviso, CANAL_MENSAJES } from '@lilachat/shared';
import { reportarError } from '../ui/reportarError';
import { cuerpoDelAviso, idDeAvisoDeChat, sumarLineaAlAviso, tituloDelAviso } from './avisosPorChat';

/** Lo que ya muestra el aviso de cada chat: el nuevo lo reemplaza y lo suma (FL11). */
const porChat = new Map<string, { lineas: string[]; cuantos: number }>();

/**
 * La burbuja de arriba cuando llega un mensaje, como WhatsApp.
 *
 * Es un aviso **local**: lo dispara la propia app al recibir el mensaje por el
 * socket, no un servicio de push. Por eso no hace falta Firebase — y por eso
 * solo funciona mientras el socket viva, que es lo que el servicio en primer
 * plano viene a sostener.
 *
 * **Nunca lanza.** Un aviso que revienta al mostrarse rompería la llegada del
 * mensaje, que es lo que de verdad importa.
 */
const CANAL = CANAL_MENSAJES;
/** El canal viejo, sin sonido. Se borra al migrar (ver [[CANAL_MENSAJES]]). */
const CANAL_VIEJO = 'mensajes';

/**
 * El canal de Android. Sin uno propio con importancia ALTA, el aviso llega a la
 * bandeja pero **no asoma arriba** — que es justo lo que se pidió.
 */
export async function prepararAvisos(): Promise<void> {
  try {
    /**
     * **Pedir el permiso, que es lo que faltaba.**
     *
     * Desde Android 13 las notificaciones se conceden en tiempo de ejecución y
     * la app **nunca lo pedía**: `POST_NOTIFICATIONS` quedaba en `granted=false`
     * y la app entera con `importance=NONE`. Con eso no se veía nada — ni la
     * burbuja de un mensaje ni la notificación del servicio en primer plano,
     * que el sistema oculta aunque el servicio SÍ esté corriendo.
     *
     * Solo se vio corriendo el flujo completo en el emulador (27/08/2026): el
     * servicio decía `isForeground=true` y la bandeja estaba vacía.
     */
    // El permiso lo pide `registerPushToken` (una vez, al ver la lista): si se
    // pidiera también acá, al arrancar salían DOS diálogos seguidos (FL8).

    await Notifications.setNotificationChannelAsync(CANAL, {
      name: 'Mensajes',
      importance: Notifications.AndroidImportance.HIGH,
      // SIN `sound`: así expo-notifications le pone el tono de notificación
      // del teléfono (respeta silencio y volumen). Con `sound: 'default'`
      // buscaba un archivo «default» en la app, caía igual al tono del sistema
      // y avisaba «Custom sound 'default' not found» en cada arranque (FL8).
      // Vibración y luz: es un chat, no un aviso de sistema.
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });

    // El canal viejo quedó sin sonido y es inmutable: se borra para que no
    // aparezca duplicado en los ajustes del sistema ni reciba avisos mudos.
    await Notifications.deleteNotificationChannelAsync(CANAL_VIEJO);
  } catch (error) {
    reportarError('prepararAvisos', error);
  }
}

export async function avisarMensaje(params: {
  chatId: string;
  chatName: string;
  senderName: string | null;
  esGrupo: boolean;
  kind: 'text' | 'image' | 'video' | 'audio' | 'file' | 'poll' | 'event';
  body: string;
  cifrado?: boolean;
}): Promise<void> {
  // Con la app ADELANTE también se dispara la notificación, pero SIN banner
  // (lo suprime `configureNotificationHandler`): así suena el tono y zumba —lo
  // que pidió José, como WhatsApp— sin tapar la conversación con una burbuja.
  // Que suene o zumbe según el modo del teléfono lo decide Android por el canal:
  // tono en normal, vibración en modo vibrador, nada en silencio.
  try {
    const aviso = armarAviso(params);
    // UNO por chat, como WhatsApp (FL11): el mismo identificador reemplaza al
    // aviso anterior del chat, que suma las últimas líneas.
    const previo = porChat.get(params.chatId) ?? { lineas: [], cuantos: 0 };
    const actual = { lineas: sumarLineaAlAviso(previo.lineas, aviso.cuerpo), cuantos: previo.cuantos + 1 };
    porChat.set(params.chatId, actual);
    await Notifications.scheduleNotificationAsync({
      identifier: idDeAvisoDeChat(params.chatId),
      content: {
        title: tituloDelAviso(aviso.titulo, actual.cuantos),
        body: cuerpoDelAviso(actual.lineas),
        // En Android manda el canal; se pone igual por si el sistema lo mira, y
        // porque es lo correcto para un mensaje entrante.
        sound: 'default',
        // El `chatId` viaja para que tocar la burbuja pueda abrir ESE chat.
        data: { chatId: params.chatId },
      },
      // Entrega inmediata PERO en nuestro canal (el que tiene sonido). Con
      // `trigger: null` no se fija canal y Android usa uno de respaldo mudo.
      trigger: { channelId: CANAL },
    });
  } catch (error) {
    reportarError('avisarMensaje', error);
  }
}

/** Al abrir el chat: se va su aviso local y se olvidan sus líneas (FL11). */
export function olvidarAvisoDelChat(chatId: string): void {
  porChat.delete(chatId);
  Notifications.dismissNotificationAsync(idDeAvisoDeChat(chatId)).catch((error: unknown) => reportarError('olvidarAvisoDelChat', error));
}
