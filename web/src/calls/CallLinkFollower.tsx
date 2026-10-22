import { useEffect, useState } from 'react';
import { Phone, Video } from 'lucide-react';
import { api } from '../api';
import { Overlay } from '../ui/Overlay';
import { openChatFromAnywhere } from '../chat/rutaDelChat';
import { peekPendingCallLink, takePendingCallLink } from './pendingCallLink';

type Opened = { chatId: string; video: boolean; name: string | null };

/**
 * Follows a call link that opened the web (pending 42): with the session
 * ready, the chat opens and asks whether to call, voice or video, the link's
 * kind first. A link of a chat I am not in says so.
 */
export function CallLinkFollower(props: { jwt: string; onCall: (chatId: string, name: string, video: boolean) => void }) {
  const [opened, setOpened] = useState<Opened | null>(null);
  const [error, setError] = useState('');
  const { jwt } = props;

  useEffect(() => {
    const token = peekPendingCallLink();
    if (!token) return;
    let alive = true;
    void api<Opened>(`/call-links/${encodeURIComponent(token)}`, { jwt }).then((response) => {
      // A new tab asks with the saved session before it is renewed (seen in the E2E, 22/10):
      // a 401 keeps the link, and the renewed session asks again.
      if (!alive || (!response.ok && response.status === 401)) return;
      takePendingCallLink();
      if (!response.ok) return setError(response.message);
      openChatFromAnywhere(response.data.chatId);
      setOpened(response.data);
    });
    return () => {
      alive = false;
    };
  }, [jwt]);

  if (error) {
    return (
      <Overlay title="Enlace de llamada" onClose={() => setError('')}>
        <p data-testid="error-enlace-de-llamada" className="text-sm text-on-surface-variant">{error}</p>
      </Overlay>
    );
  }
  if (!opened) return null;
  const name = opened.name ?? 'esta persona';
  const call = (video: boolean) => {
    setOpened(null);
    props.onCall(opened.chatId, name, video);
  };
  const buttons = [
    <button key="voice" type="button" data-testid="btn-enlace-llamada-voz" onClick={() => call(false)} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-on-primary"><Phone size={16} /> Llamada de voz</button>,
    <button key="video" type="button" data-testid="btn-enlace-llamada-video" onClick={() => call(true)} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-primary text-sm font-semibold text-primary"><Video size={16} /> Videollamada</button>,
  ];
  return (
    <Overlay title={`¿Llamar a ${name}?`} onClose={() => setOpened(null)}>
      <p className="mb-4 text-sm text-on-surface-variant">Abriste un enlace de llamada.</p>
      <div className="flex gap-2">{opened.video ? [...buttons].reverse() : buttons}</div>
    </Overlay>
  );
}
