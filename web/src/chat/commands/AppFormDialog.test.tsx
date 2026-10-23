import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EphemeralAnswer, FormSubmitOutcome } from '@lilachat/shared';
import { AppFormDialog } from './AppFormDialog';

/** Inframaq's real `registrar_marca` (agentes, 23/10), drawn as design e-28. */
const answer: EphemeralAnswer = {
  commandId: 'c1',
  appName: 'Inframaq',
  command: '',
  action: 'Marcar asistencia',
  state: 'form',
  response: {
    responseType: 'form',
    form: {
      id: 'registrar_marca',
      title: 'Marcar asistencia',
      submitLabel: 'Marcar',
      schema: {
        type: 'object',
        properties: {
          accion: { type: 'string', enum: ['ingreso', 'refrigerio', 'retorno', 'salida'], 'x-labels': { ingreso: 'Ingreso', refrigerio: 'Refrigerio', retorno: 'Retorno', salida: 'Salida' } },
          ubicacion: { type: 'object', title: 'Tu ubicación', 'x-input': 'location' },
          foto: { type: 'string', title: 'Foto de verificación', 'x-input': 'photo', description: 'Toma una selfie rápida' },
        },
        required: ['accion', 'ubicacion', 'foto'],
      },
    },
  },
};
const here = { coords: { latitude: -11.98, longitude: -76.95, accuracy: 6.2 } };

beforeEach(() => {
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (ok: (position: typeof here) => void) => ok(here) } });
  URL.createObjectURL = vi.fn(() => 'blob:selfie');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.restoreAllMocks());

const draw = (onSubmit = vi.fn(async (): Promise<FormSubmitOutcome> => ({ done: true, answer: null }))) => {
  const onUpload = vi.fn(async () => ({ ok: true as const, fileId: 'f1' }));
  render(<AppFormDialog answer={answer} personName="Darío Paredes" onSubmit={onSubmit} onUpload={onUpload} onClose={() => undefined} />);
  return { onSubmit, onUpload };
};

describe('AppFormDialog (design e-28)', () => {
  it('four actions side by side, the location with its precision, the photo, and «Marcar ingreso» once chosen', () => {
    // Arrange
    draw();
    // Act
    fireEvent.click(screen.getByTestId('opcion-accion-ingreso'));
    // Assert
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    expect(screen.getByTestId('precision-ubicacion')).toHaveTextContent('± 6 m');
    expect(screen.getByText('Darío Paredes')).toBeInTheDocument();
    expect(screen.getByTestId('btn-enviar-formulario')).toHaveTextContent('Marcar ingreso');
    expect(screen.getByText('Se registra con tu ubicación y tu foto')).toBeInTheDocument();
  });

  it('what is missing is said field by field before anything is sent', () => {
    const { onSubmit } = draw();
    fireEvent.click(screen.getByTestId('btn-enviar-formulario'));
    expect(screen.getByText('Elige una opción.')).toBeInTheDocument();
    expect(screen.getByText('Falta la foto.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("the photo goes up when picked; the form carries its id and the location; the app's refusal shows on its field", async () => {
    // Arrange
    const onSubmit = vi.fn(async (): Promise<FormSubmitOutcome> => ({ done: false, errors: { accion: 'Ya marcaste ingreso hoy. Lo que sigue es: refrigerio.' } }));
    const { onUpload } = draw(onSubmit);
    fireEvent.click(screen.getByTestId('opcion-accion-ingreso'));
    // Act
    fireEvent.change(screen.getByTestId('campo-foto'), { target: { files: [new File(['x'], 'selfie.jpg', { type: 'image/jpeg' })] } });
    await vi.waitFor(() => expect(screen.getByText('Cambiar foto')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('btn-enviar-formulario'));
    // Assert
    expect(onUpload).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ accion: 'ingreso', ubicacion: { lat: -11.98, lng: -76.95, precision: 6 }, foto: 'f1' }));
    expect(await screen.findByText('Ya marcaste ingreso hoy. Lo que sigue es: refrigerio.')).toBeInTheDocument();
  });
});
