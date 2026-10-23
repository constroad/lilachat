import { useCallback, useEffect, useRef, useState } from 'react';
import { answerOfOutcome, formSubmitOutcome, replaceAnswer, withAnswer, withNotice, type CommandNotice, type CommandOutcome, type CommandScope, type EphemeralAnswer, type FormSubmitOutcome, type FormValues, type ShortcutRow } from '@lilachat/shared';
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
  const track = useCallback(async (start: { appName: string; command: string; action?: string }, call: () => Promise<ApiResult<CommandOutcome>>): Promise<boolean> => {
    const placeholderId = `sending-${Date.now()}`;
    const label = start.action ? { action: start.action } : {};
    setAnswers((list) => withAnswer(list, { commandId: placeholderId, appName: start.appName, command: start.command, ...label, state: 'pending' }));
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
    (row: ShortcutRow) => (jwt && scope ? track(row.kind === 'command' ? { appName: row.appName, command: row.key } : { appName: row.appName, command: '', action: row.name }, () => runShortcut(jwt, scope, row)) : Promise.resolve(false)),
    [jwt, scope, track]
  );

  const uploadPhoto = useCallback(
    (commandId: string, file: Blob) => (jwt && scope ? uploadFormPhoto(jwt, scope, commandId, file) : Promise.resolve({ ok: false as const, message: 'Sin sesión.' })),
    [jwt, scope]
  );

  /** Done: the app's answer takes the form's place and the dialog closes; otherwise what to fix. */
  const submitForm = useCallback(
    async (answer: EphemeralAnswer, values: FormValues): Promise<FormSubmitOutcome> => {
      if (!jwt || !scope) return { done: false, errors: {}, message: 'Sin sesión.' };
      const outcome = formSubmitOutcome(await submitAppForm(jwt, scope, answer.commandId, values), answer.command);
      if (outcome.done) {
        const label = answer.action ? { action: answer.action } : {};
        setAnswers((list) => replaceAnswer(list, answer.commandId, outcome.answer ? { ...outcome.answer, ...label } : null));
        setOpenFormId(null);
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
  const openForm = answers.find((entry) => entry.commandId === openFormId && entry.state === 'form') ?? null;
  return { answers, track, runAction, uploadPhoto, submitForm, dismiss, removeAnswer, openForm, showForm: setOpenFormId };
}
