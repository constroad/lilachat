import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { answerOfOutcome, matchCommands, parseSlashInput, slashQuery, withAnswer, withNotice, type CommandGroup, type CommandNotice, type EphemeralAnswer } from '@lilachat/shared';
import { getSocket } from '../socketClient';
import { runCommand, spaceCommands } from './commandsApi';

export type ChatCommands = ReturnType<typeof useChatCommands>;

/**
 * The «/» of a space's chat (§c-bis): the commands are asked once, the first
 * time a line starts with a slash (never polled); the answers only I see live
 * here and die with the screen, like Slack's.
 */
export function useChatCommands(params: { jwt: string; chatId: string; workspaceId?: string | null }) {
  const { jwt, chatId, workspaceId } = params;
  const [groups, setGroups] = useState<CommandGroup[]>([]);
  const [query, setQuery] = useState<string | null>(null);
  const [answers, setAnswers] = useState<EphemeralAnswer[]>([]);
  const asked = useRef(false);

  const load = useCallback(async () => {
    if (!workspaceId || asked.current) return;
    asked.current = true;
    const result = await spaceCommands(jwt, workspaceId);
    if (result.ok) setGroups(result.data.groups);
    else asked.current = false; // try again on the next slash
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

  const find = useCallback((text: string) => {
    const parsed = parseSlashInput(text);
    if (!parsed) return null;
    const group = groups.find((one) => one.commands.some((entry) => entry.command === parsed.command));
    return group ? { ...parsed, appId: group.appId } : null;
  }, [groups]);

  /** Sends it; false (the text goes back to the field) if it did not reach the server. */
  const run = useCallback(
    async (text: string): Promise<boolean> => {
      const found = find(text);
      if (!found) return false;
      setQuery(null);
      const result = await runCommand(jwt, chatId, found);
      if (!result.ok) {
        setAnswers((list) => withAnswer(list, { commandId: `local-${Date.now()}`, appName: 'Lilachat', command: found.command, state: 'failed', message: result.message ?? 'No se pudo mandar el comando.' }));
        return false;
      }
      const answer = answerOfOutcome(result.data, found.command);
      if (answer) setAnswers((list) => withAnswer(list, answer));
      return true;
    },
    [find, jwt, chatId]
  );

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !workspaceId) return;
    const onNotice = (notice: CommandNotice) => {
      if (notice.chatId === chatId) setAnswers((list) => withNotice(list, notice));
    };
    socket.on('command.response', onNotice);
    return () => {
      socket.off('command.response', onNotice);
    };
  }, [chatId, workspaceId]);

  const suggestions = useMemo(() => (query === null ? [] : matchCommands(groups, query)), [groups, query]);
  const dismiss = useCallback((commandId: string) => setAnswers((list) => list.filter((entry) => entry.commandId !== commandId)), []);
  const isCommand = useCallback((text: string) => find(text) !== null, [find]);
  return { enabled: Boolean(workspaceId), suggestions, onType, isCommand, run, answers, dismiss };
}
