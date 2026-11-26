import { STAGE_LABEL, levelOf, missingLabelsOf, overdueLabelOf, overdueOf, shownStageOf, type ProspectLevel, type ProspectStage, type ProspectView } from '@lilachat/shared';

/**
 * The ONE pill of an inbox row (dl-01 v4, José 26/11: «todo muy desordenado»): what to do with it. Late beats what is
 * missing, which beats the stage. The origin left the row: it is in the ficha. PURE.
 */
export type RowStatusTone = 'error' | 'warn' | 'neutral' | 'primary' | 'info' | 'ok';
export type RowStatus = { tone: RowStatusTone; text: string };

const STAGE_TONE: Record<ProspectStage, RowStatusTone> = { missing_info: 'neutral', to_quote: 'warn', visit: 'info', quoted: 'info', negotiation: 'primary', won: 'ok', lost: 'error' };

export function rowStatusOf(prospect: ProspectView, now: Date): RowStatus {
  const overdue = overdueOf(prospect, now);
  if (overdue) return { tone: 'error', text: `Vencido · ${overdueLabelOf(overdue, now)}` };
  const stage = shownStageOf(prospect);
  const missing = stage === 'missing_info' ? missingLabelsOf(prospect) : [];
  if (missing.length) return { tone: 'warn', text: `Falta: ${missing.join(', ')}` };
  if (stage === 'missing_info' && prospect.intent === 'information') return { tone: 'neutral', text: 'Solo consulta' };
  return { tone: STAGE_TONE[stage], text: STAGE_LABEL[stage] };
}

/** «Venta de mezcla · Mezcla 18 m³»: the service and what was asked, on one line. */
export function rowAskLineOf(prospect: Pick<ProspectView, 'service' | 'summary'>): string | null {
  const parts = [prospect.service?.name, prospect.summary?.trim()].filter((part): part is string => Boolean(part));
  return parts.length ? parts.join(' · ') : null;
}

/** The score as a number with the dot of its level (hot, warm, cold). */
export function rowScoreOf(score: number | undefined): { score: number; level: ProspectLevel } | null {
  const level = levelOf(score);
  return score === undefined || !level ? null : { score, level };
}
