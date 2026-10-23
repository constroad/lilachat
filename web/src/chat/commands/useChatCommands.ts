import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { answerOfOutcome, commandOf, matchCommands, replaceAnswer, parseSlashInput, slashQuery, withAnswer, withNotice, type CommandGroup, type CommandNotice, type EphemeralAnswer } from '@lilachat/shared';
import { currentSocket } from '../../useSocket';
import { runCommand, shareCommandAnswer, spaceCommands } from './commandsApi';

export type ChatCommands = ReturnType<typeof useChatCommands>;

/**
 * The «/» of a space's chat (§c-bis), like the app's: the commands are asked
 * once, at the first slash; the answers only I see live here and are gone on
 * reload. On the web the panel also answers to the keyboard.
 */
export function useChatCommands(params: { jwt?: string; chatId: string; workspaceId?: string; /** A channel or a group: what only I saw can be sent there. */ shareable?: boolean }) {
  const { jwt, chatId, workspaceId } = params;
  const [groups, setGroups] = useState<CommandGroup[]>([]);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [answers, setAnswers] = useState<EphemeralAnswer[]>([]);
  const loaded = useRef<CommandGroup[] | null>(null);
  const inflight = useRef<Promise<CommandGroup[] | null> | null>(null);
  const enabled = Boolean(workspaceId && jwt);

  /** Asked once, at the first slash; the send waits for it (a fast «/clima» + Enter went to the channel as text, 23/10). */
  const load = useCallback(async (): Promise<CommandGroup[] | null> => {
    if (!workspaceId || !jwt) return null;
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

  /**
   * A line that starts with «/»: once the space's commands are known, sends it
   * to its app; `not-command` when no app has it (it goes to the chat as text);
   * false (the text goes back to the field) if it did not reach the server.
   */
  const runIfCommand = useCallback(
    async (text: string): Promise<boolean | 'not-command'> => {
      if (!enabled || !parseSlashInput(text)) return 'not-command';
      const known = await load();
      const found = known ? commandOf(known, text) : null;
      if (!found) return 'not-command';
      if (!jwt) return false;
      setQuery(null);
      // At once, before the app answers (José, 23/10: no sign it was thinking).
      const placeholderId = `sending-${Date.now()}`;
      setAnswers((list) => withAnswer(list, { commandId: placeholderId, appName: known!.find((group) => group.appId === found.appId)?.appName ?? 'La app', command: found.command, state: 'pending' }));
      const result = await runCommand(jwt, chatId, found);
      if (!result.ok) {
        setAnswers((list) => replaceAnswer(list, placeholderId, { commandId: `local-${Date.now()}`, appName: 'Lilachat', command: found.command, state: 'failed', message: result.message }));
        return false;
      }
      setAnswers((list) => replaceAnswer(list, placeholderId, answerOfOutcome(result.data, found.command)));
      return true;
    },
    [enabled, load, jwt, chatId]
  );

  useEffect(() => {
    const socket = currentSocket();
    if (!socket || !enabled) return;
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
  }, [chatId, enabled, workspaceId, load]);

  const dismiss = useCallback((commandId: string) => setAnswers((list) => list.filter((entry) => entry.commandId !== commandId)), []);
  /** «Enviar al canal» (José, 23/10): once posted, the card leaves the «only you» list. Null when it went; the reason when not. */
  const share = useCallback(
    async (commandId: string): Promise<string | null> => {
      if (!jwt) return 'Sin sesión.';
      const result = await shareCommandAnswer(jwt, chatId, commandId);
      if (!result.ok) return result.message;
      setAnswers((list) => list.filter((entry) => entry.commandId !== commandId));
      return null;
    },
    [jwt, chatId]
  );
  return { enabled, suggestions, activeCommand: flat[Math.min(active, flat.length - 1)] ?? null, onType, onKey, runIfCommand, answers, dismiss, share: params.shareable ? share : undefined, jwt: jwt ?? '', chatId };
}
