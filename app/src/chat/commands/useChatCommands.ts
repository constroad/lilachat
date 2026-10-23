import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { answerOfOutcome, commandOf, matchCommands, replaceAnswer, parseSlashInput, slashQuery, withAnswer, withNotice, type CommandGroup, type CommandNotice, type EphemeralAnswer } from '@lilachat/shared';
import { getSocket } from '../socketClient';
import { runCommand, shareCommandAnswer, spaceCommands } from './commandsApi';

export type ChatCommands = ReturnType<typeof useChatCommands>;

/**
 * The «/» of a space's chat (§c-bis): the commands are asked once, the first
 * time a line starts with a slash (never polled); the answers only I see live
 * here and die with the screen, like Slack's.
 */
export function useChatCommands(params: { jwt: string; chatId: string; workspaceId?: string | null; /** A channel or a group: what only I saw can be sent there. */ shareable?: boolean }) {
  const { jwt, chatId, workspaceId } = params;
  const [groups, setGroups] = useState<CommandGroup[]>([]);
  const [query, setQuery] = useState<string | null>(null);
  const [answers, setAnswers] = useState<EphemeralAnswer[]>([]);
  const loaded = useRef<CommandGroup[] | null>(null);
  const inflight = useRef<Promise<CommandGroup[] | null> | null>(null);

  /** Asked once, at the first slash; the send waits for it (a fast «/clima» + Enter went to the channel as text, 23/10). */
  const load = useCallback(async (): Promise<CommandGroup[] | null> => {
    if (!workspaceId) return null;
    if (loaded.current) return loaded.current;
    inflight.current ??= spaceCommands(jwt, workspaceId).then((result) => {
      inflight.current = null; // a failure asks again on the next slash
      if (!result.ok) return null;
      loaded.current = result.data.groups;
      setGroups(result.data.groups);
      return result.data.groups;
    });
    return inflight.current;
  }, [jwt, workspaceId]);

  /** Called on every keystroke: it only sets state when the slash query changes. */
  const onType = useCallback(
    (text: string) => {
      if (!workspaceId) return;
      const next = slashQuery(text);
      if (next !== null) void load();
      setQuery((current) => (current === next ? current : next));
    },
    [workspaceId, load]
  );

  /**
   * A line that starts with «/»: once the space's commands are known, sends it
   * to its app; `not-command` when no app has it (it goes to the chat as text);
   * false (the text goes back to the field) if it did not reach the server.
   */
  const runIfCommand = useCallback(
    async (text: string): Promise<boolean | 'not-command'> => {
      if (!workspaceId || !parseSlashInput(text)) return 'not-command';
      const known = await load();
      const found = known ? commandOf(known, text) : null;
      if (!found) return 'not-command';
      setQuery(null);
      // At once, before the app answers (José, 23/10: no sign it was thinking).
      const placeholderId = `sending-${Date.now()}`;
      setAnswers((list) => withAnswer(list, { commandId: placeholderId, appName: known!.find((group) => group.appId === found.appId)?.appName ?? 'La app', command: found.command, state: 'pending' }));
      const result = await runCommand(jwt, chatId, found);
      if (!result.ok) {
        setAnswers((list) => replaceAnswer(list, placeholderId, { commandId: `local-${Date.now()}`, appName: 'Lilachat', command: found.command, state: 'failed', message: result.message ?? 'No se pudo mandar el comando.' }));
        return false;
      }
      setAnswers((list) => replaceAnswer(list, placeholderId, answerOfOutcome(result.data, found.command)));
      return true;
    },
    [workspaceId, load, jwt, chatId]
  );

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !workspaceId) return;
    const onNotice = (notice: CommandNotice) => {
      if (notice.chatId === chatId) setAnswers((list) => withNotice(list, notice));
    };
    // A manifest or the commands changed (23/10): the list already read is stale; read again if it was in use.
    const onAppsChanged = (frame: { workspaceId?: string }) => {
      if (frame.workspaceId !== workspaceId || !loaded.current) return;
      loaded.current = null;
      void load();
    };
    socket.on('command.response', onNotice);
    socket.on('workspace.apps.changed', onAppsChanged);
    return () => {
      socket.off('command.response', onNotice);
      socket.off('workspace.apps.changed', onAppsChanged);
    };
  }, [chatId, workspaceId, load]);

  const suggestions = useMemo(() => (query === null ? [] : matchCommands(groups, query)), [groups, query]);
  const dismiss = useCallback((commandId: string) => setAnswers((list) => list.filter((entry) => entry.commandId !== commandId)), []);
  /** «Enviar al canal» (José, 23/10): once posted, the card leaves the «only you» list. Null when it went; the reason when not. */
  const share = useCallback(
    async (commandId: string): Promise<string | null> => {
      const result = await shareCommandAnswer(jwt, chatId, commandId);
      if (!result.ok) return result.message ?? 'No se pudo enviar.';
      setAnswers((list) => list.filter((entry) => entry.commandId !== commandId));
      return null;
    },
    [jwt, chatId]
  );
  return { enabled: Boolean(workspaceId), suggestions, onType, runIfCommand, answers, dismiss, share: params.shareable ? share : undefined };
}
