import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { commandOf, matchCommands, parseSlashInput, shortcutRows, slashQuery, unknownCommandMessage, type CommandGroup } from '@lilachat/shared';
import { getSocket } from '../socketClient';
import { runCommand, shareCommandAnswer, spaceCommands } from './commandsApi';
import { useAppAnswers } from './useAppAnswers';

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
  const scope = useMemo(() => ({ chatId }), [chatId]);
  const appAnswers = useAppAnswers({ jwt, scope: workspaceId ? scope : null });
  const loaded = useRef<CommandGroup[] | null>(null);
  const inflight = useRef<Promise<CommandGroup[] | null> | null>(null);

  /** Asked once, at the first slash; the send waits for it (a fast «/clima» + Enter went to the channel as text, 23/10). */
  const load = useCallback(async (): Promise<CommandGroup[] | null> => {
    if (!workspaceId) return null;
    if (loaded.current) return loaded.current;
    inflight.current ??= spaceCommands(jwt, workspaceId, { chatId }).then((result) => {
      inflight.current = null; // a failure asks again on the next slash
      if (!result.ok) return null;
      loaded.current = result.data.groups;
      setGroups(result.data.groups);
      return result.data.groups;
    });
    return inflight.current;
  }, [jwt, workspaceId, chatId]);

  // What is enabled depends on the chat (R160): another chat reads its own list.
  useEffect(() => {
    loaded.current = null;
    setGroups([]);
  }, [chatId, workspaceId]);

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
      // A command no app of this chat has is not sent as text (pending 102): it says which ones there are.
      if (!found && known) {
        appAnswers.say(parseSlashInput(text)!.command, unknownCommandMessage(parseSlashInput(text)!.command, known));
        return true;
      }
      if (!found) return 'not-command';
      setQuery(null);
      const group = known!.find((one) => one.appId === found.appId);
      return appAnswers.track({ appName: group?.appName ?? 'La app', command: found.command, ...(group?.avatarUrl ? { avatarUrl: group.avatarUrl } : {}) }, () => runCommand(jwt, chatId, found));
    },
    [workspaceId, load, jwt, chatId, appAnswers]
  );

  // A manifest or the commands changed (23/10): the list already read is stale; read again if it was in use.
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !workspaceId) return;
    const onAppsChanged = (frame: { workspaceId?: string }) => {
      if (frame.workspaceId !== workspaceId || !loaded.current) return;
      loaded.current = null;
      void load();
    };
    socket.on('workspace.apps.changed', onAppsChanged);
    return () => {
      socket.off('workspace.apps.changed', onAppsChanged);
    };
  }, [workspaceId, load]);

  const suggestions = useMemo(() => (query === null ? [] : matchCommands(groups, query)), [groups, query]);
  /** «Enviar al canal» (José, 23/10): once posted, the card leaves the «only you» list. Null when it went; the reason when not. */
  const share = useCallback(
    async (commandId: string): Promise<string | null> => {
      const result = await shareCommandAnswer(jwt, chatId, commandId);
      if (!result.ok) return result.message ?? 'No se pudo enviar.';
      appAnswers.removeAnswer(commandId);
      return null;
    },
    [jwt, chatId, appAnswers]
  );
  /** The «Acciones de las apps» of the «+» (design e-29): asked when the sheet opens. */
  const actions = useMemo(() => shortcutRows(groups), [groups]);
  return { enabled: Boolean(workspaceId), suggestions, onType, runIfCommand, answers: appAnswers.answers, dismiss: appAnswers.dismiss, appAnswers, actions, loadActions: load, share: params.shareable ? share : undefined };
}
