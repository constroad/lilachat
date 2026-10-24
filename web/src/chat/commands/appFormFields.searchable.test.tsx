import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { formFields } from '@lilachat/shared';
import { ChoiceField, TextField } from './AppFormFields';

/** Marking attendance by name (agentes, 24/10; design e-35): 31 people and the PIN. */
const people = Array.from({ length: 31 }, (_, index) => ({ const: `e${index}`, title: index === 0 ? 'José Zamora' : `Persona ${index}`, description: index === 0 ? 'Gerente' : 'Operador' }));
const [person, pin] = formFields({ id: 'registrar_asistencia', title: 'Marcar asistencia', schema: { type: 'object', properties: { empleadoId: { type: 'string', title: '¿Quién eres?', oneOf: people }, pin: { type: 'string', 'x-input': 'pin' } }, required: ['empleadoId'] } });

describe('a long list and a PIN in an app form', () => {
  it('opens a search that ignores accents and capitals, counts what matched, and picks', () => {
    // Arrange
    const onChange = vi.fn();
    if (person?.kind !== 'choice') throw new Error('choice');
    render(<ChoiceField field={person} value={undefined} onChange={onChange} />);
    // Act
    fireEvent.click(screen.getByTestId('campo-empleadoId'));
    fireEvent.change(screen.getByTestId('buscar-empleadoId'), { target: { value: 'JOSE' } });
    // Assert
    expect(screen.getByTestId('cuenta-empleadoId').textContent).toBe('1 de 31');
    fireEvent.click(screen.getByTestId('opcion-empleadoId-e0'));
    expect(onChange).toHaveBeenCalledWith('e0');
  });

  it('the PIN is hidden, numeric and never remembered by the browser', () => {
    if (pin?.kind !== 'text') throw new Error('text');
    render(<TextField field={pin} value="" onChange={() => undefined} />);
    const input = screen.getByTestId('campo-pin');
    expect(input.getAttribute('type')).toBe('password');
    expect(input.getAttribute('inputmode')).toBe('numeric');
    expect(input.getAttribute('autocomplete')).toBe('off');
  });
});
