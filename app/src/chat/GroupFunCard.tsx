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
  return (
    <ChatToggleCard
      testID="tarjeta-diversion"
      switchTestID="switch-diversion"
      kicker="Diversión"
      title="Zumbidos y guiños"
      hint={props.isAdmin ? 'Solo los admins pueden cambiarlo. Apagado, nadie del grupo puede mandarlos.' : 'Solo los admins pueden cambiarlo.'}
      url={`${BASE_URL}/api/chats/${props.chatId}/fun`}
      body={(next) => ({ allowed: next })}
      jwt={props.jwt}
      value={props.allowed}
      canChange={props.isAdmin}
    />
  );
}

/**
 * «Cumpleaños» in the chat info (pending 17): on, the day of each member's
 * birthday the chat says so at 8:00 and everyone sees the card once. In a group
 * the admins decide; in a 1:1, either of the two. Off by default.
 */
/** Since 0.1.150 the chat decides (pending 71), and the day before the group's admins get a heads-up (pending 72). */
const birthdaysHint = (isGroup: boolean) =>
  isGroup ? 'El día de cada uno, el chat lo dice a las 8:00 y todos ven su tarjeta. Un día antes, avisa a los admins.' : 'El día de cada uno, el chat lo dice a las 8:00 y los dos ven su tarjeta.';

export function BirthdaysCard(props: { chatId: string; jwt: string; on: boolean; isGroup: boolean; isAdmin: boolean }) {
  const canChange = !props.isGroup || props.isAdmin;
  return (
    <ChatToggleCard
      testID="tarjeta-cumpleanos"
      switchTestID="switch-cumpleanos"
      kicker="Cumpleaños"
      title="Avisar los cumpleaños"
      hint={canChange ? birthdaysHint(props.isGroup) : 'Solo los admins pueden cambiarlo.'}
      url={`${BASE_URL}/api/chats/${props.chatId}/birthdays`}
      body={(next) => ({ on: next })}
      jwt={props.jwt}
      value={props.on}
      canChange={canChange}
    />
  );
}

/** A chat-wide switch saved on the server, with its own reason when it is refused. */
/**
 * «Canal privado» in a channel's info (pending 93; José, 23/10: a public channel
 * could not be made private). Only its admins move it; #general stays public.
 */
export function ChannelVisibilityCard(props: { chatId: string; jwt: string; isPrivate: boolean; isAdmin: boolean; isGeneral: boolean }) {
  const canChange = props.isAdmin && !props.isGeneral;
  const hint = props.isGeneral ? '#general es de todo el espacio: siempre es público.' : `Privado, solo lo ven sus miembros; público, cualquiera del espacio lo encuentra en «Canales».${canChange ? '' : ' Solo los admins del canal pueden cambiarlo.'}`;
  return (
    <ChatToggleCard
      testID="tarjeta-canal-privado"
      switchTestID="switch-canal-privado"
      kicker="Canal"
      title="Canal privado"
      hint={hint}
      url={`${BASE_URL}/api/chats/${props.chatId}`}
      body={(next) => ({ visibility: next ? 'private' : 'public' })}
      jwt={props.jwt}
      value={props.isPrivate}
      canChange={canChange}
    />
  );
}

function ChatToggleCard(props: { testID: string; switchTestID: string; kicker: string; title: string; hint: string; url: string; body: (next: boolean) => object; jwt: string; value: boolean; canChange: boolean }) {
  const [value, setValue] = useState(props.value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setValue(props.value);
  }, [props.value]);

  const change = async (next: boolean) => {
    setValue(next);
    setSaving(true);
    setError('');
    try {
      const response = await fetch(props.url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${props.jwt}` },
        body: JSON.stringify(props.body(next)),
        signal: AbortSignal.timeout(SAVE_TIMEOUT_MS),
      });
      if (!response.ok) {
        const reply = (await response.json().catch(() => null)) as { message?: string } | null;
        setValue(!next);
        setError(reply?.message ?? 'No se pudo cambiar.');
      }
    } catch {
      setValue(!next);
      setError('Sin conexión. Prueba de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View testID={props.testID} className="mx-4 mt-4 overflow-hidden rounded-xl border border-outline/15 bg-surface">
      <View className="h-[3px] bg-primary" />
      <View className="p-4">
        <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">{props.kicker}</Text>
        <View className="mt-2 flex-row items-center gap-3">
          <View className="min-w-0 flex-1">
            <Text className="text-[16px] font-bold text-on-surface">{props.title}</Text>
            <Text className="mt-1 text-[13px] text-on-surface-variant">{props.hint}</Text>
          </View>
          <Interruptor testID={props.switchTestID} value={value} onValueChange={(next) => void change(next)} disabled={!props.canChange || saving} />
        </View>
        {error ? <Text className="mt-2 text-[13px] text-error">{error}</Text> : null}
      </View>
    </View>
  );
}
