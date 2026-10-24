import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { formFields, formatFormDate, type EphemeralAnswer, type FormSubmitOutcome } from '@lilachat/shared';
import { AppFormDialog } from './AppFormDialog';
import { DateField } from './AppFormFields';

/** Dates and times in an app's form (José, 24/10: «fecha actual siempre y un selector, no un input»). */
const schema = {
  type: 'object',
  required: ['hora'],
  properties: {
    fecha: { type: 'string', format: 'date', title: 'Fecha del pedido', description: 'Día en que se despacha' },
    hora: { type: 'string', format: 'time', title: 'Hora' },
    llegada: { type: 'string', format: 'date-time', title: 'Llegada' },
  },
};
const [day, hour, moment] = formFields({ id: 'pedido', title: 'Pedido', schema });

const answer: EphemeralAnswer = { commandId: 'c1', appName: 'Portal', command: '', action: 'Crear un pedido', state: 'form', response: { responseType: 'form', form: { id: 'pedido', title: 'Crear un pedido', schema } } };

describe('DateField', () => {
  it('a day, an hour and a moment each get the browser picker of their own kind', () => {
    // Act
    render(<>{[day, hour, moment].map((field) => (field?.kind === 'date' ? <DateField key={field.name} field={field} value={undefined} onChange={() => undefined} /> : null))}</>);
    // Assert
    expect(['campo-fecha', 'campo-hora', 'campo-llegada'].map((id) => screen.getByTestId(id).getAttribute('type'))).toEqual(['date', 'time', 'datetime-local']);
  });

  it('passes on exactly what the picker gives: HH:MM in 24 h for a time', () => {
    // Arrange
    const onChange = vi.fn();
    if (hour?.kind !== 'date') throw new Error('date');
    render(<DateField field={hour} value={undefined} onChange={onChange} />);
    // Act
    fireEvent.change(screen.getByTestId('campo-hora'), { target: { value: '07:30' } });
    // Assert
    expect(onChange).toHaveBeenCalledWith('07:30');
  });

  it('clearing the picker leaves the field empty, not an empty string', () => {
    const onChange = vi.fn();
    if (day?.kind !== 'date') throw new Error('date');
    render(<DateField field={day} value="2026-10-24" onChange={onChange} />);
    fireEvent.change(screen.getByTestId('campo-fecha'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('shows the help line under the picker', () => {
    if (day?.kind !== 'date') throw new Error('date');
    render(<DateField field={day} value="2026-10-24" onChange={() => undefined} />);
    expect(screen.getByText('Día en que se despacha')).toBeInTheDocument();
  });
});

describe('AppFormDialog with a date', () => {
  it('opens on today and now, and sends the day as AAAA-MM-DD and the hour as HH:MM', async () => {
    // Arrange
    const onSubmit = vi.fn(async (): Promise<FormSubmitOutcome> => ({ done: true, answer: null }));
    render(<AppFormDialog answer={answer} onSubmit={onSubmit} onUpload={vi.fn()} onClose={() => undefined} />);
    const before = new Date();
    // Assert: the day is today, the moment is now (to the minute), the hour waits for a decision.
    expect((screen.getByTestId('campo-fecha') as HTMLInputElement).value).toBe(formatFormDate(before, 'date'));
    expect((screen.getByTestId('campo-llegada') as HTMLInputElement).value.slice(0, 10)).toBe(formatFormDate(before, 'date'));
    expect((screen.getByTestId('campo-hora') as HTMLInputElement).value).toBe('');
    // Act
    fireEvent.click(screen.getByTestId('btn-enviar-formulario'));
    expect(await screen.findByText('Elige una hora.')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('campo-hora'), { target: { value: '07:30' } });
    fireEvent.click(screen.getByTestId('btn-enviar-formulario'));
    // Assert
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ fecha: formatFormDate(before, 'date'), hora: '07:30' }));
  });
});
