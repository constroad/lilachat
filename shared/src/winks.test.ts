import { describe, expect, it } from 'vitest';
import { NUDGE_SHAKE, funArrivedInRow, funMessageToPlay, FUN_LIVE_MS, funNoticeText, isWinkId, shouldPlayFun, WINKS, winkById, winkCardLines, winkCues, winkParticles, winkRowSound } from './winks.js';

describe('the wink catalog', () => {
  it('characters, construction ones and the first emoji ones, each with a name and its length', () => {
    expect(WINKS.filter((wink) => wink.group === 'characters')).toHaveLength(12);
    expect(WINKS.filter((wink) => wink.group === 'site')).toHaveLength(6);
    expect(WINKS.filter((wink) => wink.group === 'emoji')).toHaveLength(8);
    for (const wink of WINKS) {
      expect(wink.name.length).toBeGreaterThan(0);
      if (wink.kind === 'emoji') expect(wink.hero.length).toBeGreaterThan(0);
      if (wink.particlesAt) expect(wink.particles.length, wink.id).toBeGreaterThan(0);
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
    expect(winkById('piggy')).toMatchObject({ name: 'Chancho fiestero', kind: 'character', durationMs: 7000 });
    expect(winkById('balloon')).toMatchObject({ name: 'Globo de agua', kind: 'character', tile: 'balloon' });
    expect(winkById('hearts')).toMatchObject({ name: 'Corazones', kind: 'emoji', hero: '❤️' });
    expect(winkById('nope')).toBeUndefined();
  });
});

describe('winkCues', () => {
  it('an emoji wink plays its sound at once; a sketch plays its cues at their moment', () => {
    expect(winkCues(winkById('hearts')!)).toEqual([{ atMs: 0, sound: 'chime' }]);
    const worker = winkCues(winkById('worker')!);
    expect(worker.filter((cue) => cue.sound === 'knock')).toHaveLength(2);
    expect(worker.find((cue) => cue.sound === 'glass')).toMatchObject({ atMs: 3900, screen: 'crash' });
  });
});

describe('winkRowSound', () => {
  it('a row of the list only dings: an emoji wink plays its own sound, a sketch a «ting», an unknown one a pop', () => {
    expect(winkRowSound(winkById('hearts'))).toBe('chime');
    expect(winkRowSound(winkById('piggy'))).toBe('ting');
    expect(winkRowSound(undefined)).toBe('pop');
  });
});

describe('winkParticles', () => {
  const hearts = winkById('hearts')!;

  it('only inside their window, and none for a sketch without one', () => {
    const balloon = winkById('balloon')!;
    for (const particle of winkParticles(balloon, 3)) expect(particle.delayMs).toBeGreaterThanOrEqual(0.31 * balloon.durationMs - 1);
    expect(winkParticles(winkById('worker')!, 3)).toEqual([]);
  });

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
  it('a wink deleted for everyone before I saw it does not play (22/10)', () => {
    // Arrange
    const deleted = [{ seq: 7, kind: 'guino', senderId: 'ana', wink: 'panda', deletedAt: '2026-10-22T19:12:00.000Z' }];
    // Act
    const fun = funMessageToPlay(deleted, 'jose', 0);
    // Assert
    expect(fun).toBeNull();
  });

  const me = 'jose';
  const rows = [
    { seq: 1, kind: 'text', senderId: 'ana' },
    { seq: 2, kind: 'zumbido', senderId: 'ana' },
    { seq: 3, kind: 'guino', senderId: 'ana', wink: 'hearts' },
    { seq: 4, kind: 'guino', senderId: 'jose', wink: 'party' },
    { seq: 5, kind: 'zumbido', senderId: 'jose' },
  ];

  /** José, 21/10: «el zumbido lo envío pero yo no veo la vibración»: mine also shakes me when it goes. */
  it('the newest after what was seen: what I send also plays for me when it goes, the nudge too', () => {
    expect(funMessageToPlay(rows, me, 0)).toEqual({ seq: 5, kind: 'zumbido', mine: true });
    expect(funMessageToPlay(rows.slice(0, 4), me, 0)).toEqual({ seq: 4, kind: 'guino', wink: 'party', mine: true });
    expect(funMessageToPlay(rows, me, 5)).toBeNull();
    expect(funMessageToPlay(rows.slice(0, 3), me, 1)).toEqual({ seq: 3, kind: 'guino', wink: 'hearts', mine: false });
    expect(funMessageToPlay(rows.slice(0, 2), me, 1)).toEqual({ seq: 2, kind: 'zumbido', mine: false });
  });

  /** José, 21/10: «envío un guiño, salgo y vuelvo a entrar, y se reproduce otra vez». Mine plays when it goes, not when I come back. */
  it('when the chat opens, a wink of MINE is not played again: only one someone sent me', () => {
    expect(funMessageToPlay(rows.slice(0, 4), me, 2, { mineToo: false })).toEqual({ seq: 3, kind: 'guino', wink: 'hearts', mine: false });
    expect(funMessageToPlay([rows[3]!], me, 0, { mineToo: false })).toBeNull();
    expect(funMessageToPlay([rows[3]!], me, 0, { mineToo: true })).toEqual({ seq: 4, kind: 'guino', wink: 'party', mine: true });
    expect(funMessageToPlay([rows[4]!], me, 0, { mineToo: false })).toBeNull();
  });

  /**
   * José, 21/10 (web): «cada vez que ingreso al chat zumba». The chat first
   * draws what it had stored and then the rest of the history arrives; that
   * second batch is not «live». Mine only plays live when it was just sent.
   */
  it('an old nudge of mine that arrives with the history does not play; one I just sent does', () => {
    const now = Date.parse('2026-10-21T15:00:00Z');
    const old = { seq: 7, kind: 'zumbido', senderId: 'jose', at: '2026-10-21T12:40:00Z' };
    const fresh = { seq: 8, kind: 'zumbido', senderId: 'jose', at: '2026-10-21T14:59:58Z' };
    expect(funMessageToPlay([old], me, 0, { mineToo: true, mineSince: now - FUN_LIVE_MS })).toBeNull();
    expect(funMessageToPlay([old, fresh], me, 0, { mineToo: true, mineSince: now - FUN_LIVE_MS })).toEqual({ seq: 8, kind: 'zumbido', mine: true });
    // Someone else's that I had not read still plays once, however old.
    expect(funMessageToPlay([{ seq: 9, kind: 'zumbido', senderId: 'ana', at: '2026-10-21T09:00:00Z' }], me, 0, { mineToo: true, mineSince: now - FUN_LIVE_MS })).toEqual({ seq: 9, kind: 'zumbido', mine: false });
  });

  it('a wink this version does not know is not played', () => {
    expect(funMessageToPlay([{ seq: 9, kind: 'guino', senderId: 'ana', wink: 'chanchito' }], me, 0)).toBeNull();
  });
});

describe('shouldPlayFun', () => {
  /** José, 21/10: Wilson never saw the winks, not even with «Ver otra vez» (a muted chat or the phone's «remove animations» skipped them). */
  it('in the open chat it always plays: muting only silences it, and the phone’s «remove animations» does not hide it', () => {
    expect(shouldPlayFun({ muted: true, reducedMotion: false, place: 'chat' })).toEqual({ animate: true, sound: false, vibrate: false });
    expect(shouldPlayFun({ muted: false, reducedMotion: true, place: 'chat' })).toEqual({ animate: true, sound: true, vibrate: true });
    expect(shouldPlayFun({ muted: false, reducedMotion: false, place: 'chat' })).toEqual({ animate: true, sound: true, vibrate: true });
  });
  it('«Ver otra vez» was asked for: it plays whole, with its sound and its buzz, even in a muted chat', () => {
    expect(shouldPlayFun({ muted: true, reducedMotion: true, place: 'replay' })).toEqual({ animate: true, sound: true, vibrate: true });
  });
  it('a row of the chat list stays still and quiet when muted, and still with reduced motion', () => {
    expect(shouldPlayFun({ muted: true, reducedMotion: false, place: 'row' })).toEqual({ animate: false, sound: false, vibrate: false });
    expect(shouldPlayFun({ muted: false, reducedMotion: true, place: 'row' })).toEqual({ animate: false, sound: true, vibrate: true });
    expect(shouldPlayFun({ muted: false, reducedMotion: false, place: 'row' })).toEqual({ animate: true, sound: true, vibrate: true });
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

describe('winkCardLines', () => {
  /** José, 21/10: the wink line should show a thumbnail of which wink it was; the card has the who and the which apart. */
  it('who on the first line; the wink and the time on the second', () => {
    expect(winkCardLines({ wink: 'panda', mine: false, author: 'Ana', time: '10:44 a. m.' })).toEqual({ who: 'Ana te mandó un guiño', detail: 'Panda abrazón · 10:44 a. m.' });
    expect(winkCardLines({ wink: 'hearts', mine: true })).toEqual({ who: 'Mandaste un guiño', detail: 'Corazones' });
  });
  it('a wink this version does not know: only who, and the time if there is one', () => {
    expect(winkCardLines({ wink: 'chanchito', mine: false, time: '9:00 a. m.' })).toEqual({ who: 'Te mandaron un guiño', detail: '9:00 a. m.' });
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
