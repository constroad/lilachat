import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { EphemeralAnswer, FormSchemaProperty, FormSubmitOutcome } from '@lilachat/shared';
import { AppFormDialog } from './AppFormDialog';

/**
 * Portal 17/11, emails from Lilachat: picking a quote refreshes the form, and the app's `x-prefill`
 * brings that quote's recipient, subject and message as the new defaults.
 */
const quote: FormSchemaProperty = { type: 'string', title: 'Cotización', oneOf: [{ const: 'q1', title: 'COT-2026-0101' }, { const: 'q2', title: 'COT-2026-0102' }], 'x-refresh': true };
const emailAnswer = (picked: string, code: string): EphemeralAnswer => ({
  commandId: 'c1',
  appName: 'Portal',
  command: '',
  action: 'Enviar cotización por correo',
  state: 'form',
  response: {
    responseType: 'form',
    form: {
      id: 'enviar_cotizacion_por_correo',
      title: 'Enviar cotización por correo',
      schema: {
        type: 'object',
        required: ['cotizacion', 'para', 'asunto'],
        properties: {
          cotizacion: { ...quote, default: picked },
          para: { type: 'string', title: 'Para', 'x-keyboard': 'email', maxLength: 500, default: 'compras@cliente.pe' },
          asunto: { type: 'string', title: 'Asunto', default: `Cotización ${code}` },
          mensaje: { type: 'string', title: 'Mensaje', 'x-input': 'textarea', maxLength: 2000, default: `Estimado cliente:\n\nAdjunto la cotización ${code}.` },
        },
      },
    },
  },
});

const draw = () => {
  const onSubmit = vi.fn(async (): Promise<FormSubmitOutcome> => ({ done: true, answer: null }));
  const view = render(<AppFormDialog answer={emailAnswer('q1', 'COT-2026-0101')} onSubmit={onSubmit} onUpload={vi.fn()} onClose={vi.fn()} />);
  const refresh = () => view.rerender(<AppFormDialog answer={emailAnswer('q2', 'COT-2026-0102')} onSubmit={onSubmit} onUpload={vi.fn()} onClose={vi.fn()} />);
  return { refresh };
};
const valueOf = (name: string) => (screen.getByTestId(`campo-${name}`) as HTMLInputElement | HTMLTextAreaElement).value;

describe('a refreshed email form', () => {
  it('fills the subject and message of the quote just picked', () => {
    // Arrange
    const { refresh } = draw();
    expect(valueOf('asunto')).toBe('Cotización COT-2026-0101');
    // Act
    refresh();
    // Assert
    expect(valueOf('asunto')).toBe('Cotización COT-2026-0102');
    expect(valueOf('mensaje')).toBe('Estimado cliente:\n\nAdjunto la cotización COT-2026-0102.');
    expect(valueOf('para')).toBe('compras@cliente.pe');
  });

  it('keeps the message the person wrote', () => {
    // Arrange
    const { refresh } = draw();
    fireEvent.change(screen.getByTestId('campo-mensaje'), { target: { value: 'Hola Juan, va la cotización que pediste.' } });
    // Act
    refresh();
    // Assert
    expect(valueOf('mensaje')).toBe('Hola Juan, va la cotización que pediste.');
    expect(valueOf('asunto')).toBe('Cotización COT-2026-0102');
  });
});

describe('the email form\'s fields', () => {
  it('«Para» is one line with the email keyboard, never capitalized nor corrected', () => {
    // Act
    draw();
    // Assert
    const recipient = screen.getByTestId('campo-para');
    expect(recipient.tagName).toBe('INPUT');
    expect(recipient.getAttribute('inputmode')).toBe('email');
    expect(recipient.getAttribute('autocapitalize')).toBe('off');
    expect(recipient.getAttribute('spellcheck')).toBe('false');
  });

  it('the suggested message opens with its paragraphs', () => {
    // Act
    draw();
    // Assert
    expect(valueOf('mensaje')).toBe('Estimado cliente:\n\nAdjunto la cotización COT-2026-0101.');
  });
});
