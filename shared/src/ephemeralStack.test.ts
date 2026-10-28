import { describe, expect, it } from 'vitest';
import type { EphemeralAnswer } from './botCommands.js';
import { canCloseAll, ephemeralLabel, ephemeralSummary, openAnswerId, toggleAnswer, type StackChoice } from './ephemeralStack.js';

const answer = (commandId: string, extra: Partial<EphemeralAnswer> = {}): EphemeralAnswer => ({ commandId, appName: 'Inframaq', command: 'tanques', state: 'answered', ...extra });
const fresh: StackChoice = { open: null, newest: null };

/** «Solo tú ves esto» as chips like Claude's (pending 104, design c-01): one open, the rest folded in a line. */
describe('the stack of answers only I see', () => {
  it('the newest answer opens by itself; the others stay folded', () => {
    expect(openAnswerId([answer('a'), answer('b')], fresh)).toBe('b');
    expect(openAnswerId([], fresh)).toBeNull();
  });

  it('opening another folds the one that was open, and tapping it again folds it', () => {
    const list = [answer('a'), answer('b')];
    const chosen = toggleAnswer(list, fresh, 'a');
    expect(openAnswerId(list, chosen)).toBe('a');
    expect(openAnswerId(list, toggleAnswer(list, chosen, 'a'))).toBeNull();
  });

  it('a new answer opens over what I had chosen', () => {
    const list = [answer('a'), answer('b')];
    const chosen = toggleAnswer(list, fresh, 'a');
    expect(openAnswerId([...list, answer('c')], chosen)).toBe('c');
  });

  it('a chosen answer that was dismissed leaves everything folded', () => {
    const list = [answer('a'), answer('b'), answer('c')];
    const chosen = toggleAnswer(list, fresh, 'a');
    expect(openAnswerId([answer('b'), answer('c')], chosen)).toBeNull();
  });

  it('«Cerrar todas» only with two or more', () => {
    expect(canCloseAll([answer('a')])).toBe(false);
    expect(canCloseAll([answer('a'), answer('b')])).toBe(true);
  });
});

describe('what a folded chip says in one line', () => {
  it('the first line of the text, or the card summary', () => {
    expect(ephemeralSummary(answer('a', { response: { responseType: 'ephemeral', text: 'Tanque 1 al 62 %\nTanque 2 al 18 %' } }))).toBe('Tanque 1 al 62 %');
    expect(ephemeralSummary(answer('a', { response: { responseType: 'ephemeral', card: { title: 'Pedidos de hoy', status: { label: '3 programados', tone: 'info' } } } }))).toBe('Pedidos de hoy · 3 programados');
  });

  it('working, failed and a form say so', () => {
    expect(ephemeralSummary(answer('a', { state: 'pending' }))).toBe('Inframaq está trabajando…');
    expect(ephemeralSummary(answer('a', { state: 'failed', message: 'Inframaq no respondió a tiempo.' }))).toBe('Inframaq no respondió a tiempo.');
    expect(ephemeralSummary(answer('a', { state: 'form', response: { responseType: 'form', form: { id: 'f', title: 'Marcar asistencia', schema: { type: 'object', properties: {} } } } }))).toBe('Abrir «Marcar asistencia»');
  });

  it('the label is the action of the ⚡ or the /command', () => {
    expect(ephemeralLabel(answer('a'))).toBe('/tanques');
    expect(ephemeralLabel(answer('a', { action: 'Marcar asistencia' }))).toBe('Marcar asistencia');
    expect(ephemeralLabel(answer('a', { command: '' }))).toBe('');
  });
});
