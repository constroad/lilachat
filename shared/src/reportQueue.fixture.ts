import type { CommandOutcome } from './botCommands';
import { fieldDocumentOf, type FieldDocument, type SectionPath } from './fieldDocument';
import type { ReportWire } from './reportQueue';
import { reportSaveOf, type ReportRef, type ReportSave } from './reportSaves';

/** A Portal and a disk for the tests of the queue and of the screen. */
const textForm = (name: string) => ({ type: 'object', properties: { [name]: { type: 'string', title: name } } });
const leaf = (id: string, values = {}) => ({ id, state: 'empty', values });
export type Tramo = { id: string; photos: number };
/** What Portal answers for the report as it stands. */
/** `requireLocation`: the photos ask for the device's fix, as a CTL-PIS unit does (06/11). */
const answerOf = (id: string | null, tramos: Tramo[], requireLocation = false) => ({
  id, type: 'CTL-IMP', title: 'Control de imprimación', status: 'draft',
  forms: { general: { type: 'object', properties: { liquido: { type: 'string', title: 'liquido' }, responsable: { type: 'string', title: 'responsable' } } }, ubicacion: textForm('tramo'), bandejas: textForm('peso'), fotos: { type: 'object', properties: { foto: { type: 'string', title: 'Foto', 'x-input': 'photo' } } } },
  sections: [
    { id: 'general', title: 'Datos generales', required: true, state: 'done', summary: [], results: [], form: 'general', values: {} },
    {
      id: 'tramos', kind: 'repeat', results: [], title: 'Tramos', required: true, state: 'partial', summary: [], itemTitle: 'Tramo', addLabel: 'Agregar', min: 1,
      template: [{ id: 'ubicacion', title: 'Ubicación', required: true, form: 'ubicacion' }, { id: 'bandejas', title: 'Bandejas', required: true, form: 'bandejas' }, { id: 'fotos', title: 'Fotos', required: false, form: 'fotos', tool: 'agregar_foto_de_informe', ...(requireLocation ? { photoKind: 'riego', requireLocation: true } : {}) }],
      items: tramos.map((tramo, index) => ({ id: tramo.id, title: `Tramo ${index + 1}`, summary: [], results: [], sections: [leaf('ubicacion'), leaf('bandejas'), leaf('fotos', { fotos: Array.from({ length: tramo.photos }, (_unused, photo) => ({ id: `f${photo}`, url: `https://x/${photo}.jpg` })) })] })),
    },
  ],
  publish: { label: 'Publicar informe', missing: [] },
});
export const docOf = (id: string | null, tramos: Tramo[], requireLocation = false): FieldDocument => fieldDocumentOf(answerOf(id, tramos, requireLocation))!;

export const ref: ReportRef = { spaceId: 's1', clientId: 'c1', chatId: 'ch1', serviceId: 'sv1', type: 'CTL-IMP' };
export const general: SectionPath = { sectionId: 'general', itemId: null, key: 'general' };
export const newTramo: SectionPath = { sectionId: 'tramos', itemId: null, key: 'ubicacion' };
export const saved: CommandOutcome = { commandId: 'run', appId: 'a', appName: 'Portal', outcome: 'ephemeral', response: { responseType: 'ephemeral', text: 'Guardado' } };
export const NOW = '2026-11-05T10:00:00.000Z';

/** A Portal that keeps a report: a section creates it, a `ubicacion` without tramo adds one, a photo goes to its tramo. */
export function fakePortal(start: { id: string | null; tramos: Tramo[]; /** As Portal does: a new report is born with one empty tramo. */ seedsTramo?: boolean; requireLocation?: boolean }) {
  const state = { ...start, tramos: start.tramos.map((one) => ({ ...one })), offline: false, reads: 0, writes: [] as string[], loseNextAnswer: false, refuse: null as Record<string, string> | null, status: null as number | null, /** Agentes' «too many calls», once: the seconds to wait. */ rateLimitOnce: null as number | null };
  const runs = new Map<string, { item_id: string | null; key: string; report_id?: string; removes?: string }>();
  const removed: string[] = [];
  let run = 0;
  const wire: ReportWire = {
    read: async () => {
      if (state.offline) return { ok: false, message: 'Sin conexión.' };
      state.reads += 1;
      return { ok: true, data: { document: answerOf(state.id, state.tramos, start.requireLocation) } };
    },
    open: async (_ref, request) => {
      if (state.offline) return { ok: false, message: 'Sin conexión.' };
      run += 1;
      runs.set(`run-${run}`, request.kind === 'section' ? { item_id: request.item_id, key: request.key, ...(request.report_id ? { report_id: request.report_id } : {}) } : { item_id: null, key: request.kind, report_id: request.report_id, ...(request.kind === 'remove_photo' ? { removes: request.photo_id } : {}) });
      return { ok: true, data: { ...saved, commandId: `run-${run}`, outcome: 'form', response: { responseType: 'form', form: { id: 'x', title: 'x', schema: { type: 'object' } } } } };
    },
    upload: async (_ref, commandId, photo) => (state.offline ? { ok: false, message: 'Sin conexión.' } : { ok: true, fileId: `file-of-${photo.ref}-${commandId}` }),
    submit: async (_ref, commandId, values) => {
      if (state.offline) return { ok: false, message: 'Sin conexión.' };
      if (state.status) return { ok: false, status: state.status, message: 'No' };
      if (state.refuse) return { ok: false, errors: state.refuse };
      if (state.rateLimitOnce !== null) {
        const retryAfterS = state.rateLimitOnce;
        state.rateLimitOnce = null;
        return { ok: false, status: 429, errors: { _: 'Demasiadas llamadas' }, code: 'rate_limited', retryAfterS };
      }
      const open = runs.get(commandId)!;
      if (open.removes) {
        removed.push(`${open.report_id}:${open.removes}`);
        state.tramos[0]!.photos -= 1;
        return { ok: true, outcome: saved };
      }
      state.writes.push(`${open.key}:${open.item_id ?? 'nuevo'}:${JSON.stringify(values)}`);
      if (!state.id) {
        state.id = 'r1';
        if (start.seedsTramo) state.tramos.push({ id: 't1', photos: 0 });
      }
      if (open.key === 'ubicacion' && !open.item_id) state.tramos.push({ id: `t${state.tramos.length + 1}`, photos: 0 });
      if (open.key === 'fotos') state.tramos.find((one) => one.id === open.item_id)!.photos += 1;
      if (state.loseNextAnswer) {
        state.loseNextAnswer = false;
        state.offline = true;
        return { ok: false, message: 'Sin conexión.' };
      }
      return { ok: true, outcome: saved };
    },
    notice: async () => null,
  };
  return { state, wire, removed };
}

export function fakeVault(saves: ReportSave[] = []) {
  const kept = { saves, documents: new Map<string, FieldDocument>(), dropped: [] as string[] };
  return {
    kept,
    vault: {
      load: async () => kept.saves,
      store: async (next: ReportSave[]) => { kept.saves = next; },
      loadDocument: async (key: string) => kept.documents.get(key) ?? null,
      storeDocument: async (key: string, document: FieldDocument) => { kept.documents.set(key, document); },
      dropPhoto: async (photo: string) => { kept.dropped.push(photo); },
    },
  };
}

export const saveOf = (document: FieldDocument, path: SectionPath, clientKey: string, values = {}) => reportSaveOf({ ref, document, path, values, clientKey, now: NOW });
export const photoOf = (document: FieldDocument, itemId: string, clientKey: string): ReportSave => ({
  ...saveOf(document, { sectionId: 'tramos', itemId, key: 'fotos' }, clientKey, { foto: `ref-${clientKey}`, descripcion: 'Riego' }),
  photo: { field: 'foto', ref: `ref-${clientKey}`, mime: 'image/jpeg', preview: 'file://x.jpg' },
  place: { at: NOW },
});

