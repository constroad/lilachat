import { FORMS_LEVEL } from './appForms.js';
import { workMapCutLabel, type WorkMap, type WorkMapFilter } from './workMap.js';
import { sendMapTool, type WorkProgressResult } from './workProgressSend.js';
import type { MapEditSend } from './workScopeDraft.js';

/**
 * «Incluir en el informe del servicio» (design o-08, Portal 926b9723): the client's report PDF adds
 * a «Mapa de avance» sheet at the cut chosen here. Turning it off keeps no cut. PURE.
 */
export type WorkMapInReportRequest = { kind: 'work_map_in_report'; include: boolean; stage_id?: string; until?: string; forms: number };
export type MapInReport = { included: boolean; label: string };
export type MapInReportResult = { ok: true; state: MapInReport } | { ok: false; message: string };

export const MAP_IN_REPORT_FAILED = 'No se pudo cambiar el informe. Revisa tu señal y vuelve a intentarlo.';
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const workMapInReportRequest = (include: boolean, filter: WorkMapFilter): WorkMapInReportRequest => ({
  kind: 'work_map_in_report',
  include,
  ...(include && filter.stageId ? { stage_id: filter.stageId } : {}),
  ...(include && filter.untilDay && DAY.test(filter.untilDay) ? { until: filter.untilDay } : {}),
  forms: FORMS_LEVEL,
});

/** «Se adjunta: Etapa 1 · Hasta el 6 nov», read from what Portal answered. */
export function mapInReportOf(map: WorkMap, data: Record<string, unknown> | undefined, asked: boolean): MapInReport {
  const included = typeof data?.incluido === 'boolean' ? data.incluido : asked;
  if (!included) return { included, label: 'El informe del servicio va sin el mapa.' };
  const stage = typeof data?.etapa === 'string' ? map.stages.find((one) => one.id === data.etapa)?.name ?? data.etapa : 'Toda la obra';
  const day = typeof data?.hasta === 'string' && DAY.test(data.hasta) ? workMapCutLabel(data.hasta) : 'Hasta el día del informe';
  return { included, label: `Se adjunta al informe: ${stage} · ${day}.` };
}

export type InReportStep = { on: boolean | null; note: { ok: boolean; text: string } };

/** What the switch shows after asking: its new state (unchanged on a refusal) and the line under it. */
export async function toggleMapInReport(send: MapEditSend, map: WorkMap, filter: WorkMapFilter, include: boolean): Promise<InReportStep> {
  const result = await setMapInReport(send, map, filter, include);
  return result.ok ? { on: result.state.included, note: { ok: true, text: result.state.label } } : { on: null, note: { ok: false, text: result.message } };
}

export async function setMapInReport(send: MapEditSend, map: WorkMap, filter: WorkMapFilter, include: boolean): Promise<MapInReportResult> {
  const result: WorkProgressResult = await send(workMapInReportRequest(include, filter), (deps) => sendMapTool(deps, {}, { sent: '', failed: MAP_IN_REPORT_FAILED }));
  return result.ok ? { ok: true, state: mapInReportOf(map, result.data, include) } : result;
}
