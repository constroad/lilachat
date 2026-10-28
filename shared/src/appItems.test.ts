import { describe, expect, it } from 'vitest';
import { ALL_OFF, allOffSettings, enabledAt, itemIsOn, itemKey, itemSettingOf, mayUseItem, sameItemSetting, validateItemSettings } from './appItems.js';

/** Which commands and actions of an app work where, and for whom (José, 23/10 and 28/10: everything starts off). */
const PLANTA = '6ad8b0cb30ce97957f4acc04';
const CAJA = '6ad8b0cb30ce97957f4acc05';
const ANA = '6ad8b0cb30ce97957f4acc06';
const LUIS = '6ad8b0cb30ce97957f4acc07';

describe('the setting of a command or an action', () => {
  it('untouched: off everywhere, and only admins once turned on (José, 28/10)', () => {
    expect(itemSettingOf(undefined, 'shortcut', 'marcar_asistencia')).toEqual(ALL_OFF);
    expect(itemSettingOf({}, 'command', 'clima')).toEqual({ global: false, channels: 'none', direct: false, who: { kind: 'admins' } });
  });

  it('what the admin saved wins, field by field', () => {
    const stored = { [itemKey('command', 'clima')]: { global: true, who: { kind: 'everyone' as const } }, [itemKey('shortcut', 'medir_tanque')]: { channels: [PLANTA], direct: true } };
    expect(itemSettingOf(stored, 'command', 'clima')).toEqual({ global: true, channels: 'none', direct: false, who: { kind: 'everyone' } });
    expect(itemSettingOf(stored, 'shortcut', 'medir_tanque')).toEqual({ global: false, channels: [PLANTA], direct: true, who: { kind: 'admins' } });
  });
});

describe('where it works', () => {
  it('the ⚡ asks for global; a chat for its channel; the 1:1 with the app for direct', () => {
    const on = { ...ALL_OFF, global: true, channels: [PLANTA] };
    expect(enabledAt({ ...ALL_OFF, global: true }, 'space')).toBe(true);
    expect(enabledAt({ ...ALL_OFF, channels: 'all' }, 'space')).toBe(false);
    expect(enabledAt({ ...ALL_OFF, channels: 'all' }, { chatId: CAJA })).toBe(true);
    expect(enabledAt(on, { chatId: PLANTA })).toBe(true);
    expect(enabledAt(on, { chatId: CAJA })).toBe(false);
    expect(enabledAt({ ...ALL_OFF, global: true }, { chatId: PLANTA })).toBe(false);
    expect(enabledAt(on, 'direct')).toBe(false);
    expect(enabledAt({ ...ALL_OFF, direct: true }, 'direct')).toBe(true);
  });
});

describe('who may use it', () => {
  const member = { userId: ANA, spaceAdmin: false };
  const admin = { userId: LUIS, spaceAdmin: true };

  it('«admins» only the space admins; «everyone» any member', () => {
    expect(mayUseItem(ALL_OFF, member)).toBe(false);
    expect(mayUseItem(ALL_OFF, admin)).toBe(true);
    expect(mayUseItem({ ...ALL_OFF, who: { kind: 'everyone' } }, member)).toBe(true);
  });

  it('«people» the ones chosen, and the admins always (they turn it on and try it)', () => {
    const chosen = { ...ALL_OFF, who: { kind: 'people' as const, userIds: [ANA] } };
    expect(mayUseItem(chosen, member)).toBe(true);
    expect(mayUseItem(chosen, { userId: CAJA, spaceAdmin: false })).toBe(false);
    expect(mayUseItem(chosen, admin)).toBe(true);
  });
});

describe('the migration to all off', () => {
  it('writes every item explicitly, so a later default cannot turn one on', () => {
    expect(allOffSettings(['command:clima', 'shortcut:marcar_asistencia'])).toEqual({ 'command:clima': ALL_OFF, 'shortcut:marcar_asistencia': ALL_OFF });
    expect(allOffSettings([])).toEqual({});
  });
});

describe('what the admin sends (a partial map)', () => {
  const known = [itemKey('command', 'clima'), itemKey('shortcut', 'marcar_asistencia')];

  it('keeps known items with a boolean global and direct, «all», «none» or channel ids, and who', () => {
    expect(
      validateItemSettings({ 'command:clima': { global: true, channels: 'none', direct: true, who: { kind: 'people', userIds: [ANA, ANA, LUIS] } }, 'shortcut:marcar_asistencia': { channels: [PLANTA, PLANTA], who: { kind: 'everyone' } } }, known)
    ).toEqual({
      ok: true,
      settings: { 'command:clima': { global: true, channels: 'none', direct: true, who: { kind: 'people', userIds: [ANA, LUIS] } }, 'shortcut:marcar_asistencia': { channels: [PLANTA], who: { kind: 'everyone' } } },
    });
  });

  it('refuses an item the app does not have, or a bad value, saying which', () => {
    const unknown = validateItemSettings({ 'command:planilla': { global: true } }, known);
    expect(unknown.ok ? '' : unknown.message).toMatch(/planilla/);
    expect(validateItemSettings({ 'command:clima': { global: 'sí' } }, known).ok).toBe(false);
    expect(validateItemSettings({ 'command:clima': { direct: 1 } }, known).ok).toBe(false);
    expect(validateItemSettings({ 'command:clima': { channels: ['#planta'] } }, known).ok).toBe(false);
    expect(validateItemSettings({ 'command:clima': { who: { kind: 'jefes' } } }, known).ok).toBe(false);
    expect(validateItemSettings({ 'command:clima': { who: { kind: 'people', userIds: [] } } }, known).ok).toBe(false);
    expect(validateItemSettings({ 'command:clima': { who: { kind: 'people', userIds: ['ana'] } } }, known).ok).toBe(false);
    expect(validateItemSettings([], known).ok).toBe(false);
  });
});

describe('«Encendido» or «Apagado» and what changed (design d-01)', () => {
  it('on when it works somewhere: the ⚡, a channel or the 1:1 with the app', () => {
    expect(itemIsOn(ALL_OFF)).toBe(false);
    expect(itemIsOn({ ...ALL_OFF, channels: [] })).toBe(false);
    expect(itemIsOn({ ...ALL_OFF, direct: true })).toBe(true);
    expect(itemIsOn({ ...ALL_OFF, global: true })).toBe(true);
    expect(itemIsOn({ ...ALL_OFF, channels: ['aaaaaaaaaaaaaaaaaaaaaaaa'] })).toBe(true);
    expect(itemIsOn({ ...ALL_OFF, channels: 'all' })).toBe(true);
  });

  it('the same setting in another order is not a change; who and the 1:1 are', () => {
    const before = { ...ALL_OFF, channels: ['a', 'b'], who: { kind: 'people' as const, userIds: ['u1', 'u2'] } };
    expect(sameItemSetting(before, { ...before, channels: ['b', 'a'], who: { kind: 'people', userIds: ['u2', 'u1'] } })).toBe(true);
    expect(sameItemSetting(before, { ...before, direct: true })).toBe(false);
    expect(sameItemSetting(before, { ...before, who: { kind: 'everyone' } })).toBe(false);
  });
});

describe('before the migration to all off', () => {
  it('an installation keeps the old defaults: actions global, every channel, the 1:1, anyone; what was saved still counts', () => {
    expect(itemSettingOf(undefined, 'shortcut', 'marcar', true)).toEqual({ global: true, channels: 'all', direct: true, who: { kind: 'everyone' } });
    expect(itemSettingOf(undefined, 'command', 'clima', true)).toEqual({ global: false, channels: 'all', direct: true, who: { kind: 'everyone' } });
    expect(itemSettingOf({ 'command:clima': { channels: [PLANTA] } }, 'command', 'clima', true)).toEqual({ global: false, channels: [PLANTA], direct: true, who: { kind: 'everyone' } });
    expect(itemSettingOf(undefined, 'command', 'clima')).toEqual(ALL_OFF);
  });
});
