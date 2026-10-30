/**
 * Who sees what in a client's channel (José 30/10 night): topographers,
 * engineers and the like join seeing only the tabs and checklist stages an
 * admin picks, plus the tasks assigned to them. Money (Cuenta, quotes,
 * Cobranza, invoices) is only for the space's admins and whoever an admin
 * marks. A space admin always sees the whole channel. PURE: server, app, web.
 */
export const RESTRICTABLE_TABS = ['services', 'files', 'checklist'] as const;
export type RestrictableTab = (typeof RESTRICTABLE_TABS)[number];
export type ChannelTab = 'chat' | 'account' | RestrictableTab | 'pending';
/** A restricted member: the tabs they see besides the chat, and the checklist stages they see whole. */
export type MemberAccess = { tabs: RestrictableTab[]; stages: string[] };
/** My access in a client's channel (`SpaceClient.access`). No `restricted` = the whole channel. */
export type MyClientAccess = { money: boolean; restricted?: MemberAccess };
/** How much of a checklist stage a member sees: all of it, only their tasks, or nothing. */
export type StageScope = 'full' | 'own' | 'none';

export const CHANNEL_TAB_LABELS: Record<ChannelTab, string> = { chat: 'Chat', account: 'Cuenta', services: 'Servicios', files: 'Archivos', checklist: 'Checklist', pending: 'Pendientes' };
/** What each restrictable tab gives, for the access editor. */
export const RESTRICTABLE_TAB_HINTS: Record<RestrictableTab, string> = {
  services: 'Pedidos, despachos e informes, sin montos',
  files: 'Drive del Portal y archivos del checklist',
  checklist: 'Las etapas que elijas y sus tareas',
};
export const MONEY_HINT = 'Cuenta, cotizaciones, cobranza y facturas';

const STAGE_ID = /^[a-f0-9]{24}$/;
const MAX_STAGES = 50;

export const canSeeTab = (access: MyClientAccess | undefined, tab: RestrictableTab): boolean => !access?.restricted || access.restricted.tabs.includes(tab);

/** José 30/10: Chat · Cuenta · Servicios · Archivos · Checklist, and Pendientes once the checklist exists. */
export function channelTabs(access: MyClientAccess | undefined, hasStages: boolean): ChannelTab[] {
  const tabs: ChannelTab[] = ['chat'];
  if (access?.money) tabs.push('account');
  for (const tab of RESTRICTABLE_TABS) if (canSeeTab(access, tab)) tabs.push(tab);
  if (hasStages && canSeeTab(access, 'checklist')) tabs.push('pending');
  return tabs;
}

/** A picked stage is whole; any other shows only the tasks assigned to the member; without them it is hidden. */
export function stageScopeOf(restricted: MemberAccess | null | undefined, stageId: string, hasOwnTask: boolean): StageScope {
  if (!restricted) return 'full';
  if (restricted.tabs.includes('checklist') && restricted.stages.includes(stageId)) return 'full';
  return hasOwnTask ? 'own' : 'none';
}

type StageLike = { _id: string; items: { assignee?: string | null }[] };

/** The stages as a restricted member sees them; everyone else gets them as they are. */
export function visibleStagesFor<T extends StageLike>(stages: readonly T[], restricted: MemberAccess | null | undefined, me: string): T[] {
  if (!restricted) return [...stages];
  return stages.flatMap((stage) => {
    const own = stage.items.filter((item) => item.assignee === me);
    const scope = stageScopeOf(restricted, stage._id, own.length > 0);
    if (scope === 'none') return [];
    return scope === 'full' ? [stage] : [{ ...stage, items: own }];
  });
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

function checklistPart(stages: readonly string[], titles: ReadonlyMap<string, string>): string {
  if (!stages.length) return 'solo sus tareas';
  return stages.length === 1 ? (titles.get(stages[0]!) ?? '1 etapa') : `${stages.length} etapas`;
}

/** One line for the access list: «Todo el canal · ve montos», «Solo el chat», «Chat y Checklist (Permisos)». */
export function accessSummary(access: MyClientAccess, stageTitles: ReadonlyMap<string, string>): string {
  if (!access.restricted) return access.money ? 'Todo el canal · ve montos' : 'Todo el canal, sin montos';
  const { tabs, stages } = access.restricted;
  if (!tabs.length) return access.money ? 'Solo el chat · ve montos' : 'Solo el chat';
  const names = ['Chat', ...tabs.map((tab) => CHANNEL_TAB_LABELS[tab])];
  const text = tabs.includes('checklist') ? `${listed(names)} (${checklistPart(stages, stageTitles)})` : listed(names);
  return access.money ? `${text} · ve montos` : text;
}

/** `GET /api/workspaces/:id/clients/:clientId/access`, for its admins. */
export type ClientAccessList = { viewers: string[]; restricted: (MemberAccess & { user_id: string })[]; admins: string[] };
export type MemberAccessEntry = MyClientAccess & { admin: boolean };

/** One member's access as the editor shows it: a space admin always sees all, money included. */
export function memberAccessIn(list: ClientAccessList, userId: string): MemberAccessEntry {
  if (list.admins.includes(userId)) return { admin: true, money: true };
  const entry = list.restricted.find((one) => one.user_id === userId);
  const money = list.viewers.includes(userId);
  return entry ? { admin: false, money, restricted: { tabs: entry.tabs, stages: entry.stages } } : { admin: false, money };
}

export const clientAccessPath = (spaceId: string, clientId: string, userId?: string) => `/workspaces/${spaceId}/clients/${encodeURIComponent(clientId)}/access${userId ? `/${userId}` : ''}`;

/** What a new restricted member starts with in the editor: the checklist only, with no stage yet (their own tasks). */
export const DEFAULT_RESTRICTED: MemberAccess = { tabs: ['checklist'], stages: [] };

/** Flips one tab or stage of the editor's choice. */
export function toggleInAccess(access: MemberAccess, change: { tab: RestrictableTab } | { stage: string }): MemberAccess {
  if ('tab' in change) {
    const tabs = access.tabs.includes(change.tab) ? access.tabs.filter((tab) => tab !== change.tab) : RESTRICTABLE_TABS.filter((tab) => tab === change.tab || access.tabs.includes(tab));
    return { ...access, tabs };
  }
  const stages = access.stages.includes(change.stage) ? access.stages.filter((stage) => stage !== change.stage) : [...access.stages, change.stage];
  return { ...access, stages };
}
