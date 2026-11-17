import { describe, expect, it } from 'vitest';
import { LOSS_REASON_LABEL, LOSS_REASONS, NEXT_ACTION_LABEL, validateSellerChange } from './prospectSeller.js';

/** What a seller decides about a prospect in Lilachat (BOTS-API «Fase 2: contrato», 16/11). */
describe('validateSellerChange', () => {
  const at = '2026-11-18T14:00:00.000Z';
  const member = '6aecc7a354a328c01722f256';

  it('takes the prospect for the person who asks', () => {
    expect(validateSellerChange({ version: 3, assignee: 'me' })).toEqual({ ok: true, change: { version: 3, assignee: 'me' } });
  });

  it('gives it to another member, or leaves it without anyone', () => {
    expect(validateSellerChange({ version: 0, assignee: { id: member } })).toEqual({ ok: true, change: { version: 0, assignee: { id: member } } });
    expect(validateSellerChange({ version: 1, assignee: null })).toEqual({ ok: true, change: { version: 1, assignee: null } });
  });

  it('sets the next action with its reminder on by default', () => {
    const valid = validateSellerChange({ version: 2, next_action: { kind: 'call', at, note: ' Preguntar por la fecha ' } });
    expect(valid).toEqual({ ok: true, change: { version: 2, nextAction: { kind: 'call', at, note: 'Preguntar por la fecha', remind: true } } });
  });

  it('gives the next action to another member and can skip the reminder', () => {
    const valid = validateSellerChange({ version: 2, next_action: { kind: 'visit', at, assignee_id: member, remind: false } });
    expect(valid).toEqual({ ok: true, change: { version: 2, nextAction: { kind: 'visit', at, assigneeId: member, remind: false } } });
  });

  it('marks it lost with its reason, or won, or reopens it', () => {
    expect(validateSellerChange({ version: 5, result: { outcome: 'lost', reason: 'price' } })).toEqual({ ok: true, change: { version: 5, result: { outcome: 'lost', reason: 'price' } } });
    expect(validateSellerChange({ version: 5, result: { outcome: 'won', note: 'Firmó el viernes' } })).toEqual({ ok: true, change: { version: 5, result: { outcome: 'won', note: 'Firmó el viernes' } } });
    expect(validateSellerChange({ version: 6, result: null })).toEqual({ ok: true, change: { version: 6, result: null } });
  });

  it.each([
    [{ assignee: 'me' }, 'version'],
    [{ version: -1, assignee: 'me' }, 'version'],
    [{ version: 1.5, assignee: 'me' }, 'version'],
    [{ version: 1 }, 'Nada'],
    [{ version: 1, assignee: 'rosa' }, 'assignee'],
    [{ version: 1, assignee: { id: '12' } }, 'assignee'],
    [{ version: 1, next_action: { kind: 'email', at } }, 'next_action.kind'],
    [{ version: 1, next_action: { kind: 'call', at: 'mañana' } }, 'next_action.at'],
    [{ version: 1, next_action: { kind: 'call', at, assignee_id: 'x' } }, 'next_action.assignee_id'],
    [{ version: 1, next_action: { kind: 'call', at, note: 'x'.repeat(201) } }, 'next_action.note'],
    [{ version: 1, result: { outcome: 'paused' } }, 'result.outcome'],
    [{ version: 1, result: { outcome: 'lost' } }, 'result.reason'],
    [{ version: 1, result: { outcome: 'lost', reason: 'weather' } }, 'result.reason'],
    [{ version: 1, result: { outcome: 'lost', reason: 'other' } }, 'result.note'],
    [{ version: 1, result: { outcome: 'won', reason: 'price' } }, 'result.reason'],
    [{ version: 1, result: { outcome: 'won', note: 'x'.repeat(281) } }, 'result.note'],
  ])('refuses %j naming %s', (raw, field) => {
    const valid = validateSellerChange(raw);
    expect(valid.ok).toBe(false);
    expect(!valid.ok && valid.message).toContain(field);
  });
});

describe('labels', () => {
  it('names every loss reason and next action in Spanish', () => {
    expect(LOSS_REASONS.map((reason) => LOSS_REASON_LABEL[reason])).toEqual(['Precio', 'No era el momento', 'Fuera de zona', 'Compró a otro', 'No respondió', 'Solo consultaba', 'Otro']);
    expect(Object.values(NEXT_ACTION_LABEL)).toEqual(['Llamar', 'Escribir por WhatsApp', 'Visita técnica', 'Enviar cotización']);
  });
});
