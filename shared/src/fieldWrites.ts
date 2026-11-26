import { AREA_WRITE } from './additionalArea.js';
import { newFieldJob, type FieldJob, type FieldJobFile } from './fieldQueue.js';
import type { WriteAnswer, WriteKind } from './formFilesWrite.js';
import { OBSERVATION_WRITE } from './observationWrite.js';

/**
 * An observation (REG-OBS / LEV-OBS) or an additional area (IAA) written without signal (José 26/11):
 * a field job that carries the request (with its `entry_id`: Portal finds the first one on a resend),
 * the form's values and each file with its own fields. Without `report_id` Portal files it in the
 * service's open report (`findOpenReport`, verified 26/11), so nothing waits for another job. PURE.
 */
export type FieldWriteName = 'observation' | 'area';
export type FieldWritePayload = { write: FieldWriteName; request: Record<string, unknown>; values: Record<string, string>; /** Each file's own form fields (`captura`), by its key. */ fileFields: Record<string, Record<string, string>> };

const KINDS: Record<FieldWriteName, WriteKind<WriteAnswer>> = { observation: OBSERVATION_WRITE, area: AREA_WRITE };
export const fieldWriteKindOf = (name: FieldWriteName): WriteKind<WriteAnswer> => KINDS[name];

const LABELS: Record<string, string> = { observation_register: 'Observación nueva', observation_lift: 'Observación levantada', area_create: 'Área adicional', area_edit: 'Área editada', area_remove: 'Área quitada' };
export const fieldWriteLabel = (request: { kind?: unknown }): string => LABELS[String(request.kind)] ?? 'Registro de campo';

export function fieldWriteJobOf(input: { key: string; scope: FieldJob['scope']; payload: FieldWritePayload; files: FieldJobFile[]; now: number }): FieldJob {
  return newFieldJob({ key: input.key, kind: 'observation', scope: input.scope, label: fieldWriteLabel(input.payload.request), payload: input.payload as unknown as Record<string, unknown>, files: input.files, now: input.now });
}
