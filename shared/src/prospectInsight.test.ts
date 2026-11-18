import { describe, expect, it } from 'vitest';
import { maskLongNumbers, validateProspectInsight } from './prospectInsight.js';

/** Dali phase 2 (BOTS-API «Fase 2: contrato», 16/11): what agentes knows about a prospect, sent in the same PUT. */
describe('validateProspectInsight', () => {
  const at = '2026-11-16T15:10:00.000Z';

  it('changes nothing when the PUT brings no phase 2 field (a phase 1 sender keeps working)', () => {
    expect(validateProspectInsight({ phone: '51949123824', last_activity_at: at })).toEqual({ patch: { set: {}, unset: [] }, ignored: [] });
  });

  it('reads every field of the contract into the stored shape', () => {
    const valid = validateProspectInsight({
      stage: 'to_quote',
      service: { key: 'venta_mezcla', name: ' Venta de mezcla ' },
      intent: 'quote',
      score: 82,
      score_reasons: ['Pidió precio y cantidad', ' Obra en Lima '],
      fields: [{ key: 'cantidad', label: 'Cantidad', value: '450 m²' }, { key: 'lugar', label: 'Lugar', value: 'Ate' }],
      missing: ['fecha'],
      ready_at: at,
      kind: 'company',
      summary: 'Asfaltado de 450 m² en Ate',
      follow_up_draft: { text: 'Hola Carmen, ¿pudiste ver la cotización?', for_at: at },
      quote: { code: 'COT-2026-0318', amount: 20231.1, currency: 'PEN', sent_at: at, url: 'https://www.constroad.com/q/318' },
      unanswered: [{ question: '¿Hacen bacheo en Huaral?', at }],
    });
    expect(valid).toEqual({
      ignored: [],
      patch: {
        unset: [],
        set: {
          stage: 'to_quote',
          service: { key: 'venta_mezcla', name: 'Venta de mezcla' },
          intent: 'quote',
          score: 82,
          scoreReasons: ['Pidió precio y cantidad', 'Obra en Lima'],
          fields: [{ key: 'cantidad', label: 'Cantidad', value: '450 m²' }, { key: 'lugar', label: 'Lugar', value: 'Ate' }],
          missing: ['fecha'],
          readyAt: at,
          kind: 'company',
          summary: 'Asfaltado de 450 m² en Ate',
          followUpDraft: { text: 'Hola Carmen, ¿pudiste ver la cotización?', forAt: at },
          quote: { code: 'COT-2026-0318', amount: 20231.1, currency: 'PEN', sentAt: at, url: 'https://www.constroad.com/q/318' },
          unanswered: [{ question: '¿Hacen bacheo en Huaral?', at }],
        },
      },
    });
  });

  it('clears what comes as null and leaves alone what does not come', () => {
    const valid = validateProspectInsight({ follow_up_draft: null, quote: null, score: 40 });
    expect(valid).toEqual({ patch: { set: { score: 40 }, unset: ['followUpDraft', 'quote'] }, ignored: [] });
  });

  it('rounds the score and keeps a number value of a field as text', () => {
    const valid = validateProspectInsight({ score: 69.6, fields: [{ key: 'cantidad', label: 'Cantidad', value: 450 }] });
    expect(valid).toEqual({ patch: { set: { score: 70, fields: [{ key: 'cantidad', label: 'Cantidad', value: '450' }] }, unset: [] }, ignored: [] });
  });

  it('masks numbers of 7 or more digits in the questions Dali could not answer', () => {
    const valid = validateProspectInsight({ unanswered: [{ question: 'Llámame al 949 123 824, mi DNI es 45678912', at }] });
    expect(valid.patch.set.unanswered).toEqual([{ question: 'Llámame al •••, mi DNI es •••', at }]);
  });

  it('keeps a quote with only its code (the amount is optional)', () => {
    expect(validateProspectInsight({ quote: { code: 'COT-1' } })).toEqual({ patch: { set: { quote: { code: 'COT-1' } }, unset: [] }, ignored: [] });
  });

  it.each([
    [{ stage: 'closed' }, 'stage'],
    [{ service: { key: 'Venta Mezcla', name: 'x' } }, 'service.key'],
    [{ service: { key: 'venta_mezcla', name: '' } }, 'service.name'],
    [{ service: { key: 'venta_mezcla', name: 'x'.repeat(61) } }, 'service.name'],
    [{ intent: 'buy' }, 'intent'],
    [{ score: 101 }, 'score'],
    [{ score: '80' }, 'score'],
    [{ score_reasons: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }, 'score_reasons'],
    [{ score_reasons: ['x'.repeat(81)] }, 'score_reasons'],
    [{ fields: [{ key: 'Cantidad', label: 'Cantidad', value: '1' }] }, 'fields'],
    [{ fields: [{ key: 'cantidad', label: 'x'.repeat(41), value: '1' }] }, 'fields'],
    [{ fields: [{ key: 'cantidad', label: 'Cantidad', value: 'x'.repeat(201) }] }, 'fields'],
    [{ fields: [{ key: 'cantidad', label: 'Cantidad', value: '1' }, { key: 'cantidad', label: 'Cantidad', value: '2' }] }, 'fields'],
    [{ fields: Array.from({ length: 21 }, (_, index) => ({ key: `f${index}`, label: 'F', value: '1' })) }, 'fields'],
    [{ fields: [{ key: 'area', label: 'Área', value: '1250 m²', source: 'photo' }] }, 'fields'],
    [{ fields: [{ key: 'area', label: 'Área', value: '1250 m²', source: 'document', file_id: 'f1' }] }, 'fields'],
    [{ missing: ['Fecha'] }, 'missing'],
    [{ ready_at: 'ayer' }, 'ready_at'],
    [{ kind: 'team' }, 'kind'],
    [{ summary: 'x'.repeat(281) }, 'summary'],
    [{ follow_up_draft: { text: '  ' } }, 'follow_up_draft'],
    [{ follow_up_draft: { text: 'Hola', for_at: 'mañana' } }, 'follow_up_draft'],
    [{ quote: { amount: 10 } }, 'quote'],
    [{ quote: { code: 'COT-1', amount: -1 } }, 'quote'],
    [{ quote: { code: 'COT-1', currency: 'soles' } }, 'quote'],
    [{ quote: { code: 'COT-1', url: 'http://x.com' } }, 'quote'],
    [{ unanswered: [{ question: 'x'.repeat(201), at }] }, 'unanswered'],
    [{ unanswered: Array.from({ length: 11 }, () => ({ question: '¿?', at })) }, 'unanswered'],
  ])('leaves %j as it was and tells %s back, keeping the rest of the PUT', (raw, field) => {
    const kept = 'summary' in raw ? { kind: 'person' } : { summary: 'Sigue entrando' };
    const valid = validateProspectInsight({ ...raw, ...kept });
    expect(valid.patch.set).toEqual(kept);
    expect(valid.ignored).toHaveLength(1);
    expect(valid.ignored[0]!.message).toContain(field);
  });
});

describe('maskLongNumbers', () => {
  it.each([
    ['Llámame al 949123824', 'Llámame al •••'],
    ['Mi número es +51 949-123-824', 'Mi número es •••'],
    ['Son 450 m2 y 18 m3', 'Son 450 m2 y 18 m3'],
    ['Cuesta S/ 20,231.10', 'Cuesta S/ 20,231.10'],
  ])('%s → %s', (text, masked) => {
    expect(maskLongNumbers(text)).toBe(masked);
  });
});

/** José 17/11: what Dali reads from a client's document is shown «por confirmar», never as a firm fact. */
describe('a field read from the client\'s document', () => {
  const FILE = '6ade7935c6013f4b0dbc8f86';

  it('keeps where it came from and starts unconfirmed', () => {
    // Act
    const valid = validateProspectInsight({ fields: [{ key: 'area', label: 'Área', value: '1250 m²', source: 'document', file_id: FILE }] });
    // Assert
    expect(valid).toEqual({ patch: { set: { fields: [{ key: 'area', label: 'Área', value: '1250 m²', source: 'document', fileId: FILE, confirmed: false }] }, unset: [] }, ignored: [] });
  });

  it('the client confirmed it: it stays marked as read from the document, confirmed', () => {
    const valid = validateProspectInsight({ fields: [{ key: 'area', label: 'Área', value: '1250 m²', source: 'document', file_id: FILE, confirmed: true }] });
    expect(valid).toMatchObject({ patch: { set: { fields: [{ source: 'document', fileId: FILE, confirmed: true }] } } });
  });

  it('a field the client wrote stays as before, with nothing extra', () => {
    const valid = validateProspectInsight({ fields: [{ key: 'lugar', label: 'Lugar', value: 'Ate' }] });
    expect(valid).toMatchObject({ patch: { set: { fields: [{ key: 'lugar', label: 'Lugar', value: 'Ate' }] } } });
    expect(Object.keys((valid as { patch: { set: { fields: object[] } } }).patch.set.fields[0]!)).toEqual(['key', 'label', 'value']);
  });
});
