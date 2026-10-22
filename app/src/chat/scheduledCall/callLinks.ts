import { Alert, Share } from 'react-native';
import { createCallLink, openCallLink } from '../../api/client';

/**
 * «Crear enlace de llamada» (pending 42), like WhatsApp: voice or video, then
 * the phone's share sheet (copy, WhatsApp, mail…). Only the chat's members
 * can use it: the server checks it when it is opened.
 */
export function offerCallLink(params: { jwt: string; chatId: string; chatName: string }): void {
  const share = async (video: boolean) => {
    const response = await createCallLink(params.jwt, params.chatId, video);
    if (!response.ok) return Alert.alert('No se pudo crear el enlace', response.message ?? 'Revisa tu conexión y prueba de nuevo.');
    await Share.share({ message: `Únete a mi ${video ? 'videollamada' : 'llamada'} de Lilachat: ${response.data.url}` }).catch(() => undefined);
  };
  Alert.alert('Crear enlace de llamada', `Para una llamada con ${params.chatName}. Solo sirve para quienes están en este chat.`, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Videollamada', onPress: () => void share(true) },
    { text: 'Voz', onPress: () => void share(false) },
  ]);
}

/**
 * A call link opened on the phone: the chat opens and asks whether to call,
 * voice or video (the link's kind first). The phone's agenda name wins over
 * the server's when the chat list knows it.
 */
export async function followCallLink(params: {
  jwt: string;
  linkToken: string;
  openChat: (chatId: string) => void;
  call: (chatId: string, name: string, video: boolean) => void;
}): Promise<void> {
  const response = await openCallLink(params.jwt, params.linkToken);
  if (!response.ok) return Alert.alert('Enlace de llamada', response.message ?? 'No se pudo abrir el enlace. Revisa tu conexión.');
  const { chatId, video } = response.data;
  const name = response.data.name ?? 'esta persona';
  params.openChat(chatId);
  const voice = { text: 'Llamada de voz', onPress: () => params.call(chatId, name, false) };
  const videoCall = { text: 'Videollamada', onPress: () => params.call(chatId, name, true) };
  Alert.alert(`¿Llamar a ${name}?`, 'Abriste un enlace de llamada.', [{ text: 'Cancelar', style: 'cancel' }, ...(video ? [voice, videoCall] : [videoCall, voice])]);
}
