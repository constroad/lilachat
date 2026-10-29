import { CLIENT_LIVE_DAYS, type ArchivedAgeGroup, type ClientServiceStatus } from './clientChannels.js';
import { memberCountLabel } from './flatLayout.js';

/**
 * The client channels of a space as the list shows them (pending 21, §157;
 * designs f-01, f-02, f-03): «CLIENTES · N» with the live ones, the row
 * «Archivados · N clientes · X sin leer», and the archived screen with its
 * search, chips and age groups. The server says live or archived; this only
 * joins each client with its chat and filters. PURE.
 */
export type SpaceClientService = { id: string; name: string; status: ClientServiceStatus; stage_label: string; progress?: number; url?: string };
/** One item of `GET /api/workspaces/:id/clients`. */
export type SpaceClient = {
  id: string;
  chat_id: string;
  name: string;
  ruc?: string;
  /** The client's Drive folder in the Portal, when the app sends it. */
  drive_url?: string;
  live: boolean;
  archived_since: string | null;
  last_activity_at: string | null;
  last_order_at: string | null;
  orders_total: number;
  archived_group: ArchivedAgeGroup;
  services: SpaceClientService[];
};
type ClientChat = { id: string; unread: number; lastAt?: string };
export type ClientEntry<T extends ClientChat> = { client: SpaceClient; chat: T | null };
export type ArchivedClientsFilter = 'all' | 'unread' | 'recent';

const DAY_MS = 86_400_000;
const SIX_MONTHS_DAYS = 180;
const TIME_ZONE = 'America/Lima';
const OPEN_STATUSES: readonly ClientServiceStatus[] = ['pending', 'in_progress'];

export const ARCHIVED_GROUP_TITLES: Record<ArchivedAgeGroup, string> = { '2-6': 'Hace 2 a 6 meses', '6+': 'Hace más de 6 meses' };
export const ARCHIVED_RULE = `Sin movimiento en ${CLIENT_LIVE_DAYS} días. Vuelve a Clientes con el próximo movimiento.`;
export const ARCHIVED_COMPOSER_NOTE = 'Escribir aquí no lo saca de Archivados';
export const CLIENT_SERVICE_STATUS_LABELS: Record<ClientServiceStatus, string> = { pending: 'Pendiente', in_progress: 'En ejecución', completed: 'Completado', rejected: 'Rechazado' };

/** The chats that are a client's channel: they leave «Canales» and go to «Clientes». */
export const clientChatIds = (clients: readonly SpaceClient[]): Set<string> => new Set(clients.map((client) => client.chat_id));

const lastMovement = <T extends ClientChat>(entry: ClientEntry<T>) => Math.max(Date.parse(entry.chat?.lastAt ?? '') || 0, Date.parse(entry.client.last_activity_at ?? '') || 0);

/** Live and archived clients with their chat (only the ones whose channel this person is in), the newest first. */
export function splitClients<T extends ClientChat>(clients: readonly SpaceClient[], chats: readonly T[]): { live: ClientEntry<T>[]; archived: ClientEntry<T>[]; archivedUnread: number } {
  const chatById = new Map(chats.map((chat) => [chat.id, chat]));
  const entries = clients.map((client) => ({ client, chat: chatById.get(client.chat_id) ?? null })).sort((a, b) => lastMovement(b) - lastMovement(a));
  const archived = entries.filter((entry) => !entry.client.live);
  return { live: entries.filter((entry) => entry.client.live), archived, archivedUnread: archived.filter((entry) => (entry.chat?.unread ?? 0) > 0).length };
}

export const openServices = (client: Pick<SpaceClient, 'services'>): number => client.services.filter((service) => OPEN_STATUSES.includes(service.status)).length;

const limaDay = (at: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);

/** «hoy», «ayer» or «12 oct», by the calendar in Lima. */
export function dayLabel(iso: string, now: Date): string {
  const day = limaDay(new Date(iso));
  if (day === limaDay(now)) return 'hoy';
  if (day === limaDay(new Date(now.getTime() - DAY_MS))) return 'ayer';
  return new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', timeZone: TIME_ZONE }).replace('.', '');
}

/** «12/10/2026» in Lima: the archived banner and the desktop table. */
export const shortDate = (iso: string): string => new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TIME_ZONE });

/** The second line of a client row (design f-01): «2 servicios en curso · Último pedido hoy». */
export function clientRowSubtitle(client: Pick<SpaceClient, 'services' | 'last_order_at'>, now: Date): string {
  const open = openServices(client);
  const services = open === 0 ? 'Sin servicios en curso' : `${open} ${open === 1 ? 'servicio' : 'servicios'} en curso`;
  return client.last_order_at ? `${services} · Último pedido ${dayLabel(client.last_order_at, now)}` : services;
}

/** The line under a client channel's name (design f-03): it is a client, not a «#» channel. */
export const clientHeaderSubtitle = (members: number): string => `Cliente · ${memberCountLabel(members)}`;

/** The banner of an archived channel (design f-03), or `null` for a live one. */
export function archivedBanner(client: Pick<SpaceClient, 'live' | 'archived_since'>): { title: string; body: string } | null {
  if (client.live) return null;
  return { title: client.archived_since ? `Archivado desde el ${shortDate(client.archived_since)}` : 'Archivado', body: ARCHIVED_RULE };
}

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const isRecentOrder = (client: SpaceClient, now: Date) => client.last_order_at !== null && now.getTime() - Date.parse(client.last_order_at) <= SIX_MONTHS_DAYS * DAY_MS;

/** The archived screen (design f-02): search by name or RUC, a chip, and the groups by age that have someone. */
export function filterArchivedClients<T extends ClientChat>(archived: readonly ClientEntry<T>[], params: { query: string; filter: ArchivedClientsFilter }, now: Date) {
  const text = normalize(params.query.trim());
  const matching = archived.filter(({ client }) => !text || normalize(client.name).includes(text) || (client.ruc ?? '').includes(text));
  const counts: Record<ArchivedClientsFilter, number> = {
    all: matching.length,
    unread: matching.filter((entry) => (entry.chat?.unread ?? 0) > 0).length,
    recent: matching.filter((entry) => isRecentOrder(entry.client, now)).length,
  };
  const shown = matching.filter((entry) => params.filter === 'all' || (params.filter === 'unread' ? (entry.chat?.unread ?? 0) > 0 : isRecentOrder(entry.client, now)));
  const groups = (['2-6', '6+'] as const).map((key) => ({ key, title: ARCHIVED_GROUP_TITLES[key], entries: shown.filter((entry) => entry.client.archived_group === key) })).filter((group) => group.entries.length > 0);
  return { groups, counts, shown: shown.length };
}

/** One record of a service (an informe, a quote, a payment, a photo): `GET …/clients/:id/records`. */
export type ClientRecord = { seq: number; at: string; kind?: string; service_id: string; record_id?: string; title: string; kicker?: string };

/** The records grouped by service, keeping the server's order (newest first). */
export function recordsByService(records: readonly ClientRecord[]): Map<string, ClientRecord[]> {
  const grouped = new Map<string, ClientRecord[]>();
  for (const record of records) grouped.set(record.service_id, [...(grouped.get(record.service_id) ?? []), record]);
  return grouped;
}
