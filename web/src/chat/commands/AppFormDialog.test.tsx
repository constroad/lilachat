import { forwardRef, useImperativeHandle } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

/** The checklist of a control de pista (06/11): `x-check-all`, each item «Cumple» first. */
const yesNo = (title: string) => ({ type: 'string', title, oneOf: [{ const: 'si', title: 'Cumple' }, { const: 'no', title: 'No cumple' }] });
const checklist: EphemeralAnswer = { ...answer, action: 'Checklist', response: { responseType: 'form', form: { id: 'guardar_seccion_de_informe', title: 'Checklist', checkAll: true, schema: { type: 'object', 'x-check-all': true, properties: { riego: yesNo('Riego de liga'), junta: yesNo('Juntas') }, required: ['riego', 'junta'] } } } };

describe('«Marcar todo» (x-check-all, the checklist of a control de pista)', () => {
  it('one click answers every choice with its first option, and «Enviar» sends them', async () => {
    const onSubmit = vi.fn(async (): Promise<FormSubmitOutcome> => ({ done: true, answer: null }));
    render(<AppFormDialog answer={checklist} onSubmit={onSubmit} onUpload={vi.fn(async () => ({ ok: true as const, fileId: 'f1' }))} onClose={() => undefined} />);

    fireEvent.click(screen.getByTestId('marcar-todo'));
    fireEvent.click(screen.getByTestId('btn-enviar-formulario'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ riego: 'si', junta: 'si' }));
    expect(screen.queryByTestId('marcar-todo')).toBeInTheDocument();
  });

  it('a form without the flag has no button', () => {
    draw();
    expect(screen.queryByTestId('marcar-todo')).toBeNull();
  });
});

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

/** Portal's `registrar_asistencia`: who signs, what they sign, the selfie and the place. */
const ANA = '6ad95d52d225a79c08002e24';
const LUIS = '6ad95d52d225a79c08002e25';
const peopleForm = (people: { const: string; title: string }[]): EphemeralAnswer => ({
  ...answer,
  action: 'Registrar asistencia',
  response: {
    responseType: 'form',
    form: {
      id: 'registrar_asistencia',
      title: 'Registrar asistencia',
      submitLabel: 'Registrar asistencia',
      schema: {
        type: 'object',
        properties: {
          empleadoId: { type: 'string', title: 'Trabajador', oneOf: people },
          accion: { type: 'string', title: 'Qué firma', enum: ['ingreso', 'salida', 'refrigerio', 'retorno'], description: 'Ingreso abre el turno.', 'x-labels': { ingreso: 'Ingreso', salida: 'Salida', refrigerio: 'Salida a refrigerio', retorno: 'Retorno de refrigerio' } },
          fotoUrl: { type: 'string', title: 'Foto', 'x-input': 'photo' },
          ubicacion: { type: 'object', title: 'Ubicación', 'x-input': 'location' },
        },
        required: ['empleadoId', 'accion', 'fotoUrl', 'ubicacion'],
      },
    },
  },
});
const crew = [{ const: ANA, title: 'Ana Torres' }, { const: LUIS, title: 'Luis Rojas' }];
const drawPeople = (people = crew) => {
  const onSubmit = vi.fn(async (): Promise<FormSubmitOutcome> => ({ done: true, answer: null }));
  const onUpload = vi.fn(async () => ({ ok: true as const, fileId: 'f1' }));
  render(<AppFormDialog answer={peopleForm(people)} onSubmit={onSubmit} onUpload={onUpload} onClose={() => undefined} />);
  return { onSubmit, onUpload };
};

describe('a signing opens on who signs (José 06/11: like Portal, the camera comes after the name)', () => {
  it('shows a card per person, with the camera off and nothing to send yet', () => {
    // Arrange / Act
    drawPeople();
    // Assert
    expect(screen.getByTestId('quien-firma')).toHaveTextContent('¿Quién firma?');
    expect(screen.getByTestId(`firmante-${ANA}`)).toHaveTextContent('Ana Torres');
    expect(screen.queryByTestId('campo-fotoUrl')).toBeNull();
    expect(screen.queryByTestId('btn-enviar-formulario')).toBeNull();
  });

  it('picking a name turns the camera on, with the choice as chips in one line', () => {
    // Arrange
    drawPeople();
    // Act
    fireEvent.click(screen.getByTestId(`firmante-${ANA}`));
    // Assert
    expect(screen.getByTestId('campo-fotoUrl')).toBeInTheDocument();
    expect(screen.getByTestId('firmante-elegido')).toHaveTextContent('Ana Torres');
    expect(screen.queryByTestId('quien-firma')).toBeNull();
    expect(screen.getByTestId('chips-accion').children).toHaveLength(4);
    expect(screen.getByTestId('opcion-accion-refrigerio')).toHaveTextContent('Refrigerio');
    expect(screen.getByTestId('opcion-accion-retorno')).toHaveTextContent('Retorno');
  });

  it('«Cambiar» goes back to the cards and turns the camera off', () => {
    // Arrange
    drawPeople();
    fireEvent.click(screen.getByTestId(`firmante-${ANA}`));
    // Act
    fireEvent.click(screen.getByTestId('cambiar-firmante'));
    // Assert
    expect(screen.getByTestId(`firmante-${LUIS}`)).toBeInTheDocument();
    expect(screen.queryByTestId('campo-fotoUrl')).toBeNull();
  });

  it('sends the person picked with what they sign, in one tap', async () => {
    // Arrange
    const { onSubmit, onUpload } = drawPeople();
    fireEvent.click(screen.getByTestId(`firmante-${LUIS}`));
    fireEvent.click(screen.getByTestId('opcion-accion-salida'));
    // Act
    fireEvent.click(screen.getByTestId('btn-enviar-formulario'));
    // Assert
    await vi.waitFor(() => expect(onUpload).toHaveBeenCalled());
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ empleadoId: LUIS, accion: 'salida', fotoUrl: 'f1' })));
  });

  it('a long list can be searched; a short one does not need it', () => {
    // Arrange
    const many = Array.from({ length: 12 }, (_, index) => ({ const: `6ad95d52d225a79c08002e${String(30 + index)}`, title: index === 7 ? 'Wilson Huamán' : `Persona ${index}` }));
    drawPeople(many);
    // Act
    fireEvent.change(screen.getByTestId('buscar-quien-firma'), { target: { value: 'wilson' } });
    // Assert
    expect(screen.getAllByTestId(/^firmante-/)).toHaveLength(1);
    expect(screen.getByText('Wilson Huamán')).toBeInTheDocument();
  });

  it('nobody matches: it says so instead of an empty sheet', () => {
    // Arrange
    const many = Array.from({ length: 12 }, (_, index) => ({ const: `6ad95d52d225a79c08002e${String(30 + index)}`, title: `Persona ${index}` }));
    drawPeople(many);
    // Act
    fireEvent.change(screen.getByTestId('buscar-quien-firma'), { target: { value: 'zzz' } });
    // Assert
    expect(screen.getByTestId('quien-firma-vacio')).toHaveTextContent('zzz');
  });

  it('a form without people is untouched: the camera is there from the start', () => {
    // Arrange / Act
    draw();
    // Assert
    expect(screen.queryByTestId('quien-firma')).toBeNull();
    expect(screen.getByTestId('campo-foto')).toBeInTheDocument();
  });
});
