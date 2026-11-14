import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { visitDocumentOf } from '@lilachat/shared';
import { VISIT_WITH_ID } from '../../../../shared/src/siteVisit.fixture';
import { VisitInterviewWeb } from './VisitInterviewWeb';

afterEach(cleanup);
const document = visitDocumentOf(VISIT_WITH_ID)!;

/** The interview as lv03 (Stitch 32a0…): a card per question, big chips, «Siguiente: n sin responder». */
describe('the visit interview on the web', () => {
  it('marks what is saved, counts the rest and saves one answer per tap', () => {
    // Arrange
    const onAnswer = vi.fn();
    render(<VisitInterviewWeb document={document} busy={false} onAnswer={onAnswer} onClose={() => undefined} />);
    // Assert: r01 saved as «No»
    expect(screen.getByTestId('opcion-r01-no')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('pregunta-r01')).toHaveTextContent('Respondida');
    expect(screen.getByTestId('entrevista-siguiente')).toHaveTextContent('sin responder');
    // Act
    fireEvent.click(screen.getByTestId('opcion-r02-Arena'));
    // Assert
    expect(onAnswer).toHaveBeenCalledWith({ r02: 'Arena' });
  });
  it('a written answer (the area in m²) is saved when the field is left, only if it changed', () => {
    // Arrange
    const section = document.sections.find((one) => one.id === 'entrevista')!;
    const form = document.forms[section.form!]!;
    const withArea = { ...document, forms: { ...document.forms, [section.form!]: { ...form, properties: { ...form.properties, r99: { type: 'string', title: 'Área aproximada', 'x-unit': 'm²' } } } } };
    const onAnswer = vi.fn();
    render(<VisitInterviewWeb document={withArea} busy={false} onAnswer={onAnswer} onClose={() => undefined} />);
    const field = screen.getByTestId('respuesta-r99');
    // Act
    fireEvent.blur(field);
    fireEvent.change(field, { target: { value: '1200' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    // Assert
    expect(screen.getByTestId('pregunta-r99')).toHaveTextContent('m²');
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith({ r99: '1200' });
  });
});
