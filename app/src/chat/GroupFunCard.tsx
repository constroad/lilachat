import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Interruptor } from '../ui/Interruptor';
import { BASE_URL } from '../api/client';

const SAVE_TIMEOUT_MS = 10_000;

/**
 * «Diversión» in the group info (design `m-05-ajustes-diversion`; José, 21/10):
 * nudges and winks in a group, switched on or off by an admin for everyone.
 * Everyone sees it; only admins can move it. The server checks it too
 * (`PATCH /api/chats/:id/fun`). The design's «Quién puede mandarlos» has no
 * backend: it is not drawn.
 */
export function GroupFunCard(props: { chatId: string; jwt: string; allowed: boolean; isAdmin: boolean }) {
  const [allowed, setAllowed] = useState(props.allowed);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setAllowed(props.allowed);
  }, [props.allowed]);

  const change = async (next: boolean) => {
    setAllowed(next);
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`${BASE_URL}/api/chats/${props.chatId}/fun`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${props.jwt}` },
        body: JSON.stringify({ allowed: next }),
        signal: AbortSignal.timeout(SAVE_TIMEOUT_MS),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        setAllowed(!next);
        setError(body?.message ?? 'No se pudo cambiar.');
      }
    } catch {
      setAllowed(!next);
      setError('Sin conexión. Prueba de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View testID="tarjeta-diversion" className="mx-4 mt-4 overflow-hidden rounded-xl border border-outline/15 bg-surface">
      <View className="h-[3px] bg-primary" />
      <View className="p-4">
        <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">Diversión</Text>
        <View className="mt-2 flex-row items-center gap-3">
          <View className="min-w-0 flex-1">
            <Text className="text-[16px] font-bold text-on-surface">Zumbidos y guiños</Text>
            <Text className="mt-1 text-[13px] text-on-surface-variant">
              {props.isAdmin ? 'Solo los admins pueden cambiarlo. Apagado, nadie del grupo puede mandarlos.' : 'Solo los admins pueden cambiarlo.'}
            </Text>
          </View>
          <Interruptor testID="switch-diversion" value={allowed} onValueChange={(next) => void change(next)} disabled={!props.isAdmin || saving} />
        </View>
        {error ? <Text className="mt-2 text-[13px] text-error">{error}</Text> : null}
      </View>
    </View>
  );
}
