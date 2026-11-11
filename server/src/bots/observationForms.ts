import { OBSERVATION_NOTE_MAX, OBSERVATIONS_OPEN_HERE, type AppForm, type FormSchema } from '@lilachat/shared';

/**
 * Registering and lifting an observation from the client's channel (José
 * 11/11, designs `ob-02` and `ob-03`; Portal ead85b1a, agentes 506f753). Each
 * opens as a form of the app whose only field is the note; the service, the
 * entry and the place ride as context, which lands in the tool's values.
 * Portal's schemas are strict: nothing else goes.
 */
export const REGISTER_OBSERVATION_TOOL = 'registrar_observacion';
export const LIFT_OBSERVATION_TOOL = 'levantar_observacion';
const KINDS = ['observation_register', 'observation_lift'] as const;
const ID_MAX = 64;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ObservationFormInput =
  | { kind: 'observation_register'; entryId: string; lat: number; lng: number; reportId: string | null }
  | { kind: 'observation_lift'; observationId: string; reportId: string | null };
export type ObservationFormContext = Record<string, string | number>;

const NOTE: FormSchema = { type: 'object', properties: { nota: { type: 'string', title: '¿Qué se observa?', maxLength: OBSERVATION_NOTE_MAX } } };
const LIFT_NOTE: FormSchema = { type: 'object', properties: { nota: { type: 'string', title: 'Cómo se corrigió', maxLength: OBSERVATION_NOTE_MAX } } };

const idOf = (raw: unknown): string => (typeof raw === 'string' && raw.trim().length <= ID_MAX ? raw.trim() : '');
const coordinate = (raw: unknown, limit: number): number | null => (typeof raw === 'number' && Number.isFinite(raw) && Math.abs(raw) <= limit ? raw : null);

/** Off until José approves Portal's tools: the kinds do not exist meanwhile (`OBSERVATIONS_OPEN_HERE`). */
export const isObservationFormKind = (kind: unknown): kind is ObservationFormInput['kind'] => OBSERVATIONS_OPEN_HERE && KINDS.includes(kind as ObservationFormInput['kind']);

/** What the phone asked; an entry that is not a uuid or a place off the map is a 400 before the door. */
export function observationFormInputOf(raw: Record<string, unknown>): ObservationFormInput | null {
  const reportId = idOf(raw.report_id) || null;
  if (raw.kind === 'observation_lift') {
    const observationId = idOf(raw.observation_id);
    return observationId ? { kind: 'observation_lift', observationId, reportId } : null;
  }
  const [lat, lng] = [coordinate(raw.lat, 90), coordinate(raw.lng, 180)];
  const entryId = typeof raw.entry_id === 'string' && UUID.test(raw.entry_id) ? raw.entry_id : '';
  return entryId && lat !== null && lng !== null ? { kind: 'observation_register', entryId, lat, lng, reportId } : null;
}

export function observationFormPrepared(serviceId: string, input: ObservationFormInput): { form: AppForm; context: ObservationFormContext } {
  const report: ObservationFormContext = input.reportId ? { informeId: input.reportId } : {};
  if (input.kind === 'observation_lift') {
    return { form: { id: LIFT_OBSERVATION_TOOL, title: 'Levantar observación', submitLabel: 'Marcar como levantada', schema: LIFT_NOTE }, context: { servicioId: serviceId, observacionId: input.observationId, ...report } };
  }
  return { form: { id: REGISTER_OBSERVATION_TOOL, title: 'Nueva observación', submitLabel: 'Registrar observación', schema: NOTE }, context: { servicioId: serviceId, entradaId: input.entryId, lat: input.lat, lng: input.lng, ...report } };
}
