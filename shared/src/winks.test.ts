import { describe, expect, it } from 'vitest';
import { NUDGE_SHAKE, funArrivedInRow, funMessageToPlay, funNoticeText, isWinkId, shouldPlayFun, WINKS, winkById, winkParticles } from './winks.js';

describe('the wink catalog', () => {
  it('characters, construction ones and the first emoji ones, each with a name, particles and a sound', () => {
    expect(WINKS.filter((wink) => wink.group === 'characters')).toHaveLength(9);
    expect(WINKS.filter((wink) => wink.group === 'site')).toHaveLength(6);
    expect(WINKS.filter((wink) => wink.group === 'emoji')).toHaveLength(8);
    for (const wink of WINKS) {
      expect(wink.name.length).toBeGreaterThan(0);
      expect(wink.kind === 'character' ? wink.dance.length : wink.hero.length).toBeGreaterThan(0);
      expect(wink.particles.length).toBeGreaterThan(0);
      expect(wink.durationMs).toBeGreaterThanOrEqual(1500);
      expect(wink.durationMs).toBeLessThanOrEqual(wink.kind === 'character' ? 7000 : 4000);
      if (wink.kind === 'character') expect(wink.durationMs, wink.id).toBeGreaterThanOrEqual(6000);
    }
    expect(new Set(WINKS.map((wink) => wink.id)).size).toBe(WINKS.length);
  });

  it('knows its ids and nothing else', () => {
    expect(isWinkId('hearts')).toBe(true);
    expect(isWinkId('chanchito')).toBe(false);
    expect(isWinkId(undefined)).toBe(false);
    expect(winkById('party')?.name).toBe('Fiesta');
    expect(winkById('piggy')).toMatchObject({ name: 'Chancho fiestero', kind: 'character', dance: 'disco', sound: 'groove' });
    expect(winkById('hearts')).toMatchObject({ name: 'Corazones', kind: 'emoji', hero: '❤️' });
    expect(winkById('nope')).toBeUndefined();
  });
});

describe('winkParticles', () => {
  const hearts = winkById('hearts')!;

  it('is the same on every device for the same message (seeded by its seq)', () => {
    expect(winkParticles(hearts, 42)).toEqual(winkParticles(hearts, 42));
    expect(winkParticles(hearts, 42)).not.toEqual(winkParticles(hearts, 43));
  });

  it('stays inside the screen width and ends before the wink does', () => {
    for (const wink of WINKS) {
      for (const particle of winkParticles(wink, 7)) {
        expect(particle.fromX).toBeGreaterThanOrEqual(0);
        expect(particle.fromX).toBeLessThanOrEqual(1);
        expect(particle.delayMs + particle.durationMs).toBeLessThanOrEqual(wink.durationMs);
        expect(wink.particles).toContain(particle.glyph);
      }
    }
  });

  it('rising particles go up, rain comes down, a burst leaves the center', () => {
    const rise = winkParticles(hearts, 1);
    expect(rise.every((particle) => particle.toY < particle.fromY)).toBe(true);
    const rain = winkParticles(winkById('party')!, 1);
    expect(rain.every((particle) => particle.toY > particle.fromY)).toBe(true);
    const burst = winkParticles(winkById('applause')!, 1);
    expect(burst.every((particle) => particle.fromX === 0.5 && particle.fromY === 0.5)).toBe(true);
  });
});

describe('funMessageToPlay', () => {
  const me = 'jose';
  const rows = [
    { seq: 1, kind: 'text', senderId: 'ana' },
    { seq: 2, kind: 'zumbido', senderId: 'ana' },
    { seq: 3, kind: 'guino', senderId: 'ana', wink: 'hearts' },
    { seq: 4, kind: 'guino', senderId: 'jose', wink: 'party' },
    { seq: 5, kind: 'zumbido', senderId: 'jose' },
  ];

  it('the newest after what was seen: a wink I sent also plays for me, my own nudge does not shake me', () => {
    expect(funMessageToPlay(rows, me, 0)).toEqual({ seq: 4, kind: 'guino', wink: 'party', mine: true });
    expect(funMessageToPlay(rows, me, 4)).toBeNull();
    expect(funMessageToPlay(rows.slice(0, 3), me, 1)).toEqual({ seq: 3, kind: 'guino', wink: 'hearts', mine: false });
    expect(funMessageToPlay(rows.slice(0, 2), me, 1)).toEqual({ seq: 2, kind: 'zumbido', mine: false });
  });

  it('a wink this version does not know is not played', () => {
    expect(funMessageToPlay([{ seq: 9, kind: 'guino', senderId: 'ana', wink: 'chanchito' }], me, 0)).toBeNull();
  });
});

describe('shouldPlayFun', () => {
  it('a muted chat does not move, sound or vibrate', () => {
    expect(shouldPlayFun({ muted: true, reducedMotion: false })).toEqual({ animate: false, sound: false, vibrate: false });
  });
  it('with reduced motion: no animation, but it still sounds and vibrates', () => {
    expect(shouldPlayFun({ muted: false, reducedMotion: true })).toEqual({ animate: false, sound: true, vibrate: true });
  });
  it('otherwise everything', () => {
    expect(shouldPlayFun({ muted: false, reducedMotion: false })).toEqual({ animate: true, sound: true, vibrate: true });
  });
});

describe('funNoticeText', () => {
  it('who sent which wink, in neutral Spanish', () => {
    expect(funNoticeText({ kind: 'guino', wink: 'hearts', mine: false, author: 'Ana' })).toBe('Ana te mandó un guiño · Corazones');
    expect(funNoticeText({ kind: 'guino', wink: 'piggy', mine: true })).toBe('Mandaste un guiño · Chancho fiestero');
    expect(funNoticeText({ kind: 'guino', wink: 'hearts', mine: false })).toBe('Te mandaron un guiño · Corazones');
    expect(funNoticeText({ kind: 'guino', wink: 'chanchito', mine: false, author: 'Ana' })).toBe('Ana te mandó un guiño');
  });
});

describe('funArrivedInRow', () => {
  const nudge = { seq: 8, kind: 'zumbido', senderId: 'ana' };
  it('a nudge or wink from someone else that just came', () => {
    expect(funArrivedInRow(7, nudge, 'jose')).toBe('zumbido');
    expect(funArrivedInRow(7, { ...nudge, kind: 'guino' }, 'jose')).toBe('guino');
  });
  it('not on the first look, not twice, not mine, not a text', () => {
    expect(funArrivedInRow(undefined, nudge, 'jose')).toBeNull();
    expect(funArrivedInRow(8, nudge, 'jose')).toBeNull();
    expect(funArrivedInRow(7, { ...nudge, senderId: 'jose' }, 'jose')).toBeNull();
    expect(funArrivedInRow(7, { ...nudge, kind: 'text' }, 'jose')).toBeNull();
    expect(funArrivedInRow(7, null, 'jose')).toBeNull();
  });
});

describe('NUDGE_SHAKE', () => {
  it('lasts about 2 seconds of quick sideways swings (José, 21/10) and ends where it started', () => {
    const totalMs = NUDGE_SHAKE.path.length * NUDGE_SHAKE.stepMs;
    expect(totalMs).toBeGreaterThanOrEqual(1900);
    expect(totalMs).toBeLessThanOrEqual(2100);
    expect(NUDGE_SHAKE.stepMs).toBeLessThan(75);
    expect(NUDGE_SHAKE.path.at(-1)).toBe(0);
  });
});
