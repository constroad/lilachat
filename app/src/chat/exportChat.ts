import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { fileNameFromDisposition } from '@lilachat/shared';
import { BASE_URL } from '../api/client';

/** The phone's zone, read once: the export writes each time as the reader lives it. */
const ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * «Exportar chat» (R31/10-B7): the server writes the `.txt`, the phone saves it
 * in its cache with the server's name and opens the share sheet (WhatsApp,
 * Drive, correo). Never throws: the screen says what failed.
 */
export async function exportChat(chatId: string, jwt: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const temp = `${FileSystem.cacheDirectory}chat-export.txt`;
  try {
    const result = await FileSystem.downloadAsync(`${BASE_URL}/api/chats/${chatId}/export?tz=${encodeURIComponent(ZONE)}`, temp, { headers: { Authorization: `Bearer ${jwt}` } });
    if (result.status === 409) return { ok: false, message: 'Un chat secreto no se puede exportar: el servidor no puede leerlo.' };
    if (result.status !== 200) return { ok: false, message: 'No se pudo exportar el chat.' };
    const named = `${FileSystem.cacheDirectory}${fileNameFromDisposition(result.headers['content-disposition'] ?? result.headers['Content-Disposition'], 'Chat de Lilachat.txt')}`;
    await FileSystem.deleteAsync(named, { idempotent: true });
    await FileSystem.moveAsync({ from: result.uri, to: named });
    await Sharing.shareAsync(named, { mimeType: 'text/plain', dialogTitle: 'Exportar chat', UTI: 'public.plain-text' });
    return { ok: true };
  } catch {
    return { ok: false, message: 'Sin conexión. Prueba de nuevo.' };
  }
}
