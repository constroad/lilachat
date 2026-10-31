/**
 * A channel per client of the company (pending 21, §157; José, 29/10): live
 * while the client had any movement in the Portal in the last 60 days (orders,
 * dispatches, quotes, services, reports, its services' Drive), otherwise in
 * «Archivados». It is worked out when the list is read, so the 61st day needs
 * no job to move it. The app (agentes) sends the state; PURE.
 */
export const CLIENT_LIVE_DAYS = 60;
const DAY_MS = 86_400_000;
const SIX_MONTHS_DAYS = 180;
const MAX_SERVICES = 200;
const MAX_TEXT = 160;
const MAX_URL = 1000;

export const CLIENT_SERVICE_STATUSES = ['pending', 'in_progress', 'completed', 'rejected'] as const;
export type ClientServiceStatus = (typeof CLIENT_SERVICE_STATUSES)[number];
export type ClientService = { id: string; name: string; status: ClientServiceStatus; stage: string; stageLabel: string; progress?: number; url?: string; closedAt?: string; /** When it started (José 31/10: the list showed no date). */ startedAt?: string };
/** `lastOrderAt` and `ordersTotal` are only shown; `lastActivityAt` decides. */
export type ClientState = { name: string; ruc?: string; /** The client's Drive folder in the Portal (José, 29/10: «no veo el Drive»). */ driveUrl?: string; lastActivityAt: string | null; lastOrderAt: string | null; ordersTotal: number; services: ClientService[] };
export type ArchivedAgeGroup = '2-6' | '6+';

export function isClientChannelLive(state: Pick<ClientState, 'lastActivityAt'>, now: Date): boolean {
  return state.lastActivityAt !== null && now.getTime() - Date.parse(state.lastActivityAt) <= CLIENT_LIVE_DAYS * DAY_MS;
}

/** When it went to «Archivados»: 60 days after its last movement. */
export function archivedSince(state: Pick<ClientState, 'lastActivityAt'>): string | null {
  return state.lastActivityAt ? new Date(Date.parse(state.lastActivityAt) + CLIENT_LIVE_DAYS * DAY_MS).toISOString() : null;
}

/** The groups of the archived list (design f-02): last movement 2 to 6 months ago, or older (or never). */
export function archivedAgeGroup(lastActivityAt: string | null, now: Date): ArchivedAgeGroup {
  if (!lastActivityAt) return '6+';
  return now.getTime() - Date.parse(lastActivityAt) <= SIX_MONTHS_DAYS * DAY_MS ? '2-6' : '6+';
}

type Refused = { ok: false; message: string };
const refuse = (message: string): Refused => ({ ok: false, message });
const text = (raw: unknown): string => (typeof raw === 'string' ? raw.trim().slice(0, MAX_TEXT) : '');
const isoOrNull = (raw: unknown): string | null | undefined => {
  if (raw === null || raw === undefined) return null;
  return typeof raw === 'string' && !Number.isNaN(Date.parse(raw)) ? new Date(raw).toISOString() : undefined;
};

function validateService(raw: unknown): { ok: true; service: ClientService } | Refused {
  const body = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const id = text(body.id);
  const name = text(body.name);
  if (!id || !name) return refuse('Cada servicio lleva id y name.');
  if (!CLIENT_SERVICE_STATUSES.includes(body.status as ClientServiceStatus)) return refuse(`status va como ${CLIENT_SERVICE_STATUSES.join(', ')}.`);
  const progress = body.progress === undefined || body.progress === null ? undefined : Number(body.progress);
  if (progress !== undefined && !(Number.isFinite(progress) && progress >= 0 && progress <= 100)) return refuse('progress va de 0 a 100.');
  const closedAt = isoOrNull(body.closed_at);
  if (closedAt === undefined) return refuse('closed_at va como fecha ISO.');
  const startedAt = isoOrNull(body.started_at);
  if (startedAt === undefined) return refuse('started_at va como fecha ISO.');
  const url = typeof body.url === 'string' ? body.url.trim().slice(0, MAX_URL) : '';
  return {
    ok: true,
    service: { id, name, status: body.status as ClientServiceStatus, stage: text(body.stage), stageLabel: text(body.stage_label), ...(progress !== undefined ? { progress } : {}), ...(url.startsWith('https://') ? { url } : {}), ...(closedAt ? { closedAt } : {}), ...(startedAt ? { startedAt } : {}) },
  };
}

/** The body of `PUT /api/bots/clients/:clientId`, in the API's snake_case. */
export function validateClientState(raw: unknown): { ok: true; state: ClientState } | Refused {
  const body = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const name = text(body.name);
  if (!name) return refuse('El cliente lleva name.');
  const lastOrderAt = isoOrNull(body.last_order_at);
  if (lastOrderAt === undefined) return refuse('last_order_at va como fecha ISO, o null si todavía no tiene pedidos.');
  const lastActivityAt = isoOrNull(body.last_activity_at);
  if (lastActivityAt === undefined) return refuse('last_activity_at va como fecha ISO: el último movimiento del cliente en el Portal.');
  const rawServices = Array.isArray(body.services) ? body.services : [];
  if (rawServices.length > MAX_SERVICES) return refuse(`Hasta ${MAX_SERVICES} servicios por cliente.`);
  const services: ClientService[] = [];
  for (const one of rawServices) {
    const valid = validateService(one);
    if (!valid.ok) return valid;
    services.push(valid.service);
  }
  const ruc = text(body.ruc);
  const driveUrl = typeof body.drive_url === 'string' ? body.drive_url.trim().slice(0, MAX_URL) : '';
  const ordersTotal = Number.isInteger(body.orders_total) && Number(body.orders_total) >= 0 ? Number(body.orders_total) : 0;
  return { ok: true, state: { name, ...(ruc ? { ruc } : {}), ...(driveUrl.startsWith('https://') ? { driveUrl } : {}), lastActivityAt, lastOrderAt, ordersTotal, services } };
}
