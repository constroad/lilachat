import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { answerOfOutcome, matchCommands, parseSlashInput, slashQuery, withAnswer, withNotice, type CommandGroup, type CommandNotice, type EphemeralAnswer } from '@lilachat/shared';
import { currentSocket } from '../../useSocket';
import { runCommand, spaceCommands } from './commandsApi';

export type ChatCommands = ReturnType<typeof useChatCommands>;

/**
 * The «/» of a space's chat (§c-bis), like the app's: the commands are asked
 * once, at the first slash; the answers only I see live here and are gone on
 * reload. On the web the panel also answers to the keyboard.
 */
export function useChatCommands(params: { jwt?: string; chatId: string; workspaceId?: string }) {
  const { jwt, chatId, workspaceId } = params;
  const [groups, setGroups] = useState<CommandGroup[]>([]);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [answers, setAnswers] = useState<EphemeralAnswer[]>([]);
  const asked = useRef(false);
  const enabled = Boolean(workspaceId && jwt);

  const load = useCallback(async () => {
    if (!workspaceId || !jwt || asked.current) return;
    asked.current = true;
    const result = await spaceCommands(jwt, workspaceId);
    if (result.ok) setGroups(result.data.groups);
    else asked.current = false; // try again on the next slash
  }, [jwt, workspaceId]);

  const onType = useCallback(
    (text: string) => {
      if (!enabled) return;
      const next = slashQuery(text);
      if (next !== null) void load();
      setQuery((current) => (current === next ? current : next));
      setActive(0);
    },
    [enabled, load]
  );

  const suggestions = useMemo(() => (query === null ? [] : matchCommands(groups, query)), [groups, query]);
  const flat = useMemo(() => suggestions.flatMap((group) => group.commands.map((entry) => entry.command)), [suggestions]);

  /** ↑↓ move, Tab or Enter complete the active one, Escape closes. True when the key was the panel's. */
  const onKey = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>, pick: (command: string) => void) => {
      if (flat.length === 0) return false;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setActive((index) => (index + (event.key === 'ArrowDown' ? 1 : flat.length - 1)) % flat.length);
        return true;
      }
      if (event.key === 'Tab' || (event.key === 'Enter' && !event.shiftKey)) {
        event.preventDefault();
        pick(flat[Math.min(active, flat.length - 1)]!);
        return true;
      }
      if (event.key === 'Escape') {
        setQuery(null);
        return true;
      }
      return false;
    },
    [flat, active]
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
      if (!found || !jwt) return false;
      setQuery(null);
      const result = await runCommand(jwt, chatId, found);
      if (!result.ok) {
        setAnswers((list) => withAnswer(list, { commandId: `local-${Date.now()}`, appName: 'Lilachat', command: found.command, state: 'failed', message: result.message }));
        return false;
      }
      const answer = answerOfOutcome(result.data, found.command);
      if (answer) setAnswers((list) => withAnswer(list, answer));
      return true;
    },
    [find, jwt, chatId]
  );

  useEffect(() => {
    const socket = currentSocket();
    if (!socket || !enabled) return;
    const onNotice = (notice: CommandNotice) => {
      if (notice.chatId === chatId) setAnswers((list) => withNotice(list, notice));
    };
    socket.on('command.response', onNotice);
    return () => {
      socket.off('command.response', onNotice);
    };
  }, [chatId, enabled]);

  const dismiss = useCallback((commandId: string) => setAnswers((list) => list.filter((entry) => entry.commandId !== commandId)), []);
  const isCommand = useCallback((text: string) => find(text) !== null, [find]);
  return { enabled, suggestions, activeCommand: flat[Math.min(active, flat.length - 1)] ?? null, onType, onKey, isCommand, run, answers, dismiss, jwt: jwt ?? '', chatId };
}
