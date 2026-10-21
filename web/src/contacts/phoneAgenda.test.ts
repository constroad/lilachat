import { describe, expect, it, vi } from 'vitest';
import type { BaseLocal } from '../local/baseLocal';
import { agendaNameFor, chatNameWithAgenda, getAgendaNames, loadAgendaNames, mergeAgendaNames, requestAgendaNames, setAgendaAsker } from './phoneAgenda';

function fakeBase(saved?: Record<string, string>) {
  const put = vi.fn(() => Promise.resolve());
  const base = { meta: { get: vi.fn(() => Promise.resolve(saved ? { clave: 'agenda', valor: saved } : undefined)), put } } as unknown as BaseLocal;
  return { base, put };
}

/** Contacts on the web through the phone (José, 20/10, option «b»). */
describe('phone agenda on the web', () => {
  it('loads what was saved, and the phone answer wins and is saved', async () => {
    const { base, put } = fakeBase({ '960397018': 'Wilson' });
    await loadAgendaNames(base);
    expect(getAgendaNames().get('960397018')).toBe('Wilson');

    mergeAgendaNames(base, { '960397018': 'Wilson albañil', '902049935': 'Mamá' });
    expect(getAgendaNames().get('960397018')).toBe('Wilson albañil');
    expect(put).toHaveBeenCalledWith({ clave: 'agenda', valor: { '960397018': 'Wilson albañil', '902049935': 'Mamá' } });
  });

  it('another user in the same tab does not see the previous names', async () => {
    const { base } = fakeBase();
    await loadAgendaNames(base);
    expect(getAgendaNames().size).toBe(0);
  });

  it('numbers asked before the socket are asked when it connects, and again on each connection', async () => {
    const { base } = fakeBase();
    await loadAgendaNames(base);
    setAgendaAsker(null);
    requestAgendaNames(['960 397 018', undefined, '960397018']);
    const ask = vi.fn();
    setAgendaAsker(ask);
    expect(ask).toHaveBeenCalledWith(['960397018']);

    requestAgendaNames(['960397018', '902049935']);
    expect(ask).toHaveBeenLastCalledWith(['902049935']);

    setAgendaAsker(null);
    setAgendaAsker(ask);
    expect(ask).toHaveBeenLastCalledWith(['960397018', '902049935']);
  });

  it('a 1:1 chat takes the saved name; groups and «Tú» keep theirs', () => {
    const agenda = new Map([['960397018', 'Wilson']]);
    expect(chatNameWithAgenda({ kind: 'direct', phone: '+51960397018', name: '960397018' }, agenda).name).toBe('Wilson');
    expect(chatNameWithAgenda({ kind: 'group', phone: '960397018', name: 'Obra' }, agenda).name).toBe('Obra');
    expect(chatNameWithAgenda({ kind: 'direct', propio: true, phone: '960397018', name: 'Tú' }, agenda).name).toBe('Tú');
    expect(agendaNameFor(undefined, agenda)).toBeUndefined();
  });
});
