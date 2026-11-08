import { FORMS_LEVEL } from './appForms.js';
import type { WorkMapFilter } from './workMap.js';
import { sendMapTool, type WorkProgressResult } from './workProgressSend.js';
import type { MapEditSend } from './workScopeDraft.js';

/**
 * «Crear enlace de avance» (design o-08, Portal 1d397594): a link that opens only the map at the
 * cut chosen here (stage and day), with the photos up to that day only when asked. Portal signs
 * the cut in the link, so the client cannot widen it. PURE: the web and the APK send it.
 */
export type WorkProgressLinkRequest = { kind: 'work_progress_link'; stage_id?: string; until?: string; photos: boolean; forms: number };
export type ProgressLink = { url: string; days: number | null };
export type ProgressLinkResult = { ok: true; link: ProgressLink } | { ok: false; message: string };

export const PROGRESS_LINK_FAILED = 'No se pudo crear el enlace. Revisa tu señal y vuelve a intentarlo.';
export const PROGRESS_LINK_MISSING = 'Portal no devolvió el enlace. Vuelve a intentarlo.';
const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** Written by hand: `URL` has no `hostname` on every phone. Only our own addresses go to a client. */
const OUR_ADDRESS = /^https:\/\/([a-z0-9-]+\.)*constroad\.com(:\d+)?\//i;

export const workProgressLinkRequest = (filter: WorkMapFilter, photos: boolean): WorkProgressLinkRequest => ({
  kind: 'work_progress_link',
  ...(filter.stageId ? { stage_id: filter.stageId } : {}),
  ...(filter.untilDay && DAY.test(filter.untilDay) ? { until: filter.untilDay } : {}),
  photos,
  forms: FORMS_LEVEL,
});

/** Portal's `structuredContent`: the link only when it is one of ours. */
export function progressLinkOf(data: Record<string, unknown> | undefined): ProgressLink | null {
  const url = typeof data?.url === 'string' ? data.url : '';
  if (!OUR_ADDRESS.test(url)) return null;
  const days = typeof data?.dias === 'number' && Number.isFinite(data.dias) ? data.dias : null;
  return { url, days };
}

/** Opens Portal's tool through the door and reads the link it answers. */
export async function createProgressLink(send: MapEditSend, filter: WorkMapFilter, photos: boolean): Promise<ProgressLinkResult> {
  const result: WorkProgressResult = await send(workProgressLinkRequest(filter, photos), (deps) => sendMapTool(deps, {}, { sent: '', failed: PROGRESS_LINK_FAILED }));
  if (!result.ok) return result;
  const link = progressLinkOf(result.data);
  return link ? { ok: true, link } : { ok: false, message: PROGRESS_LINK_MISSING };
}

/** «Vence en 7 días»; Portal decides it, the phone only says it. */
export const progressLinkExpiry = (link: ProgressLink): string | null => (link.days === null ? null : link.days === 1 ? 'Vence en 1 día' : `Vence en ${link.days} días`);
