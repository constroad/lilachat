import type { EphemeralAnswer } from './botCommands.js';
import { botCardSummary } from './bots.js';

/**
 * «Solo tú ves esto» as a stack of chips, like Claude's (José, 28/10, pending
 * 104; design c-01): one answer open, the rest folded in one line each, every
 * one with its X and «Cerrar todas» on top. A new answer opens by itself.
 */
export type StackChoice = { open: string | null; newest: string | null };

const newestOf = (answers: readonly EphemeralAnswer[]): string | null => answers.at(-1)?.commandId ?? null;

export function openAnswerId(answers: readonly EphemeralAnswer[], choice: StackChoice): string | null {
  const newest = newestOf(answers);
  if (newest !== choice.newest) return newest;
  return choice.open && answers.some((answer) => answer.commandId === choice.open) ? choice.open : null;
}

/** Tapping a chip opens it and folds the rest; tapping the open one folds it. */
export function toggleAnswer(answers: readonly EphemeralAnswer[], choice: StackChoice, commandId: string): StackChoice {
  return { open: openAnswerId(answers, choice) === commandId ? null : commandId, newest: newestOf(answers) };
}

export const canCloseAll = (answers: readonly EphemeralAnswer[]): boolean => answers.length >= 2;

/** The action of the ⚡ or the «+» it came from, or its «/command». */
export const ephemeralLabel = (answer: Pick<EphemeralAnswer, 'action' | 'command'>): string => answer.action ?? (answer.command ? `/${answer.command}` : '');

/** What a folded chip says in one line. */
export function ephemeralSummary(answer: EphemeralAnswer): string {
  if (answer.state === 'pending') return `${answer.appName} está trabajando…`;
  if (answer.state === 'failed') return answer.message ?? `${answer.appName} no pudo responder.`;
  if (answer.state === 'form') return `Abrir «${answer.response?.form?.title ?? 'formulario'}»`;
  const firstLine = answer.response?.text?.split('\n').map((line) => line.trim()).find(Boolean);
  return firstLine ?? (answer.response?.card ? botCardSummary(answer.response.card) : '');
}
