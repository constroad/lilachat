import * as Notifications from 'expo-notifications';
import { AppState } from 'react-native';
import { armarAviso } from '@lilachat/shared';
import { reportarError } from '../ui/reportarError';

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
const CANAL = 'mensajes';

/**
 * El canal de Android. Sin uno propio con importancia ALTA, el aviso llega a la
 * bandeja pero **no asoma arriba** — que es justo lo que se pidió.
 */
export async function prepararAvisos(): Promise<void> {
  try {
    await Notifications.setNotificationChannelAsync(CANAL, {
      name: 'Mensajes',
      importance: Notifications.AndroidImportance.HIGH,
      // Vibración y luz: es un chat, no un aviso de sistema.
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
  } catch (error) {
    reportarError('prepararAvisos', error);
  }
}

export async function avisarMensaje(params: {
  chatId: string;
  chatName: string;
  senderName: string | null;
  esGrupo: boolean;
  kind: 'text' | 'image' | 'video' | 'audio' | 'file';
  body: string;
  cifrado?: boolean;
}): Promise<void> {
  // Con la app ADELANTE no se avisa: el mensaje ya se está viendo, y una burbuja
  // encima de la conversación que uno está leyendo es puro estorbo.
  if (AppState.currentState === 'active') return;

  try {
    const aviso = armarAviso(params);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: aviso.titulo,
        body: aviso.cuerpo,
        // El `chatId` viaja para que tocar la burbuja pueda abrir ESE chat.
        data: { chatId: params.chatId },
      },
      trigger: null,
    });
  } catch (error) {
    reportarError('avisarMensaje', error);
  }
}
