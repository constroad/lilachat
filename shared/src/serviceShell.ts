/**
 * One grammar for a client's channel and its services (José 19/11, designs cc-01…cc-06): on a
 * tablet or a computer the channel's tabs stay while a service is open, with the service's head
 * and ONE underlined bar Pedidos · Informes · Mapa · Drive under them; on a phone the service
 * takes the screen with its back arrow. On a phone «Pendientes» lives inside «Checklist» for
 * whoever has the checklist. Who sees which tab does not change here (`channelTabs`). PURE.
 */
import { channelTabs, type ChannelTab, type MyClientAccess } from './clientAccess.js';
import { dayOf } from './serviceDetail.js';
import { serviceStageLine, type ServiceFilter, type SpaceClientService } from './spaceClients.js';
import { pendingTasks, type PendingTask } from './workFiles.js';
import type { WorkStage } from './workStages.js';

/** From this width (a tablet) the channel's tabs stay above an open service. */
export const SHELL_WIDE_MIN_PX = 768;
/** How many open tasks «Servicios» shows over the list on a phone (design cc-01 mobile). */
export const PENDING_PREVIEW_MAX = 3;

/** Under this height (a phone turned sideways) the channel's head and tabs would leave no room for the service. */
export const SHELL_MIN_HEIGHT_PX = 500;

export const serviceTakesScreen = (width: number, height = Number.POSITIVE_INFINITY): boolean => width < SHELL_WIDE_MIN_PX || height < SHELL_MIN_HEIGHT_PX;

/** On a phone the checklist holds «Pendientes · Plan» (design cc-06) when this person has both tabs. */
export function checklistHoldsPending(access: MyClientAccess | undefined, hasStages: boolean, compact: boolean): boolean {
  if (!compact) return false;
  const tabs = channelTabs(access, hasStages);
  return tabs.includes('checklist') && tabs.includes('pending');
}

/** The channel's tabs as drawn: the same as `channelTabs`, less «Pendientes» when the checklist holds it. */
export function channelTabsFor(access: MyClientAccess | undefined, hasStages: boolean, compact: boolean): ChannelTab[] {
  const tabs = channelTabs(access, hasStages);
  return checklistHoldsPending(access, hasStages, compact) ? tabs.filter((tab) => tab !== 'pending') : tabs;
}

export type ChecklistSegment = 'pending' | 'plan';
export const CHECKLIST_SEGMENT_LABELS: Record<ChecklistSegment, string> = { pending: 'Pendientes', plan: 'Plan' };

/** «Avance 0 % · Etapa: … · 6 etapas · Inicio 12 nov»: the service's head line, with what the service has. */
export function serviceHeadLine(service: Pick<SpaceClientService, 'status' | 'stage_label' | 'progress' | 'started_at' | 'stagesTotal'>): string {
  const stage = serviceStageLine(service);
  const parts = [
    service.progress !== undefined ? `Avance ${service.progress} %` : null,
    stage.startsWith('Etapa:') ? stage : null,
    service.stagesTotal ? `${service.stagesTotal} ${service.stagesTotal === 1 ? 'etapa' : 'etapas'}` : null,
    service.started_at ? `Inicio ${dayOf(service.started_at)}` : null,
  ];
  return parts.filter(Boolean).join(' · ');
}

/** «CONSORCIO · 40 %»: the line under the name in the map's one-row head (José 20/11, design mapa-v2). */
export function serviceSlimLine(service: Pick<SpaceClientService, 'progress'>, clientName?: string): string {
  const client = clientName?.trim() || null;
  const progress = service.progress !== undefined ? `${service.progress} %` : null;
  return [client, progress].filter(Boolean).join(' · ');
}

export const SERVICE_SEGMENTS: readonly ServiceFilter[] = ['open', 'completed', 'rejected', 'all'];
const SEGMENT_LABELS: Record<ServiceFilter, string> = { open: 'Abiertos', completed: 'Completados', rejected: 'Rechazados', all: 'Todos' };

/** The segmented filter of «Servicios» (design cc-01): «Rechazados» only when one exists. */
export function serviceSegmentsOf(counts: Record<ServiceFilter, number>): Array<{ key: ServiceFilter; label: string; count: number }> {
  return SERVICE_SEGMENTS.filter((key) => key !== 'rejected' || counts.rejected > 0).map((key) => ({ key, label: SEGMENT_LABELS[key], count: counts[key] }));
}

/** The block of open tasks over «Servicios» on a phone (design cc-01 mobile). */
export function pendingPreview(stages: readonly WorkStage[], now: Date): { tasks: PendingTask[]; total: number } {
  const open = pendingTasks(stages, now);
  return { tasks: open.slice(0, PENDING_PREVIEW_MAX), total: open.length };
}
