import { describe, expect, it } from 'vitest';
import { enabledAt, itemKey, itemSettingOf, validateItemSettings } from './appItems.js';

/** Which commands and actions of an app work where (José, 23/10: «solo algunos van a ser globales»). */
const PLANTA = '6ad8b0cb30ce97957f4acc04';
const CAJA = '6ad8b0cb30ce97957f4acc05';

describe('the setting of a command or an action', () => {
  it('untouched: an action is in the space\'s ⚡ and in every channel; a command only in the channels', () => {
    expect(itemSettingOf(undefined, 'shortcut', 'marcar_asistencia')).toEqual({ global: true, channels: 'all' });
    expect(itemSettingOf({}, 'command', 'clima')).toEqual({ global: false, channels: 'all' });
  });

  it('what the admin saved wins, field by field', () => {
    const stored = { [itemKey('command', 'clima')]: { global: true }, [itemKey('shortcut', 'medir_tanque')]: { channels: [PLANTA] } };
    expect(itemSettingOf(stored, 'command', 'clima')).toEqual({ global: true, channels: 'all' });
    expect(itemSettingOf(stored, 'shortcut', 'medir_tanque')).toEqual({ global: true, channels: [PLANTA] });
  });
});

describe('where it works', () => {
  it('the ⚡ asks for global; a chat for its channel; «all» covers any chat, «none» none', () => {
    expect(enabledAt({ global: true, channels: 'none' }, 'space')).toBe(true);
    expect(enabledAt({ global: false, channels: 'all' }, 'space')).toBe(false);
    expect(enabledAt({ global: false, channels: 'all' }, { chatId: CAJA })).toBe(true);
    expect(enabledAt({ global: true, channels: [PLANTA] }, { chatId: PLANTA })).toBe(true);
    expect(enabledAt({ global: true, channels: [PLANTA] }, { chatId: CAJA })).toBe(false);
    expect(enabledAt({ global: true, channels: 'none' }, { chatId: PLANTA })).toBe(false);
  });
});

describe('what the admin sends (a partial map)', () => {
  const known = [itemKey('command', 'clima'), itemKey('shortcut', 'marcar_asistencia')];

  it('keeps known items with a boolean global and «all», «none» or channel ids', () => {
    expect(validateItemSettings({ 'command:clima': { global: true, channels: 'none' }, 'shortcut:marcar_asistencia': { channels: [PLANTA, PLANTA] } }, known)).toEqual({
      ok: true,
      settings: { 'command:clima': { global: true, channels: 'none' }, 'shortcut:marcar_asistencia': { channels: [PLANTA] } },
    });
  });

  it('refuses an item the app does not have, or a bad value, saying which', () => {
    const unknown = validateItemSettings({ 'command:planilla': { global: true } }, known);
    expect(unknown.ok ? '' : unknown.message).toMatch(/planilla/);
    expect(validateItemSettings({ 'command:clima': { global: 'sí' } }, known).ok).toBe(false);
    expect(validateItemSettings({ 'command:clima': { channels: ['#planta'] } }, known).ok).toBe(false);
    expect(validateItemSettings([], known).ok).toBe(false);
  });
});
