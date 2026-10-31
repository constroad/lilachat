import { describe, expect, it } from 'vitest';
import { textoDeAviso } from './avisoDeGrupo.js';
import { disappearKeyOf, disappearLabel, disappearNoticeText, disappearSecondsOf, disappearsAtFor, hasDisappeared, isDisappearKey, nextDisappearIn, withoutDisappeared } from './disappearing.js';

const NOW = Date.parse('2026-10-31T12:00:00Z');

describe('disappearing messages (R31/10-B6)', () => {
  it('maps each key to its seconds and back; anything unknown is off', () => {
    // Act / Assert
    expect(disappearSecondsOf('24h')).toBe(86_400);
    expect(disappearSecondsOf('90d')).toBe(7_776_000);
    expect(disappearSecondsOf('off')).toBe(0);
    expect(disappearKeyOf(604_800)).toBe('7d');
    expect(disappearKeyOf(123)).toBe('off');
    expect(disappearKeyOf(undefined)).toBe('off');
    expect(isDisappearKey('7d')).toBe(true);
    expect(isDisappearKey('1y')).toBe(false);
  });

  it('labels a chat as WhatsApp does', () => {
    expect(disappearLabel(86_400)).toBe('24 horas');
    expect(disappearLabel(0)).toBe('Desactivados');
  });

  it('a message sent with the timer on carries its end; with it off, none', () => {
    // Arrange
    const at = new Date(NOW);
    // Act / Assert
    expect(disappearsAtFor(86_400, at)?.toISOString()).toBe('2026-11-01T12:00:00.000Z');
    expect(disappearsAtFor(0, at)).toBeNull();
    expect(disappearsAtFor(55, at)).toBeNull();
  });

  it('hides what passed its time, keeps the rest and an invalid date', () => {
    // Arrange
    const rows = [{ seq: 1, disappearsAt: '2026-10-31T11:59:59Z' }, { seq: 2, disappearsAt: '2026-10-31T12:30:00Z' }, { seq: 3 }, { seq: 4, disappearsAt: 'nope' }];
    // Act
    const visible = withoutDisappeared(rows, NOW);
    // Assert
    expect(visible.map((row) => row.seq)).toEqual([2, 3, 4]);
    expect(hasDisappeared(rows[0]!, NOW)).toBe(true);
    expect(withoutDisappeared([rows[2]!], NOW)).toEqual([rows[2]]);
  });

  it('knows how long until the next one goes, so the screen wakes once and not every second', () => {
    // Arrange
    const rows = [{ disappearsAt: '2026-10-31T12:10:00Z' }, { disappearsAt: '2026-10-31T12:01:00Z' }, { disappearsAt: '2026-10-31T11:00:00Z' }, {}];
    // Act / Assert
    expect(nextDisappearIn(rows, NOW)).toBe(60_000);
    expect(nextDisappearIn([{}], NOW)).toBeNull();
  });

  it('writes the chat notice for on and off, in second person for its author; nothing for an unknown key', () => {
    expect(disappearNoticeText('Ana', '7d')).toBe('Ana activó los mensajes temporales. Los mensajes nuevos desaparecerán después de 7 días.');
    expect(disappearNoticeText('Ana', '24h', true)).toBe('Activaste los mensajes temporales. Los mensajes nuevos desaparecerán después de 24 horas.');
    expect(disappearNoticeText('Ana', 'off')).toBe('Ana desactivó los mensajes temporales.');
    expect(disappearNoticeText('Ana', 'off', true)).toBe('Desactivaste los mensajes temporales.');
    expect(disappearNoticeText('Ana', '1y')).toBe('');
  });
  it('the group notice text knows the event', () => {
    expect(textoDeAviso({ quien: 'Ana', esMio: false, evento: 'temporales', valor: '90d' })).toBe('Ana activó los mensajes temporales. Los mensajes nuevos desaparecerán después de 90 días.');
  });
});
