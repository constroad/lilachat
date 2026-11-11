/**
 * Who sees what in a client's channel (José 30/10 night): topographers,
 * engineers and the like join seeing only the tabs and checklist stages an
 * admin picks, plus the tasks assigned to them. Money (Cuenta, quotes,
 * Cobranza, invoices) is only for the space's admins, with no mark for anyone
 * else (José 07/11: «todo lo que es plata solo admins»); all of it lives in «Cuenta» (José 05/11), so «Servicios» carries none. A space admin always sees the whole channel. PURE: server, app, web.
 */
export const RESTRICTABLE_TABS = ['services', 'files', 'checklist'] as const;
export type RestrictableTab = (typeof RESTRICTABLE_TABS)[number];
export type ChannelTab = 'chat' | 'account' | 'services' | 'checklist' | 'pending';
/** A restricted member: the tabs they see besides the chat, and the checklist stages they see whole. */
export type MemberAccess = { tabs: RestrictableTab[]; stages: string[] };
/** My access in a client's channel (`SpaceClient.access`). No `restricted` = the whole channel. */
export type MyClientAccess = { money: boolean; /** A space admin: the only one with the checklist (José 06/11). */ admin?: boolean; restricted?: MemberAccess };
/** How much of a checklist stage a member sees: all of it, only their tasks, or nothing. */
/** `full` runs the stage; `own` reads it whole and only touches the tasks assigned to them. */
export type StageScope = 'full' | 'own';

/** What an admin can open to a member. `files` and `checklist` stay in `RESTRICTABLE_TABS` only to read older marks: the Drive is for everyone (José 07/11). */
export const MEMBER_TABS = ['services'] as const;

export const CHANNEL_TAB_LABELS: Record<ChannelTab | RestrictableTab, string> = { chat: 'Chat', account: 'Cuenta', services: 'Servicios', files: 'Drive', checklist: 'Checklist', pending: 'Pendientes' };
/** What each restrictable tab gives, for the access editor. */
export const RESTRICTABLE_TAB_HINTS: Record<(typeof MEMBER_TABS)[number], string> = {
  services: 'Pedidos, despachos e informes, sin montos',
};

const STAGE_ID = /^[a-f0-9]{24}$/;
const MAX_STAGES = 50;

/** The service's Drive is for every member of the client's channel (José 07/11: «el drive lo podrían usar todos»). */
export const canSeeDrive = (access: MyClientAccess | undefined): boolean => access !== undefined;

const MONEY_RECORD = /pago|cotizaci|orden de compra|valorizaci|liquidaci|factura/i;
/** A service's record that speaks of money, by what its card says: agentes sends no type (José 05/11). */
export const isMoneyRecord = (record: { kicker?: string; title: string }): boolean => MONEY_RECORD.test(`${record.kicker ?? ''} ${record.title}`);
/**
 * What a member without money sees of a service's reports (José 05/11): the types of Portal's public
 * services page (`publicFieldReportTypes`), by the label Portal sends, less «Aprobación de adicional»,
 * which carries prices. A list of what is allowed: a type nobody reviewed stays hidden. Portal filters
 * first; this is the second lock.
 */
const FIELD_REPORT_LABELS = new Set(['control de pista', 'conformacion de capa', 'control de imprimacion', 'area adicional', 'recepcion de campo', 'levantamiento de observaciones', 'registro de observaciones', 'fresado de pavimento', 'solicitud de imprimacion']);
const plainLabel = (label: string): string => label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
export const isFieldReport = (report: { typeLabel?: string }): boolean => FIELD_REPORT_LABELS.has(plainLabel(report.typeLabel ?? ''));

export const canSeeTab = (access: MyClientAccess | undefined, tab: RestrictableTab): boolean => !access?.restricted || access.restricted.tabs.includes(tab);

/**
 * José 06/11: Chat · Cuenta · Servicios · Checklist, and Pendientes once the checklist exists. The Drive
 * lives inside each service, so a member who only has the Drive goes through «Servicios». The checklist
 * is for admins; «Pendientes» is for everyone in the channel, who mark there what was assigned to them.
 */
export function channelTabs(access: MyClientAccess | undefined, hasStages: boolean): ChannelTab[] {
  const tabs: ChannelTab[] = ['chat'];
  if (access?.money) tabs.push('account');
  if (canSeeTab(access, 'services') || access?.restricted?.tabs.includes('files')) tabs.push('services');
  if (access?.admin) tabs.push('checklist');
  if (hasStages) tabs.push('pending');
  return tabs;
}

/** What opening a service shows a member: its orders and reports, its Drive, or both. */
export const serviceAccessOf = (access: MyClientAccess | undefined): { detail: boolean; drive: boolean } => ({ detail: canSeeTab(access, 'services'), drive: canSeeDrive(access) });

/** What someone can do on a task of the plan (José 06/11): an admin everything, anyone else marks only their own. */
export function taskActionsFor(params: { admin: boolean; me: string; assignee?: string | null }): { canMark: boolean; canReassign: boolean } {
  return { canMark: params.admin || params.assignee === params.me, canReassign: params.admin };
}

export type MemberAccessInput = { ok: true; access: MemberAccess } | { ok: false; message: string };

/** The editor's choice, checked: known tabs once (Cuenta is money, never a tab here) and valid stage ids once. */
export function memberAccessOf(value: unknown): MemberAccessInput {
  const raw: { tabs?: unknown; stages?: unknown } = value && typeof value === 'object' ? value : {};
  const tabs: unknown[] | null = Array.isArray(raw.tabs) ? raw.tabs : null;
  if (!tabs) return { ok: false, message: 'Faltan las pestañas (tabs).' };
  const unknownTab = tabs.find((tab) => !RESTRICTABLE_TABS.includes(tab as RestrictableTab));
  if (unknownTab !== undefined) return { ok: false, message: `Pestaña desconocida: ${String(unknownTab)}.` };
  const stages: unknown[] = Array.isArray(raw.stages) ? raw.stages : [];
  const valid = stages.filter((stage): stage is string => typeof stage === 'string' && STAGE_ID.test(stage));
  if (stages.length > MAX_STAGES || valid.length !== stages.length) return { ok: false, message: 'Etapa inválida.' };
  return { ok: true, access: { tabs: RESTRICTABLE_TABS.filter((tab) => tabs.includes(tab)), stages: [...new Set(valid)] } };
}

const listed = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}` : names[0] ?? '');

/** One line for the access list: «Todo el canal · ve montos», «Solo el chat», «Chat y Servicios». */
export function accessSummary(access: MyClientAccess): string {
  if (!access.restricted) return access.money ? 'Todo el canal · ve montos' : 'Todo el canal, sin montos ni Drive';
  const tabs = access.restricted.tabs.filter((tab) => tab !== 'checklist');
  if (!tabs.length) return access.money ? 'Solo el chat · ve montos' : 'Solo el chat';
  const text = listed(['Chat', ...tabs.map((tab) => CHANNEL_TAB_LABELS[tab])]);
  return access.money ? `${text} · ve montos` : text;
}

/** `GET /api/workspaces/:id/clients/:clientId/access`, for its admins. */
export type ClientAccessList = { viewers: string[]; restricted: (MemberAccess & { user_id: string })[]; admins: string[] };
export type MemberAccessEntry = MyClientAccess & { admin: boolean };

/** One member's access as the editor shows it: a space admin always sees all, money included; nobody else sees money (José 07/11). */
export function memberAccessIn(list: ClientAccessList, userId: string): MemberAccessEntry {
  if (list.admins.includes(userId)) return { admin: true, money: true };
  const entry = list.restricted.find((one) => one.user_id === userId);
  return entry ? { admin: false, money: false, restricted: { tabs: entry.tabs, stages: entry.stages } } : { admin: false, money: false };
}

export const clientAccessPath = (spaceId: string, clientId: string, userId?: string) => `/workspaces/${spaceId}/clients/${encodeURIComponent(clientId)}/access${userId ? `/${userId}` : ''}`;

/** What a new restricted member starts with in the editor: only the chat. */
export const DEFAULT_RESTRICTED: MemberAccess = { tabs: [], stages: [] };

/** Flips one tab of the editor's choice. */
export function toggleInAccess(access: MemberAccess, tab: RestrictableTab): MemberAccess {
  const tabs = access.tabs.includes(tab) ? access.tabs.filter((one) => one !== tab) : RESTRICTABLE_TABS.filter((one) => one === tab || access.tabs.includes(one));
  return { ...access, tabs };
}
