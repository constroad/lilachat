import type { VisitPointDraft } from './siteVisit.js';
import type { EmbedLink } from './portalEmbed.js';
import { addVisitPhoto, createdVisitIdOf, finishVisit, markVisitPoint, saveVisitAnswers, visitDraftResultOf, visitCroquis, visitPdf, visitPointRequest, type VisitDraftResult, type VisitFlowDeps, type VisitPhotoPlace, type VisitSource } from './visitFlow.js';

/**
 * The visit's screen, the same on the phone and the web (designs lv01–lv03): which visit is open,
 * its document, what is running and what it said. Each platform only draws it and opens the forms.
 */
export type VisitScreenState = { visitId: string | null; draft: VisitDraftResult | null; busy: string | null; notice: string };
type Reply = { ok: true; data: unknown } | { ok: false; message?: string };
export type VisitScreenDeps<F> = VisitFlowDeps<F> & { askDraft(visitId: string | null): Promise<Reply>; source: VisitSource };
/** A point as the sheet hands it: its GPS may still be missing. */
export type VisitPointInput = Omit<VisitPointDraft, 'lat' | 'lng'> & { lat?: number; lng?: number };

export const VISIT_NO_GPS = 'Sin GPS no se marca el punto. Enciende la ubicación y vuelve a intentarlo.';
const ON_THE_WAY_FAILED = 'No se pudo completar. Revisa tu señal.';

export function createVisitScreen<F>(deps: VisitScreenDeps<F>, startId: string | null) {
  let state: VisitScreenState = { visitId: startId, draft: null, busy: null, notice: '' };
  const listeners = new Set<() => void>();
  const set = (patch: Partial<VisitScreenState>) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };
  const reload = async () => {
    const asked = state.visitId;
    const draft = visitDraftResultOf(await deps.askDraft(asked).catch(() => ({ ok: false as const })));
    if (asked === state.visitId) set({ draft });
  };
  /** One action at a time, with its words while it runs and what it said after; then the visit is read again. */
  const run = async (label: string, act: (visitId: string) => Promise<string>) => {
    const { visitId } = state;
    if (!visitId) return;
    set({ busy: label, notice: '' });
    const said = await act(visitId).catch(() => ON_THE_WAY_FAILED);
    set({ busy: null, notice: said });
    await reload();
  };
  const choose = async (visitId: string) => {
    set({ visitId, draft: null, notice: '' });
    await reload();
  };
  return {
    subscribe: (listener: () => void) => (listeners.add(listener), () => void listeners.delete(listener)),
    snapshot: () => state,
    reload,
    choose,
    /** Saving a new visit's details answers its id: from then on the screen is that visit. */
    adopt: (data: unknown): boolean => {
      const created = createdVisitIdOf(data);
      if (!created || created === state.visitId) return false;
      void choose(created);
      return true;
    },
    markPoint: (point: VisitPointInput, photo: F | null) => run('Guardando el punto…', async (visitId) => {
      if (point.lat === undefined || point.lng === undefined) return VISIT_NO_GPS;
      const marked = await markVisitPoint(deps, visitPointRequest(visitId, deps.newKey(), { ...point, lat: point.lat, lng: point.lng }, deps.source), photo);
      if (!marked.ok) return marked.message;
      return marked.photoFailed ? `Punto ${marked.n} guardado. ${marked.photoFailed}` : `Punto ${marked.n} guardado.`;
    }),
    answer: (values: Record<string, string>) => run('Guardando…', async (visitId) => (await saveVisitAnswers(deps, visitId, values)).message),
    /** `place`: where and when it was taken (Portal draws a loose one as «F»). */
    addPhoto: (photo: F, pointId?: string, place?: VisitPhotoPlace) => run('Subiendo la foto…', async (visitId) => {
      const sent = await addVisitPhoto(deps, visitId, photo, pointId, place);
      return sent.ok ? 'Foto agregada.' : sent.message;
    }),
    finish: () => run('Terminando…', async (visitId) => (await finishVisit(deps, visitId)).message),
    pdf: async (): Promise<string | null> => {
      const { visitId } = state;
      if (!visitId) return null;
      set({ busy: 'Pidiendo el PDF…', notice: '' });
      const asked = await visitPdf(deps, visitId).catch(() => ({ ok: false as const, message: ON_THE_WAY_FAILED }));
      set({ busy: null, notice: asked.ok ? '' : asked.message });
      return asked.ok ? asked.url : null;
    },
    /** «Abrir croquis»: Portal's editor link (12 h), only from `origins`; never kept in the state. */
    croquis: async (origins: readonly string[]): Promise<EmbedLink | null> => {
      const { visitId } = state;
      if (!visitId) return null;
      set({ busy: 'Abriendo el croquis…', notice: '' });
      const asked = await visitCroquis(deps, visitId, origins).catch(() => ({ ok: false as const, message: ON_THE_WAY_FAILED }));
      set({ busy: null, notice: asked.ok ? '' : asked.message });
      return asked.ok ? asked.link : null;
    },
  };
}
export type VisitScreen<F> = ReturnType<typeof createVisitScreen<F>>;

/** Whether a chat is a visits door (the space admin's «Comandos» decides), asked once; a late answer after leaving is dropped. */
export function watchVisitDoor(ask: () => Promise<{ ok: true; data: { open: boolean } } | { ok: false }>, onAnswer: (open: boolean) => void): () => void {
  let alive = true;
  void ask().then((answer) => alive && onAnswer(answer.ok && answer.data.open)).catch(() => undefined);
  return () => {
    alive = false;
  };
}
