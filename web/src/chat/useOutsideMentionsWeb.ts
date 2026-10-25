import { useCallback, useEffect, useState } from 'react';
import { outsideMentionPrompt, type MencionElegida } from '@lilachat/shared';
import { api } from '../api';

/** How long «Carla se agregó al canal» stays before the line goes away. */
const DONE_MS = 2500;

/**
 * Slack's «X isn't in this channel — add them?» (José 25/10). After a message that mentioned people
 * of the space who are not in the chat, a line under the conversation says so and offers to add
 * them. The server decides who may add: its reason is shown as it comes.
 */
export function useOutsideMentionsWeb(params: { jwt: string; chatId: string }) {
  const { jwt, chatId } = params;
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

  const dismiss = useCallback(() => {
    setPeople([]);
    setError('');
  }, []);

  const add = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    const failed: MencionElegida[] = [];
    let reason = '';
    for (const person of people) {
      const result = await api(`/chats/${chatId}/members`, { body: { userId: person.userId }, jwt });
      if (!result.ok) {
        failed.push(person);
        reason ||= result.message || `No se pudo agregar a ${person.nombre}.`;
      }
    }
    setBusy(false);
    setPeople(failed);
    setError(reason);
    const added = people.filter((person) => !failed.includes(person));
    if (added.length > 0) setDone(added.length === 1 ? `${added[0]!.nombre} se agregó al canal.` : `${added.length} personas se agregaron al canal.`);
  };

  return { notify, dismiss, add, busy, error, done, prompt: outsideMentionPrompt(people.map((person) => person.nombre)) };
}

export type OutsideMentionsWeb = ReturnType<typeof useOutsideMentionsWeb>;
