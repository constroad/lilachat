import { describe, expect, it } from 'vitest';
import { validateFaqAdd } from './daliKnowledge.js';
import { askedNoteOf, askedTimesText, daliFailureOf, TEACH_ANSWER_MAX, TEACH_QUESTION_MAX, teachProblemOf } from './daliTeach.js';

/** «Lo que Dali sabe» (dl-12) and «Enseñarle a Dali» (dl-13): what the web and the APK say around agentes' answers. */
const KEY = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

describe('the limits of a taught answer', () => {
  it('are the ones the server takes, not one character more', () => {
    // Arrange
    const longest = { question: 'q'.repeat(TEACH_QUESTION_MAX), answer: 'a'.repeat(TEACH_ANSWER_MAX), idempotency_key: KEY };
    // Act
    const taken = validateFaqAdd(longest);
    const longQuestion = validateFaqAdd({ ...longest, question: `${longest.question}q` });
    const longAnswer = validateFaqAdd({ ...longest, answer: `${longest.answer}a` });
    // Assert
    expect(taken.ok).toBe(true);
    expect(longQuestion.ok).toBe(false);
    expect(longAnswer.ok).toBe(false);
  });

  it('take the key the app generates for each opening', () => {
    expect(validateFaqAdd({ question: '¿Trabajan en Huaral?', answer: 'Sí, desde 30 m³.', idempotency_key: KEY }).ok).toBe(true);
  });
});

describe('teachProblemOf', () => {
  it('asks for both the question and the answer', () => {
    expect(teachProblemOf('', 'Sí')).toBe('Escribe la pregunta y lo que debe responder Dali.');
    expect(teachProblemOf('¿Trabajan en Huaral?', '   ')).toBe('Escribe la pregunta y lo que debe responder Dali.');
  });

  it('lets a complete answer go', () => {
    expect(teachProblemOf(' ¿Trabajan en Huaral? ', 'Sí, desde 30 m³.')).toBeNull();
  });
});

describe('how many times a question was asked', () => {
  it('says once or the count', () => {
    expect(askedTimesText(1)).toBe('1 vez');
    expect(askedTimesText(3)).toBe('3 veces');
  });

  it('tells the review question it comes from, once when the count is unknown', () => {
    expect(askedNoteOf(2)).toBe('La preguntaron 2 veces esta semana · Dali dijo que lo consultaba con un asesor.');
    expect(askedNoteOf(1)).toBe('La preguntaron una vez esta semana · Dali dijo que lo consultaba con un asesor.');
    expect(askedNoteOf(undefined)).toBe('La preguntaron una vez esta semana · Dali dijo que lo consultaba con un asesor.');
  });
});

describe('daliFailureOf', () => {
  it('says Dali did not answer when agentes is down (502), never an empty list', () => {
    expect(daliFailureOf({ status: 502, message: 'Dali no respondió. Intenta de nuevo en un momento.' }, 'knowledge')).toBe('Dali no respondió. Vuelve a intentarlo en un momento.');
    expect(daliFailureOf({ status: 502 }, 'teach')).toBe('Dali no respondió. Inténtalo en un momento.');
  });

  it("keeps the server's own reason for anything else", () => {
    expect(daliFailureOf({ status: 403, message: 'Estás de incógnito en este espacio.' }, 'teach')).toBe('Estás de incógnito en este espacio.');
    expect(daliFailureOf({ message: 'Sin conexión. Inténtalo de nuevo.' }, 'knowledge')).toBe('Sin conexión. Inténtalo de nuevo.');
  });

  it('never leaves the person without a reason', () => {
    expect(daliFailureOf({ status: 500 }, 'knowledge')).toBe('Inténtalo de nuevo en un momento.');
    expect(daliFailureOf({ status: 500, message: '' }, 'teach')).toBe('No se pudo guardar. Inténtalo de nuevo.');
  });
});
