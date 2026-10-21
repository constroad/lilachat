import { useEffect, useState } from 'react';
import { Smile } from 'lucide-react';

/**
 * «Zumbidos y guiños» in the group info (design `m-05-ajustes-diversion`; José,
 * 21/10): on or off for everyone, only an admin moves it, and the server checks
 * it too (`PATCH /api/chats/:id/fun`).
 */
export function GroupFunRow(props: { chatId: string; jwt: string; allowed: boolean; isAdmin: boolean; onAviso: (text: string) => void }) {
  const [allowed, setAllowed] = useState(props.allowed);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setAllowed(props.allowed);
  }, [props.allowed]);
  const change = async (next: boolean) => {
    setAllowed(next);
    setSaving(true);
    try {
      const response = await fetch(`/api/chats/${props.chatId}/fun`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${props.jwt}` }, body: JSON.stringify({ allowed: next }) });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        setAllowed(!next);
        props.onAviso(body?.message ?? 'No se pudo cambiar.');
      }
    } catch {
      setAllowed(!next);
      props.onAviso('Sin conexión. Prueba de nuevo.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <label data-testid="fila-diversion" className={`mt-2 flex min-h-[64px] items-center gap-4 bg-surface px-6 py-2 ${props.isAdmin ? 'cursor-pointer' : ''}`}>
      <Smile size={18} className="shrink-0 text-on-surface-variant" />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px]">Zumbidos y guiños</span>
        <span className="block text-[12px] text-on-surface-variant">{props.isAdmin ? 'Apagado, nadie del grupo puede mandarlos.' : 'Solo los admins pueden cambiarlo.'}</span>
      </span>
      <input type="checkbox" role="switch" data-testid="interruptor-diversion" checked={allowed} disabled={!props.isAdmin || saving} onChange={() => void change(!allowed)} className="h-5 w-5 accent-primary" />
    </label>
  );
}
