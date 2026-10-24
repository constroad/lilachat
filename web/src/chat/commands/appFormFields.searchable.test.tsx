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

  // José, 24/10: the carriers, quarries and sites are dropdowns even with three; a search box over three rows is noise.
  it('a short dropdown (three quarries) opens with no search box and picks', () => {
    // Arrange
    const onChange = vi.fn();
    const [quarry] = formFields({ id: 'ingreso', title: 'Ingreso', schema: { type: 'object', properties: { canteraId: { type: 'string', title: 'Cantera', enum: ['69d9f2ad975db728c8790e2b', '69d9f1f2975db728c8790dd4', '69d9f175975db728c8790d7f'], 'x-labels': { '69d9f2ad975db728c8790e2b': 'CARLONCHO', '69d9f1f2975db728c8790dd4': 'CRUSHING', '69d9f175975db728c8790d7f': 'GLOBAL' } } } } });
    if (quarry?.kind !== 'choice') throw new Error('choice');
    render(<ChoiceField field={quarry} value={undefined} onChange={onChange} />);
    // Act
    fireEvent.click(screen.getByTestId('campo-canteraId'));
    // Assert
    expect(screen.queryByTestId('buscar-canteraId')).toBeNull();
    fireEvent.click(screen.getByTestId('opcion-canteraId-69d9f1f2975db728c8790dd4'));
    expect(onChange).toHaveBeenCalledWith('69d9f1f2975db728c8790dd4');
  });

  it('a long name is not cut to one line in the dropdown', () => {
    const [design] = formFields({ id: 'pedido', title: 'Pedido', schema: { type: 'object', properties: { diseno: { type: 'string', title: 'Diseño', enum: ['MAC-2 - Mezcla asfáltica en caliente para capa de rodadura', 'MAC-3 - Mezcla asfáltica para vías urbanas', 'Mac 1 - Diseno base para pruebas'] } } } });
    if (design?.kind !== 'choice') throw new Error('choice');
    render(<ChoiceField field={design} value="MAC-2 - Mezcla asfáltica en caliente para capa de rodadura" onChange={() => undefined} />);
    expect(screen.getByTestId('campo-diseno').querySelector('.truncate')).toBeNull();
    fireEvent.click(screen.getByTestId('campo-diseno'));
    expect(screen.getByTestId('hoja-diseno').querySelector('.truncate')).toBeNull();
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
