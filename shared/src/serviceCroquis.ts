import { FORMS_LEVEL } from './appForms.js';
import { embedLinkOf, type EmbedLink } from './portalEmbed.js';
import type { WorkProgressDeps, WorkProgressResult } from './workProgressSend.js';
import type { MapEditSend } from './workScopeDraft.js';

/**
 * «Editar croquis» on a service's map (José 19/11): Portal's croquis editor of the service, framed
 * like a visit's. Agentes runs Portal's `abrir_croquis_de_servicio` and answers `{ url, expiresAt }`
 * (12 h); only a link to Portal's service croquis embed is opened, never stored nor sent. PURE.
 */
export type ServiceCroquisRequest = { kind: 'service_croquis'; forms: number };
export const serviceCroquisRequest = (): ServiceCroquisRequest => ({ kind: 'service_croquis', forms: FORMS_LEVEL });

export const SERVICE_CROQUIS_LABEL = 'Editar croquis';
export const SERVICE_CROQUIS_FAILED = 'No se pudo abrir el editor de croquis. Prueba de nuevo.';
/** Agentes answered, but with no link: the tool is not offered yet (José approves it in agentes). */
export const SERVICE_CROQUIS_NOT_ENABLED = 'El editor de croquis todavía no está habilitado.';

export type ServiceCroquisResult = { ok: true; link: EmbedLink } | { ok: false; message: string };

const notEnabled = (): WorkProgressResult => ({ ok: false, message: SERVICE_CROQUIS_NOT_ENABLED });
const unreachable = (): WorkProgressResult => ({ ok: false, message: SERVICE_CROQUIS_FAILED });

/** Opens the tool through the service's door; any answer without the link reads as «not enabled yet». */
export async function serviceCroquisRun(deps: WorkProgressDeps, origins: readonly string[]): Promise<WorkProgressResult> {
  const opened = await deps.open();
  if (!opened.ok) return unreachable();
  const { commandId } = opened.data;
  const reply = await deps.submit(commandId, {});
  // No status: the request never got an answer (no network); any status is a refusal.
  if (!reply.ok) return reply.status === undefined ? unreachable() : notEnabled();
  const { outcome } = reply;
  if (outcome.outcome === 'failed') return notEnabled();
  const response = outcome.outcome === 'pending' ? (await deps.notice(commandId))?.response : outcome.response;
  const link = embedLinkOf(response?.data, origins, 'service-croquis');
  return link ? { ok: true, message: '', data: { url: link.url, expiresAt: link.expiresAt } } : notEnabled();
}

/** The croquis' link through the map's own door (`MapEditSend`), as every other map tool. */
export async function serviceCroquisVia(send: MapEditSend, origins: readonly string[]): Promise<ServiceCroquisResult> {
  const result = await send(serviceCroquisRequest(), (deps) => serviceCroquisRun(deps, origins));
  if (!result.ok) return { ok: false, message: result.message };
  const link = embedLinkOf(result.data, origins, 'service-croquis');
  return link ? { ok: true, link } : { ok: false, message: SERVICE_CROQUIS_NOT_ENABLED };
}
