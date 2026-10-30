import type { ServiceDetail } from './serviceDetail.js';
import type { ServiceFile, ServiceFiles } from './serviceFiles.js';

/**
 * Asking about one of a client's services from the app or the web (pending
 * 121 Drive; José 30/10 detail): the path and how to read the answer. The
 * server answers 200 with a message and Portal's link when agentes fails, so
 * the person always has somewhere to go. PURE.
 */
export type ServiceAskKind = 'files' | 'detail';
export type ServiceAskResult<T> = { ok: true; value: T } | { ok: false; message: string; portalUrl: string | null };
export type ServiceAskBody = { files?: ServiceFile[]; drive_url?: string | null; detail?: ServiceDetail; error?: string; message?: string; portal_url?: string | null };
type ValueOf = { files: ServiceFiles; detail: ServiceDetail };
export type ServiceAskValue<K extends ServiceAskKind> = ValueOf[K];

const FAILED: Record<ServiceAskKind, string> = { files: 'No se pudo traer el Drive', detail: 'No se pudo traer el detalle del servicio' };

export const serviceAskPath = (spaceId: string, clientId: string, serviceId: string, kind: ServiceAskKind): string =>
  `/workspaces/${spaceId}/clients/${encodeURIComponent(clientId)}/services/${encodeURIComponent(serviceId)}/${kind}`;

/** `null` body = no network or a refusal: the generic failure, without a link. */
export function readServiceAsk<K extends ServiceAskKind>(kind: K, body: ServiceAskBody | null): ServiceAskResult<ValueOf[K]> {
  const failed = { ok: false as const, message: body?.message ?? FAILED[kind], portalUrl: body?.portal_url ?? body?.drive_url ?? null };
  if (kind === 'files') return (body?.files ? { ok: true, value: { files: body.files, driveUrl: body.drive_url ?? null } } : failed) as ServiceAskResult<ValueOf[K]>;
  return (body?.detail ? { ok: true, value: body.detail } : failed) as ServiceAskResult<ValueOf[K]>;
}
