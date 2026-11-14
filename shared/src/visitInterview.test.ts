import { describe, expect, it } from 'vitest';
import { visitDocumentOf } from './siteVisit.js';
import { VISIT_WITH_ID } from './siteVisit.fixture.js';
import { interviewOf } from './visitInterview.js';

/** The interview as lv03 draws it: one card per question, its options as chips, what is answered. */
const document = visitDocumentOf(VISIT_WITH_ID)!;

describe('the interview of lv03', () => {
  it('lists Portal\'s questions in order, with their options and what is saved', () => {
    // Act
    const interview = interviewOf(document)!;
    // Assert
    expect(interview.questions[0]).toEqual({ key: 'r01', n: 1, title: 'Pregunta q1', options: [{ value: 'si', label: 'Sí' }, { value: 'no', label: 'No' }], value: 'no' });
    expect(interview.questions[1]).toMatchObject({ key: 'r02', n: 2, options: expect.arrayContaining([{ value: 'Arcilla', label: 'Arcilla' }]) });
    expect(interview.questions[1]!.value).toBeUndefined();
  });
  it('counts the answered and points to the first one without an answer', () => {
    const interview = interviewOf(document)!;
    expect(interview.answered).toBe(1);
    expect(interview.total).toBe(interview.questions.length);
    expect(interview.next).toBe('r02');
  });
  it('a question without options is written, with its unit (Portal: «Área aproximada», x-unit m²)', () => {
    // Arrange
    const section = document.sections.find((one) => one.id === 'entrevista')!;
    const form = document.forms[section.form!]!;
    const withArea = { ...document, forms: { ...document.forms, [section.form!]: { ...form, properties: { ...form.properties, r99: { type: 'string', title: 'Área aproximada', 'x-unit': 'm²', maxLength: 200 } } } } };
    // Act
    const area = interviewOf(withArea)!.questions.find((question) => question.key === 'r99')!;
    // Assert
    expect(area).toMatchObject({ options: [], unit: 'm²', maxLength: 200 });
  });
  it('a visit without interview questions has no interview', () => {
    const empty = { ...document, sections: document.sections.filter((section) => section.id !== 'entrevista') };
    expect(interviewOf(empty)).toBeNull();
  });
});
