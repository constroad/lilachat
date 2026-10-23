import { useEffect, useState } from 'react';
import { Cake } from 'lucide-react';

/**
 * «Cumpleaños» in the chat info (pending 17): on, the day of each member's
 * birthday the chat says so at 8:00 and everyone sees the card once. A group's
 * admins decide; in a 1:1, either of the two. The server checks it too.
 */
export function BirthdaysRow(props: { chatId: string; jwt: string; on: boolean; canChange: boolean; onAviso: (text: string) => void }) {
  const [on, setOn] = useState(props.on);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setOn(props.on);
  }, [props.on]);
  const change = async (next: boolean) => {
    setOn(next);
    setSaving(true);
    try {
      const response = await fetch(`/api/chats/${props.chatId}/birthdays`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${props.jwt}` }, body: JSON.stringify({ on: next }) });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        setOn(!next);
        props.onAviso(body?.message ?? 'No se pudo cambiar.');
      }
    } catch {
      setOn(!next);
      props.onAviso('Sin conexión. Prueba de nuevo.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <label data-testid="fila-cumpleanos" className={`mt-2 flex min-h-[64px] items-center gap-4 bg-surface px-6 py-2 ${props.canChange ? 'cursor-pointer' : ''}`}>
      <Cake size={18} className="shrink-0 text-on-surface-variant" />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px]">Avisar los cumpleaños</span>
        <span className="block text-[12px] text-on-surface-variant">{props.canChange ? 'El día de cada uno, el chat lo dice a las 8:00.' : 'Solo los admins pueden cambiarlo.'}</span>
      </span>
      <input type="checkbox" role="switch" data-testid="interruptor-cumpleanos" checked={on} disabled={!props.canChange || saving} onChange={() => void change(!on)} className="h-5 w-5 accent-primary" />
    </label>
  );
}
