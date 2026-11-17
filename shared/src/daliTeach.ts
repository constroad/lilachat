/**
 * What the web and the APK say around agentes' answers in «Lo que Dali sabe» (dl-12) and «Enseñarle a Dali» (dl-13):
 * how many times a question was asked, what a form lacks, and why a call to Dali failed. When agentes is down the
 * server answers 502: the screens say Dali did not answer, never an empty list as if Dali knew nothing. PURE.
 */

/** The limits `validateFaqAdd` applies to a taught answer (a test pins them to it). */
export const TEACH_QUESTION_MAX = 200;
export const TEACH_ANSWER_MAX = 1000;

/** agentes did not answer in its 8 s (`dali_unreachable`). */
const DALI_DOWN_STATUS = 502;
type DaliCall = 'knowledge' | 'teach';
const DALI_DOWN: Record<DaliCall, string> = {
  knowledge: 'Dali no respondió. Vuelve a intentarlo en un momento.',
  teach: 'Dali no respondió. Inténtalo en un momento.',
};
const NO_REASON: Record<DaliCall, string> = {
  knowledge: 'Inténtalo de nuevo en un momento.',
  teach: 'No se pudo guardar. Inténtalo de nuevo.',
};

/** «1 vez», «3 veces». */
export const askedTimesText = (count: number): string => (count === 1 ? '1 vez' : `${count} veces`);

/** Under a question the review brings fixed: how often it was asked this week, and what Dali told the client. */
export const askedNoteOf = (count: number | undefined): string =>
  `La preguntaron ${count && count > 1 ? `${count} veces` : 'una vez'} esta semana · Dali dijo que lo consultaba con un asesor.`;

/** What a taught answer lacks before it goes; `null` when it can go. */
export const teachProblemOf = (question: string, answer: string): string | null =>
  question.trim() && answer.trim() ? null : 'Escribe la pregunta y lo que debe responder Dali.';

/** Why a call to Dali failed, said to the person: Dali down (502), the server's own reason, or a plain retry. */
export function daliFailureOf(answer: { status?: number; message?: string }, call: DaliCall): string {
  if (answer.status === DALI_DOWN_STATUS) return DALI_DOWN[call];
  return answer.message || NO_REASON[call];
}
