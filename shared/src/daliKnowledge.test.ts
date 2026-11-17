import { describe, expect, it } from 'vitest';
import { catalogByService, knowledgeViewOf, questionsOf, validateFaqAdd } from './daliKnowledge.js';

/** «Lo que Dali sabe» (dl-12) and «Enseñarle a Dali» (dl-13): agentes answers, Lilachat only shows. */
const answer = {
  services: [
    { key: 'venta_mezcla', name: 'Venta de mezcla', questions: [{ key: 'cantidad', label: '¿Cuántos m³?', required: true }, { key: 'recojo', label: '¿Recoge en planta?' }, { key: 'x' }, { key: 'lugar', label: '¿Dónde es la obra?', required: true, common: true }], price_policy: { visible: true, basis: 'puesto en planta (Cajamarquilla), sin transporte, más IGV' } },
    { key: 'colocacion', name: 'Colocación', questions: [{ key: 'area', label: '¿Cuántos m²?', required: true }, { key: 'lugar', label: '¿Dónde es la obra?', required: true, common: true }], price_policy: { visible: false } },
  ],
  catalog: [
    { service_key: 'venta_mezcla', name: 'Mezcla asfáltica en caliente', unit: 'm³', price: 480 },
    { service_key: 'colocacion', name: 'Colocación de carpeta 2"', unit: 'm²', price: null },
    { service_key: 'retirado', name: 'Algo sin servicio', unit: 'und' },
    { name: 'Sin clave' },
  ],
  faqs: [{ id: 'faq-1', question: '¿Dónde está la planta?', answer: 'En Cajamarquilla, Lurigancho.' }, { id: 'faq-2', question: '' }],
  zone: 'Lima y alrededores',
  hours: 'Lunes a sábado, 7:00 a 17:00',
  edit_url: 'https://agentes.constroad.com/dali/servicios',
};

describe('knowledgeViewOf', () => {
  it('gives an admin the prices and the policy of each service', () => {
    const view = knowledgeViewOf(answer, true);
    expect(view?.services[0]).toEqual({ key: 'venta_mezcla', name: 'Venta de mezcla', questions: [{ key: 'cantidad', label: '¿Cuántos m³?', required: true, common: false }, { key: 'recojo', label: '¿Recoge en planta?', required: false, common: false }, { key: 'lugar', label: '¿Dónde es la obra?', required: true, common: true }], pricePolicy: { visible: true, basis: 'puesto en planta (Cajamarquilla), sin transporte, más IGV' } });
    expect(view?.catalog).toEqual([
      { serviceKey: 'venta_mezcla', name: 'Mezcla asfáltica en caliente', unit: 'm³', price: 480 },
      { serviceKey: 'colocacion', name: 'Colocación de carpeta 2"', unit: 'm²' },
      { serviceKey: 'retirado', name: 'Algo sin servicio', unit: 'und' },
    ]);
    expect(view?.faqs).toEqual([{ id: 'faq-1', question: '¿Dónde está la planta?', answer: 'En Cajamarquilla, Lurigancho.' }]);
    expect(view).toMatchObject({ zone: 'Lima y alrededores', hours: 'Lunes a sábado, 7:00 a 17:00', editUrl: 'https://agentes.constroad.com/dali/servicios' });
  });

  it('still reads questions sent as plain text', () => {
    expect(knowledgeViewOf({ services: [{ key: 'base', name: 'Base', questions: ['¿Cuántos m²?'] }] }, false)?.services[0]?.questions).toEqual([{ label: '¿Cuántos m²?', required: false, common: false }]);
  });

  it('takes the money out for anyone who is not an admin', () => {
    const view = knowledgeViewOf(answer, false);
    expect(view?.services[0]?.pricePolicy).toBeUndefined();
    expect(view?.catalog[0]).toEqual({ serviceKey: 'venta_mezcla', name: 'Mezcla asfáltica en caliente', unit: 'm³' });
  });

  it('is null when agentes did not answer the contract', () => {
    expect(knowledgeViewOf(null, true)).toBeNull();
    expect(knowledgeViewOf({ error: 'boom' }, true)).toBeNull();
  });

  it('drops an edit link that is not https', () => {
    expect(knowledgeViewOf({ ...answer, edit_url: 'javascript:alert(1)' }, true)?.editUrl).toBeUndefined();
  });
});

describe('questionsOf', () => {
  it('shows the questions of every service once, and each service with only its own', () => {
    const questions = questionsOf(knowledgeViewOf(answer, false)!);
    expect(questions.common.map((question) => question.key)).toEqual(['lugar']);
    expect(questions.services.map((service) => [service.key, service.questions.map((question) => question.key)])).toEqual([
      ['venta_mezcla', ['cantidad', 'recojo']],
      ['colocacion', ['area']],
    ]);
  });
});

describe('catalogByService', () => {
  it('groups the catalog under each service, and what has no known service under «Otros»', () => {
    const groups = catalogByService(knowledgeViewOf(answer, true)!);
    expect(groups.map((group) => [group.name, group.items.map((item) => item.name)])).toEqual([
      ['Venta de mezcla', ['Mezcla asfáltica en caliente']],
      ['Colocación', ['Colocación de carpeta 2"']],
      ['Otros', ['Algo sin servicio']],
    ]);
  });
});

describe('validateFaqAdd', () => {
  it('takes a question, its answer and the form key', () => {
    expect(validateFaqAdd({ question: ' ¿Hacen bacheo en Huaral? ', answer: 'Sí, desde 200 m².', idempotency_key: 'teach-0123456789' })).toEqual({ ok: true, faq: { question: '¿Hacen bacheo en Huaral?', answer: 'Sí, desde 200 m².', idempotencyKey: 'teach-0123456789' } });
  });

  it.each([
    [{ question: '', answer: 'x', idempotency_key: 'teach-0123456789' }, 'question'],
    [{ question: 'x', answer: '  ', idempotency_key: 'teach-0123456789' }, 'answer'],
    [{ question: 'x'.repeat(201), answer: 'x', idempotency_key: 'teach-0123456789' }, 'question'],
    [{ question: 'x', answer: 'x'.repeat(1001), idempotency_key: 'teach-0123456789' }, 'answer'],
    [{ question: 'x', answer: 'x', idempotency_key: 'corta' }, 'idempotency_key'],
  ])('refuses %j naming %s', (raw, field) => {
    const valid = validateFaqAdd(raw);
    expect(valid.ok).toBe(false);
    expect(!valid.ok && valid.message).toContain(field);
  });
});
