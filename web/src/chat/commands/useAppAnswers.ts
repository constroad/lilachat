import { useCallback, useEffect, useRef, useState } from 'react';
import { answerOfOutcome, formSubmitOutcome, giveUpPending, giveUpWaiting, markWaiting, PENDING_GIVE_UP_MS, replaceAnswer, withAnswer, withNotice, WRITE_GIVE_UP_MS, type CommandNotice, type CommandOutcome, type CommandScope, type EphemeralAnswer, type FormSubmitOutcome, type FormValues, type GeoPoint, type ShortcutRow } from '@lilachat/shared';
import type { ApiResult } from '../../api';
import { currentSocket } from '../../useSocket';
import { runShortcut, submitAppForm, uploadFormPhoto } from './commandsApi';

export type AppAnswers = ReturnType<typeof useAppAnswers>;

const scopeKey = (scope: CommandScope) => ('chatId' in scope ? `c:${scope.chatId}` : `s:${scope.workspaceId}`);
/** A late answer belongs here: the chat's, or the space's when it came from the ⚡ (no chat). */
const noticeIsFor = (notice: CommandNotice, scope: CommandScope) => ('chatId' in scope ? notice.chatId === scope.chatId : !notice.chatId && notice.workspaceId === scope.workspaceId);

/**
 * What the apps answered only to me in one place (a chat, or the space's ⚡):
 * the «está trabajando…» card at once, the answer in its place, late ones
 * from the socket, and the app's form opened on its own (R160, design e-28).
 */
export function useAppAnswers(params: { jwt?: string; scope: CommandScope | null }) {
  const { jwt, scope } = params;
  const key = scope ? scopeKey(scope) : '';
  const [answers, setAnswers] = useState<EphemeralAnswer[]>([]);
  const [openFormId, setOpenFormId] = useState<string | null>(null);
  // Its owner builds the scope on every render; the socket listener follows its key.
  const scopeRef = useRef(scope);
  scopeRef.current = scope;

  useEffect(() => {
    setAnswers([]);
    setOpenFormId(null);
  }, [key]);

  /** The card while the app thinks (José, 23/10: no sign it was thinking), swapped for what the server said. */
  const track = useCallback(async (start: { appName: string; command: string; action?: string; avatarUrl?: string }, call: () => Promise<ApiResult<CommandOutcome>>): Promise<boolean> => {
    const placeholderId = `sending-${Date.now()}`;
    const label = start.action ? { action: start.action } : {};
    const logo = start.avatarUrl ? { avatarUrl: start.avatarUrl } : {};
    setAnswers((list) => withAnswer(list, { commandId: placeholderId, appName: start.appName, command: start.command, ...label, ...logo, state: 'pending' }));
    const result = await call();
    if (!result.ok) {
      setAnswers((list) => replaceAnswer(list, placeholderId, { commandId: `local-${Date.now()}`, appName: 'Lilachat', command: start.command, ...label, state: 'failed', message: result.message }));
      return false;
    }
    const answer = answerOfOutcome(result.data, start.command);
    setAnswers((list) => replaceAnswer(list, placeholderId, answer ? { ...answer, ...label } : null));
    if (answer?.state === 'form') setOpenFormId(answer.commandId);
    return true;
  }, []);

  const runAction = useCallback(
    (row: ShortcutRow) => (jwt && scope ? track({ ...(row.kind === 'command' ? { appName: row.appName, command: row.key } : { appName: row.appName, command: '', action: row.name }), ...(row.avatarUrl ? { avatarUrl: row.avatarUrl } : {}) }, () => runShortcut(jwt, scope, row)) : Promise.resolve(false)),
    [jwt, scope, track]
  );

  const uploadPhoto = useCallback(
    (commandId: string, file: Blob, stamp?: GeoPoint) => (jwt && scope ? uploadFormPhoto(jwt, scope, commandId, file, stamp) : Promise.resolve({ ok: false as const, message: 'Sin sesión.' })),
    [jwt, scope]
  );

  /** Done: the app's answer takes the form's place and the dialog closes; otherwise what to fix. */
  const submitForm = useCallback(
    async (answer: EphemeralAnswer, values: FormValues): Promise<FormSubmitOutcome> => {
      if (!jwt || !scope) return { done: false, errors: {}, message: 'Sin sesión.' };
      const outcome = formSubmitOutcome(await submitAppForm(jwt, scope, answer.commandId, values), answer.command);
      // Answered later by /respond: the sheet stays open with «Enviando…» until the answer or the errors arrive.
      if (!outcome.done && outcome.waiting) setAnswers((list) => markWaiting(list, answer.commandId));
      if (outcome.done) {
        const label = answer.action ? { action: answer.action } : {};
        setAnswers((list) => replaceAnswer(list, answer.commandId, outcome.answer ? { ...outcome.answer, ...label } : null));
        // The app answered with the next form (the code after the destination): it opens on its own.
        setOpenFormId(outcome.answer?.state === 'form' ? outcome.answer.commandId : null);
      }
      return outcome;
    },
    [jwt, scope]
  );

  useEffect(() => {
    const socket = currentSocket();
    if (!socket || !key || !jwt) return;
    const onNotice = (notice: CommandNotice) => {
      if (!scopeRef.current || !noticeIsFor(notice, scopeRef.current)) return;
      setAnswers((list) => withNotice(list, notice));
      if (notice.response.form) setOpenFormId(notice.commandId);
    };
    socket.on('command.response', onNotice);
    return () => {
      socket.off('command.response', onNotice);
    };
  }, [key, jwt]);

  const dismiss = useCallback((commandId: string) => {
    setAnswers((list) => list.filter((entry) => entry.commandId !== commandId));
    setOpenFormId((open) => (open === commandId ? null : open));
  }, []);
  const removeAnswer = useCallback((commandId: string) => setAnswers((list) => list.filter((entry) => entry.commandId !== commandId)), []);
  /** A line from Lilachat itself on top of the composer (pending 102: «/kardex no es un comando de este chat»). */
  const say = useCallback((command: string, message: string) => setAnswers((list) => withAnswer(list, { commandId: `local-${Date.now()}`, appName: 'Lilachat', command, state: 'failed', message })), []);
  // «Working…» never stays forever (pending 103): past the wait it says the app did not answer.
  const giveUpTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    // A form that stopped waiting (answered, refused) loses its timer: sent again, it gets a fresh one.
    for (const [key, timer] of giveUpTimers.current) {
      if (key.startsWith('write:') && !answers.some((entry) => entry.waiting && `write:${entry.commandId}` === key)) {
        clearTimeout(timer);
        giveUpTimers.current.delete(key);
      }
    }
    for (const entry of answers) {
      // A sent form (a write) gives up sooner, and says to check before sending again (consensus 24/10).
      const timerKey = entry.waiting ? `write:${entry.commandId}` : entry.commandId;
      if ((entry.state !== 'pending' && !entry.waiting) || entry.commandId.startsWith('sending-') || giveUpTimers.current.has(timerKey)) continue;
      giveUpTimers.current.set(timerKey, entry.waiting ? setTimeout(() => setAnswers((list) => giveUpWaiting(list, entry.commandId)), WRITE_GIVE_UP_MS) : setTimeout(() => setAnswers((list) => giveUpPending(list, entry.commandId)), PENDING_GIVE_UP_MS));
    }
  }, [answers]);
  useEffect(() => {
    const timers = giveUpTimers.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
    };
  }, []);
  const openForm = answers.find((entry) => entry.commandId === openFormId && entry.state === 'form') ?? null;
  return { answers, track, runAction, uploadPhoto, submitForm, dismiss, removeAnswer, say, openForm, showForm: setOpenFormId };
}
