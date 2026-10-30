/**
 * Where each command and action of an app works in a space, and who may use
 * it (R160; José, 23/10: only some are global; 28/10: everything starts off,
 * and once on only admins use it until the admin widens it — agentes
 * `specs/COMANDOS-Y-HORARIOS.spec.md` §2). The space's admin decides, per item:
 * the space's ⚡ (global), which channels, the 1:1 with the app (direct) and
 * who. PURE: the server enforces it, the app and the web draw it.
 */
export type AppItemKind = 'command' | 'shortcut';
export type ItemChannels = 'all' | 'none' | string[];
/** Who may run it, in any of its places. Space admins always may: they turn it on and try it. */
export type ItemWho = { kind: 'admins' } | { kind: 'everyone' } | { kind: 'people'; userIds: string[] };
export type AppItemSetting = { global: boolean; channels: ItemChannels; direct: boolean; who: ItemWho };
/** A row of «Comandos y acciones»: the item, what it is and where it works. */
export type AppItemRow = AppItemSetting & { kind: AppItemKind; key: string; name: string; description?: string; /** A command that may be programmed (agentes, 28/10), and one with amounts that only goes to the creator's 1:1. */ schedulable?: true; shareable?: false };
export type StoredItemSettings = Record<string, Partial<AppItemSetting>>;
/** Where it is used: the space's ⚡, a chat, or the person's 1:1 with the app. */
/** `client`: a client's channel (§157), which «Todos» leaves out. */
export type ItemPlace = 'space' | 'direct' | { chatId: string; client?: boolean };
/** Where a client asks for the commands: the ⚡ or a chat; the server tells a 1:1 with the app («direct») from its chat id. */
export type CommandsPlace = Exclude<ItemPlace, 'direct'>;

const OBJECT_ID = /^[a-f0-9]{24}$/;
/** A space has a handful of channels; this bounds what one item can list. */
export const ITEM_CHANNELS_MAX = 200;
/** The people chosen for one item: a crew, not the whole company. */
export const ITEM_PEOPLE_MAX = 200;
/** Untouched (José, 28/10): off in every place, and only for admins once turned on. */
export const ALL_OFF: AppItemSetting = Object.freeze({ global: false, channels: 'none', direct: false, who: Object.freeze({ kind: 'admins' }) }) as AppItemSetting;

export const itemKey = (kind: AppItemKind, key: string): string => `${kind}:${key}`;

/** Before the migration to all off (José's go, §2.1): actions global, every channel, the 1:1 open, anyone, as it was. */
const legacyOf = (kind: AppItemKind): AppItemSetting => ({ global: kind === 'shortcut', channels: 'all', direct: true, who: { kind: 'everyone' } });

/** `legacy`: an installation not migrated yet keeps the old defaults, so deploying does not switch anything off by itself. */
export function itemSettingOf(stored: StoredItemSettings | undefined, kind: AppItemKind, key: string, legacy = false): AppItemSetting {
  const saved = stored?.[itemKey(kind, key)] ?? {};
  const base = legacy ? legacyOf(kind) : ALL_OFF;
  return { global: saved.global ?? base.global, channels: saved.channels ?? base.channels, direct: saved.direct ?? base.direct, who: saved.who ?? base.who };
}

export function enabledAt(setting: AppItemSetting, place: ItemPlace): boolean {
  if (place === 'space') return setting.global;
  if (place === 'direct') return setting.direct;
  if (setting.channels === 'all' || setting.channels === 'none') return setting.channels === 'all' && !place.client;
  return setting.channels.includes(place.chatId);
}

export function mayUseItem(setting: Pick<AppItemSetting, 'who'>, person: { userId: string; spaceAdmin: boolean }): boolean {
  if (person.spaceAdmin) return true;
  if (setting.who.kind === 'everyone') return true;
  return setting.who.kind === 'people' && setting.who.userIds.includes(person.userId);
}

/** «Encendido» in «Comandos y acciones» (design d-01): it works somewhere. */
export function itemIsOn(setting: AppItemSetting): boolean {
  return setting.global || setting.direct || setting.channels === 'all' || (Array.isArray(setting.channels) && setting.channels.length > 0);
}

const joinPlaces = (places: readonly string[]): string => (places.length < 2 ? places.join('') : `${places.slice(0, -1).join(', ')} y ${places.at(-1)}`);

/** Where an item works, in words (José, 30/10: «Encendido» read as «everywhere», and «/» came out empty). */
export function itemPlacesLine(setting: AppItemSetting, channelNames: ReadonlyMap<string, string>): string {
  const channels = setting.channels === 'all' ? ['todos los canales'] : setting.channels === 'none' ? [] : setting.channels.flatMap((id) => (channelNames.has(id) ? [`#${channelNames.get(id)}`] : []));
  const places = [...(setting.global ? ['⚡ Acciones rápidas'] : []), ...channels];
  if (places.length === 0) return setting.direct ? 'Funciona solo en el chat con la app' : 'No funciona en ningún lugar';
  return `Funciona en ${joinPlaces(setting.direct ? [...places, 'el chat con la app'] : places)}`;
}

const sorted = (ids: readonly string[]) => [...ids].sort().join(',');
const channelsKey = (channels: ItemChannels) => (Array.isArray(channels) ? `[${sorted(channels)}]` : channels);
const whoKey = (who: ItemWho) => (who.kind === 'people' ? `people:${sorted(who.userIds)}` : who.kind);

/** What the admin changed, so «Guardar» sends only that; the order of channels or people is not a change. */
export function sameItemSetting(a: AppItemSetting, b: AppItemSetting): boolean {
  return a.global === b.global && a.direct === b.direct && channelsKey(a.channels) === channelsKey(b.channels) && whoKey(a.who) === whoKey(b.who);
}

/** The migration to all off writes every item, so a later change of the default turns nothing on by itself. */
export function allOffSettings(keys: readonly string[]): StoredItemSettings {
  return Object.fromEntries(keys.map((key) => [key, ALL_OFF]));
}

function channelsOf(raw: unknown): ItemChannels | null {
  if (raw === 'all' || raw === 'none') return raw;
  if (!Array.isArray(raw) || raw.length > ITEM_CHANNELS_MAX || !raw.every((id) => typeof id === 'string' && OBJECT_ID.test(id))) return null;
  return [...new Set(raw as string[])];
}

function whoOf(raw: unknown): ItemWho | null {
  if (!raw || typeof raw !== 'object') return null;
  const entry = raw as { kind?: unknown; userIds?: unknown };
  if (entry.kind === 'admins' || entry.kind === 'everyone') return { kind: entry.kind };
  if (entry.kind !== 'people' || !Array.isArray(entry.userIds)) return null;
  const userIds = [...new Set(entry.userIds)];
  if (userIds.length === 0 || userIds.length > ITEM_PEOPLE_MAX || !userIds.every((id) => typeof id === 'string' && OBJECT_ID.test(id))) return null;
  return { kind: 'people', userIds: userIds as string[] };
}

/** One item of what the admin sends: only the fields it carries, each checked. */
function settingOf(key: string, entry: Record<string, unknown>): { ok: true; setting: Partial<AppItemSetting> } | { ok: false; message: string } {
  for (const field of ['global', 'direct'] as const) {
    if (entry[field] !== undefined && typeof entry[field] !== 'boolean') return { ok: false, message: `«${field}» de ${key} va como true o false.` };
  }
  const channels = entry.channels === undefined ? undefined : channelsOf(entry.channels);
  if (channels === null) return { ok: false, message: `Los canales de ${key} van como "all", "none" o una lista de ids.` };
  const who = entry.who === undefined ? undefined : whoOf(entry.who);
  if (who === null) return { ok: false, message: `«Quién puede» de ${key} va como admins, everyone o people con una lista de personas.` };
  return {
    ok: true,
    setting: { ...(typeof entry.global === 'boolean' ? { global: entry.global } : {}), ...(channels ? { channels } : {}), ...(typeof entry.direct === 'boolean' ? { direct: entry.direct } : {}), ...(who ? { who } : {}) },
  };
}

/** `{ 'command:clima': { global, channels, direct, who } }`, only for items the app has; what is not sent keeps its value. */
export function validateItemSettings(raw: unknown, known: readonly string[]): { ok: true; settings: StoredItemSettings } | { ok: false; message: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, message: 'Manda un objeto { "command:clima": { global, channels, direct, who } }.' };
  const settings: StoredItemSettings = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!known.includes(key)) return { ok: false, message: `La app no tiene «${key}».` };
    const checked = settingOf(key, value && typeof value === 'object' ? (value as Record<string, unknown>) : {});
    if (!checked.ok) return checked;
    settings[key] = checked.setting;
  }
  return { ok: true, settings };
}
