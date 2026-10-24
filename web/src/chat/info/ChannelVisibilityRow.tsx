import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';

/**
 * «Canal privado» in a channel's settings (pending 93; José, 23/10: a public
 * channel could not be made private). Only its admins move it; #general is the
 * whole space's and stays public. The server checks it too and tells the channel.
 */
export function ChannelVisibilityRow(props: { chatId: string; jwt: string; isPrivate: boolean; isAdmin: boolean; isGeneral: boolean; onAviso: (text: string) => void }) {
  const [isPrivate, setPrivate] = useState(props.isPrivate);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setPrivate(props.isPrivate);
  }, [props.isPrivate]);
  const canChange = props.isAdmin && !props.isGeneral;
  const change = async (next: boolean) => {
    setPrivate(next);
    setSaving(true);
    try {
      const response = await fetch(`/api/chats/${props.chatId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${props.jwt}` }, body: JSON.stringify({ visibility: next ? 'private' : 'public' }) });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        setPrivate(!next);
        props.onAviso(body?.message ?? 'No se pudo cambiar.');
      }
    } catch {
      setPrivate(!next);
      props.onAviso('Sin conexión. Prueba de nuevo.');
    } finally {
      setSaving(false);
    }
  };
  const hint = props.isGeneral ? '#general es de todo el espacio: siempre es público.' : isPrivate ? 'Solo lo ven sus miembros; nadie más lo encuentra en «Canales».' : 'Cualquiera del espacio lo encuentra en «Canales» y se une.';
  return (
    <label data-testid="fila-canal-privado" className={`mt-2 flex min-h-[64px] items-center gap-4 bg-surface px-6 py-2 ${canChange ? 'cursor-pointer' : ''}`}>
      <Lock size={18} className="shrink-0 text-on-surface-variant" />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px]">Canal privado</span>
        <span className="block text-[12px] text-on-surface-variant">{canChange || props.isGeneral ? hint : `${hint} Solo los admins del canal pueden cambiarlo.`}</span>
      </span>
      <input type="checkbox" role="switch" data-testid="interruptor-canal-privado" checked={isPrivate} disabled={!canChange || saving} onChange={() => void change(!isPrivate)} className="h-5 w-5 accent-primary" />
    </label>
  );
}
