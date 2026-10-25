import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { outsideMentionPrompt, type MencionElegida } from '@lilachat/shared';
import { addChatMember } from '../api/client';
import { useColores } from '../ui/tema';

/** How long «Carla se agregó al canal» stays before the line goes away. */
const DONE_MS = 2500;

/**
 * Slack's «X isn't in this channel — add them?» (José 25/10). After a message that mentioned
 * people of the space who are not in the chat, a line under the conversation says so and offers
 * to add them. The server decides who may add: its reason is shown as it comes.
 */
export function useOutsideMentions(params: { jwt: string; chatId: string }) {
  const { jwt, chatId } = params;
  const colores = useColores();
  const [people, setPeople] = useState<MencionElegida[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  useEffect(() => {
    setPeople([]);
    setError('');
    setDone('');
  }, [chatId]);

  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => setDone(''), DONE_MS);
    return () => clearTimeout(timer);
  }, [done]);

  const notify = useCallback((mentioned: readonly MencionElegida[]) => {
    if (mentioned.length === 0) return;
    setError('');
    setDone('');
    setPeople([...mentioned]);
  }, []);

  const add = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    const failed: MencionElegida[] = [];
    let reason = '';
    for (const person of people) {
      const result = await addChatMember(jwt, chatId, person.userId);
      if (!result.ok) {
        failed.push(person);
        reason ||= result.message ?? `No se pudo agregar a ${person.nombre}.`;
      }
    }
    setBusy(false);
    setPeople(failed);
    setError(reason);
    const added = people.filter((person) => !failed.includes(person));
    if (added.length > 0) setDone(added.length === 1 ? `${added[0]!.nombre} se agregó al canal.` : `${added.length} personas se agregaron al canal.`);
  };

  const prompt = outsideMentionPrompt(people.map((person) => person.nombre));
  const banner =
    prompt || done ? (
      <View testID="aviso-mencion-fuera" className="gap-1 border-t border-outline/10 bg-surface px-4 py-2">
        <Text className="text-[13px] text-on-surface-variant">{prompt ? prompt.message : done}</Text>
        {error ? (
          <Text testID="error-mencion-fuera" className="text-[12px] text-error">
            {error}
          </Text>
        ) : null}
        {prompt ? (
          <View className="flex-row gap-4">
            <Pressable testID="btn-agregar-mencion-fuera" accessibilityRole="button" disabled={busy} onPress={() => void add()} hitSlop={8} className="min-h-[36px] justify-center">
              <Text style={{ color: colores.primary, opacity: busy ? 0.5 : 1 }} className="text-[14px] font-semibold">
                {busy ? 'Agregando…' : prompt.action}
              </Text>
            </Pressable>
            <Pressable testID="btn-descartar-mencion-fuera" accessibilityRole="button" onPress={() => { setPeople([]); setError(''); }} hitSlop={8} className="min-h-[36px] justify-center">
              <Text className="text-[14px] text-on-surface-variant">Ahora no</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    ) : null;

  return { notify, banner };
}
