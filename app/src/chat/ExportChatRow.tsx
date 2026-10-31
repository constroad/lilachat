import { useState } from 'react';
import { Download } from 'lucide-react-native';
import { FilaDeAjuste } from '../ui/FilaDeAjuste';
import { exportChat } from './exportChat';
import type { ExportSetting } from './disappearSetting';

/**
 * «Exportar chat» (R31/10-B7), like WhatsApp: the server writes the `.txt`
 * (who, when, what; the media named, not attached) and the phone opens the
 * share sheet with it.
 */
export function ExportChatRow({ chatId, jwt, onNotice }: ExportSetting) {
  const [busy, setBusy] = useState(false);
  const share = async () => {
    setBusy(true);
    const answer = await exportChat(chatId, jwt);
    setBusy(false);
    if (!answer.ok) onNotice(answer.message);
  };
  return <FilaDeAjuste testID="btn-exportar-chat" icono={Download} titulo={busy ? 'Exportando…' : 'Exportar chat'} detalle="Un archivo de texto con los mensajes, sin las fotos." onPress={busy ? undefined : () => void share()} />;
}
