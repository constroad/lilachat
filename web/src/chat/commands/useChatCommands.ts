import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { chatActionRows, commandOf, matchCommands, parseSlashInput, slashQuery, unknownCommandMessage, type CommandGroup } from '@lilachat/shared';
import { currentSocket } from '../../useSocket';
import { runCommand, shareCommandAnswer, spaceCommands } from './commandsApi';
import { useAppAnswers } from './useAppAnswers';

export type ChatCommands = ReturnType<typeof useChatCommands>;

/**
 * The «/» of a space's chat (§c-bis), like the app's: the commands are asked
 * once, at the first slash; the answers only I see live here and are gone on
 * reload. On the web the panel also answers to the keyboard.
 */
export function useChatCommands(params: { jwt?: string; chatId: string; workspaceId?: string; /** A channel or a group: what only I saw can be sent there. */ shareable?: boolean; /** A channel or the chat with an app: its actions are asked on open, for its ⚡ (R31/10). */ actionPlace?: boolean }) {
  const { jwt, chatId, workspaceId } = params;
  const [groups, setGroups] = useState<CommandGroup[]>([]);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const scope = useMemo(() => ({ chatId }), [chatId]);
  const appAnswers = useAppAnswers({ jwt, scope: workspaceId ? scope : null });
  const loaded = useRef<CommandGroup[] | null>(null);
  const inflight = useRef<Promise<CommandGroup[] | null> | null>(null);
  const enabled = Boolean(workspaceId && jwt);

  /** Asked once, at the first slash; the send waits for it (a fast «/clima» + Enter went to the channel as text, 23/10). */
  const load = useCallback(async (): Promise<CommandGroup[] | null> => {
    if (!workspaceId || !jwt) return null;
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

  // A chat that can have actions asks once on open: its ⚡ only shows when there is one (R31/10).
  useEffect(() => {
    if (params.actionPlace) void load();
  }, [params.actionPlace, load]);

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
      // A command no app of this chat has is not sent as text (pending 102): it says which ones there are.
      if (!found && known) {
        appAnswers.say(parseSlashInput(text)!.command, unknownCommandMessage(parseSlashInput(text)!.command, known));
        return true;
      }
      if (!found) return 'not-command';
      if (!jwt) return false;
      setQuery(null);
      const group = known!.find((one) => one.appId === found.appId);
      return appAnswers.track({ appName: group?.appName ?? 'La app', command: found.command, ...(group?.avatarUrl ? { avatarUrl: group.avatarUrl } : {}) }, () => runCommand(jwt, chatId, found));
    },
    [enabled, load, jwt, chatId, appAnswers]
  );

  // A manifest or the commands changed (23/10): the list already read is stale; read again if it was in use.
  useEffect(() => {
    const socket = currentSocket();
    if (!socket || !enabled) return;
    const onAppsChanged = (frame: { workspaceId?: string }) => {
      if (frame.workspaceId !== workspaceId || !loaded.current) return;
      loaded.current = null;
      void load();
    };
    socket.on('workspace.apps.changed', onAppsChanged);
    return () => {
      socket.off('workspace.apps.changed', onAppsChanged);
    };
  }, [enabled, workspaceId, load]);

  /** «Enviar al canal» (José, 23/10): once posted, the card leaves the «only you» list. Null when it went; the reason when not. */
  const share = useCallback(
    async (commandId: string): Promise<string | null> => {
      if (!jwt) return 'Sin sesión.';
      const result = await shareCommandAnswer(jwt, chatId, commandId);
      if (!result.ok) return result.message;
      appAnswers.removeAnswer(commandId);
      return null;
    },
    [jwt, chatId, appAnswers]
  );
  /** The chat's ⚡ (R31/10): its actions, asked on open in a channel or the chat with an app. */
  const actions = useMemo(() => chatActionRows(groups), [groups]);
  return { enabled, suggestions, activeCommand: flat[Math.min(active, flat.length - 1)] ?? null, onType, onKey, runIfCommand, answers: appAnswers.answers, dismiss: appAnswers.dismiss, appAnswers, actions, loadActions: load, share: params.shareable ? share : undefined, jwt: jwt ?? '', chatId };
}
