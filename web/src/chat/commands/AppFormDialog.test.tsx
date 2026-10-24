import { forwardRef, useImperativeHandle } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EphemeralAnswer, FormSubmitOutcome } from '@lilachat/shared';
import { AppFormDialog } from './AppFormDialog';

// The live camera is the browser's: here it hands over a frame when the button asks (pending 94).
const frame = new File(['x'], 'selfie.jpg', { type: 'image/jpeg' });
vi.mock('./LiveSelfie', () => ({
  LiveSelfie: forwardRef(function FakeSelfie(props: { testId?: string; error?: string }, ref) {
    useImperativeHandle(ref, () => ({ capture: async () => frame }));
    return <div data-testid={props.testId}>{props.error}</div>;
  }),
}));

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
const here = { coords: { latitude: -11.98, longitude: -76.95, accuracy: 6.2 }, get timestamp() { return Date.now(); } };

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
    // A signing (design e-32): the two steps, the camera instead of the clock card, and what the tap does.
    expect(screen.getByText('1 · Qué marcas')).toBeInTheDocument();
    expect(screen.queryByText('Darío Paredes')).not.toBeInTheDocument();
    expect(screen.getByTestId('btn-enviar-formulario')).toHaveTextContent('Marcar ingreso');
    expect(screen.getByText('Al tocar se toma la foto con la hora y el lugar, y se envía.')).toBeInTheDocument();
  });

  it('what is missing is said field by field before anything is sent; the photo is taken by the button, so it is never «missing»', () => {
    const { onSubmit, onUpload } = draw();
    fireEvent.click(screen.getByTestId('btn-enviar-formulario'));
    expect(screen.getByText('Elige una opción.')).toBeInTheDocument();
    expect(screen.queryByText('Falta la foto.')).not.toBeInTheDocument();
    expect(onUpload).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("one click reads the place of now, takes the live selfie, uploads it stamped and sends; the app's refusal shows on its field", async () => {
    // Arrange
    const onSubmit = vi.fn(async (): Promise<FormSubmitOutcome> => ({ done: false, errors: { accion: 'Ya marcaste ingreso hoy. Lo que sigue es: refrigerio.' } }));
    const { onUpload } = draw(onSubmit);
    fireEvent.click(screen.getByTestId('opcion-accion-ingreso'));
    // Act
    fireEvent.click(screen.getByTestId('btn-enviar-formulario'));
    // Assert
    await vi.waitFor(() => expect(onUpload).toHaveBeenCalledWith(frame, expect.objectContaining({ lat: -11.98, lng: -76.95, precision: 6, age: expect.any(Number) })));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ accion: 'ingreso', ubicacion: expect.objectContaining({ lat: -11.98, lng: -76.95, precision: 6, age: expect.any(Number) }), foto: 'f1' }));
    expect(await screen.findByText('Ya marcaste ingreso hoy. Lo que sigue es: refrigerio.')).toBeInTheDocument();
  });

  it('a reading the browser kept is not «now»: nothing is taken and it says so', async () => {
    const old = { ...here, timestamp: Date.now() - 5 * 60_000 };
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (ok: (position: typeof old) => void) => ok(old) } });
    const { onSubmit, onUpload } = draw();
    fireEvent.click(screen.getByTestId('opcion-accion-ingreso'));
    fireEvent.click(screen.getByTestId('btn-enviar-formulario'));
    expect((await screen.findAllByText(/No se pudo leer tu ubicación de ahora/)).length).toBeGreaterThan(0);
    expect(onUpload).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
