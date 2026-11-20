import type { FormSubmitReply } from './appActions.js';
import { FORMS_LEVEL, type FormValues } from './appForms.js';
import type { CommandOutcome, CommandResponse } from './botCommands.js';

/**
 * The «Mapa» tab of a service (José 06/11: «si el servicio tiene mapa agrega un tab mapa»). Only
 * Portal's public page draws it, so opening the tab makes a link with Portal's action and shows
 * that page. A short term: it is made again on the next visit, and old ones do not pile up.
 * PURE: the app and the web draw with it.
 */
export const MAP_LINK_DAYS = 1;
export const MAP_LINK_FAILED = 'No se pudo abrir el mapa. Prueba de nuevo.';

/** Portal's report opens on its first page; this is the section with the map (E2E 06/11: `section=map`). */
export const serviceMapPage = (url: string, serviceId: string): string => `${url.includes('/service/') ? url : `${url}/service/${serviceId}`}?section=map`;

const ADMIN_SERVICE_PAGE = /^\/admin\/service-management\/[^/]+\/?$/;

/**
 * Where the streets are drawn today (José 07/11: «dónde se supone que voy a crear el mapa»): the
 * «Mapa» tab of the service in Portal's admin. Only that page draws; any other link gives nothing.
 */
export function portalMapTabUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const page = new URL(url);
    if (page.protocol !== 'https:' || !ADMIN_SERVICE_PAGE.test(page.pathname)) return null;
    page.searchParams.set('tab', 'mapa');
    return page.toString();
  } catch {
    return null;
  }
}

export type ServiceMapResult = { ok: true; url: string } | { ok: false; message: string };
/**
 * The service's link through the server's door (José 07/11, the engineer Jeremy had no «Mapa»):
 * the channel's «crear enlace» shortcut may be off for a member, but the map is everyone's. The
 * door checks the person is in the client's channel and fixes the service.
 */
export type ServiceLinkRequest = { kind: 'service_link'; forms: number };
export const serviceLinkRequest = (): ServiceLinkRequest => ({ kind: 'service_link', forms: FORMS_LEVEL });

export type ServiceMapDeps = {
  open: () => Promise<{ ok: true; data: CommandOutcome } | { ok: false; message?: string }>;
  submit: (commandId: string, values: FormValues) => Promise<FormSubmitReply>;
  notice: (commandId: string) => Promise<{ response: CommandResponse } | null>;
};

const linkOf = (response: CommandResponse | undefined, failed: string): ServiceMapResult => {
  const url = response?.card?.link?.url;
  return url?.startsWith('https://') ? { ok: true, url } : { ok: false, message: failed };
};

async function linkFrom(outcome: CommandOutcome, notice: ServiceMapDeps['notice'], failed: string): Promise<ServiceMapResult> {
  if (outcome.outcome === 'failed') return { ok: false, message: outcome.message ?? failed };
  return linkOf(outcome.outcome === 'pending' ? (await notice(outcome.commandId))?.response : outcome.response, failed);
}

/** Runs the service's link action with `values` already given, without the form the chat would show; `failed` is what it says otherwise. */
export async function runServiceLinkAction(deps: ServiceMapDeps, values: FormValues, failed: string): Promise<ServiceMapResult> {
  const opened = await deps.open();
  if (!opened.ok) return { ok: false, message: failed };
  if (opened.data.outcome !== 'form') return linkFrom(opened.data, deps.notice, failed);
  const reply = await deps.submit(opened.data.commandId, values);
  if (!reply.ok) return { ok: false, message: reply.errors?._ ?? Object.values(reply.errors ?? {})[0] ?? reply.message ?? failed };
  return linkFrom(reply.outcome, deps.notice, failed);
}

/** The map's link: the short term, made again on the next visit. */
export const serviceMapUrl = (deps: ServiceMapDeps): Promise<ServiceMapResult> => runServiceLinkAction(deps, { dias: MAP_LINK_DAYS }, MAP_LINK_FAILED);
