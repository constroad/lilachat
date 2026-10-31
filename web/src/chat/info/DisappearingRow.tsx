import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';
import { DISAPPEAR_OPTIONS, disappearDetail, disappearKeyOf, isDisappearKey, type DisappearKey } from '@lilachat/shared';

/**
 * «Mensajes temporales» in the chat info (R31/10-B6, like WhatsApp): 24 hours,
 * 7 days, 90 days or off, for everyone in the chat. In a group only who may
 * edit its info moves it; the server checks it too (`PUT /api/chats/:id/disappearing`).
 */
export function DisappearingRow(props: { chatId: string; jwt: string; seconds: number; canChange: boolean; onAviso: (text: string) => void }) {
  const [key, setKey] = useState<DisappearKey>(disappearKeyOf(props.seconds));
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setKey(disappearKeyOf(props.seconds));
  }, [props.seconds]);
  const change = async (next: DisappearKey) => {
    const before = key;
    setKey(next);
    setSaving(true);
    try {
      const response = await fetch(`/api/chats/${props.chatId}/disappearing`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${props.jwt}` }, body: JSON.stringify({ key: next }) });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        setKey(before);
        props.onAviso(body?.message ?? 'No se pudo cambiar.');
      }
    } catch {
      setKey(before);
      props.onAviso('Sin conexión. Prueba de nuevo.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <label data-testid="fila-temporales" className="mt-2 flex min-h-[64px] items-center gap-4 bg-surface px-6 py-2">
      <Timer size={18} className="shrink-0 text-on-surface-variant" />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px]">Mensajes temporales</span>
        <span className="block text-[12px] text-on-surface-variant">{disappearDetail(key, props.canChange)}</span>
      </span>
      <select
        data-testid="select-temporales"
        aria-label="Mensajes temporales"
        value={key}
        disabled={!props.canChange || saving}
        onChange={(event) => isDisappearKey(event.target.value) && void change(event.target.value)}
        className="h-9 rounded-lg border border-outline/30 bg-surface px-2 text-[14px]"
      >
        {DISAPPEAR_OPTIONS.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
