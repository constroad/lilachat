/**
 * Where each command and action of an app works in a space (R160; José,
 * 23/10: only some commands are meant to be global). The space's admin decides, per item: whether it is in the space's
 * ⚡ (global) and in which channels. PURE: the server enforces it, the app and
 * the web draw the switches with it.
 */
export type AppItemKind = 'command' | 'shortcut';
export type ItemChannels = 'all' | 'none' | string[];
export type AppItemSetting = { global: boolean; channels: ItemChannels };
/** A row of «Comandos y acciones»: the item, what it is and where it works. */
export type AppItemRow = AppItemSetting & { kind: AppItemKind; key: string; name: string; description?: string };
export type StoredItemSettings = Record<string, Partial<AppItemSetting>>;
/** Where it is used: the space's ⚡, or a chat. */
export type ItemPlace = 'space' | { chatId: string };

const OBJECT_ID = /^[a-f0-9]{24}$/;
/** A space has a handful of channels; this bounds what one item can list. */
export const ITEM_CHANNELS_MAX = 200;

export const itemKey = (kind: AppItemKind, key: string): string => `${kind}:${key}`;

/** Untouched, an action is global and a command is not; both work in every channel. */
export function itemSettingOf(stored: StoredItemSettings | undefined, kind: AppItemKind, key: string): AppItemSetting {
  const saved = stored?.[itemKey(kind, key)] ?? {};
  return { global: saved.global ?? kind === 'shortcut', channels: saved.channels ?? 'all' };
}

export function enabledAt(setting: AppItemSetting, place: ItemPlace): boolean {
  if (place === 'space') return setting.global;
  if (setting.channels === 'all' || setting.channels === 'none') return setting.channels === 'all';
  return setting.channels.includes(place.chatId);
}

function channelsOf(raw: unknown): ItemChannels | null {
  if (raw === 'all' || raw === 'none') return raw;
  if (!Array.isArray(raw) || raw.length > ITEM_CHANNELS_MAX || !raw.every((id) => typeof id === 'string' && OBJECT_ID.test(id))) return null;
  return [...new Set(raw as string[])];
}

/** `{ 'command:clima': { global, channels } }`, only for items the app has; what is not sent keeps its value. */
export function validateItemSettings(raw: unknown, known: readonly string[]): { ok: true; settings: StoredItemSettings } | { ok: false; message: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, message: 'Manda un objeto { "command:clima": { global, channels } }.' };
  const settings: StoredItemSettings = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!known.includes(key)) return { ok: false, message: `La app no tiene «${key}».` };
    const entry = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
    if (entry.global !== undefined && typeof entry.global !== 'boolean') return { ok: false, message: `«global» de ${key} va como true o false.` };
    const channels = entry.channels === undefined ? undefined : channelsOf(entry.channels);
    if (channels === null) return { ok: false, message: `Los canales de ${key} van como "all", "none" o una lista de ids.` };
    settings[key] = { ...(typeof entry.global === 'boolean' ? { global: entry.global } : {}), ...(channels ? { channels } : {}) };
  }
  return { ok: true, settings };
}
