import { useState } from 'react';
import { Download } from 'lucide-react';
import { fileNameFromDisposition } from '@lilachat/shared';

const ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * «Exportar chat» in the chat info (R31/10-B7), like WhatsApp: the server
 * writes the `.txt` (who, when, what; the media named, not attached) and the
 * browser saves it. A secret chat cannot be exported: the server cannot read it.
 */
export function ExportChatRow(props: { chatId: string; jwt: string; onNotice: (text: string) => void }) {
  const [busy, setBusy] = useState(false);
  const exportChat = async () => {
    setBusy(true);
    try {
      const response = await fetch(`/api/chats/${props.chatId}/export?tz=${encodeURIComponent(ZONE)}`, { headers: { Authorization: `Bearer ${props.jwt}` } });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        return props.onNotice(body?.message ?? 'No se pudo exportar el chat.');
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = fileNameFromDisposition(response.headers.get('Content-Disposition'), 'Chat de Lilachat.txt');
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      props.onNotice('Sin conexión. Prueba de nuevo.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" data-testid="btn-exportar-chat" disabled={busy} onClick={() => void exportChat()} className="mt-2 flex min-h-[56px] w-full items-center gap-4 bg-surface px-6 text-left text-[15px] hover:bg-background disabled:opacity-60">
      <Download size={18} className="text-on-surface-variant" />
      <span className="flex-1">{busy ? 'Exportando…' : 'Exportar chat'}</span>
    </button>
  );
}
