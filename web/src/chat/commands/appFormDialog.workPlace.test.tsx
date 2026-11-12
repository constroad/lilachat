import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EphemeralAnswer, FormSubmitOutcome, FormValues, WorkMapStreet } from '@lilachat/shared';
import { AppFormDialog } from './AppFormDialog';

/** Portal's CON-CAP «punto» (8bc64e18): the engineer only types the density (José 12/11: «quitarle trabajo»). */
const point: EphemeralAnswer = {
  commandId: 'c1',
  appName: 'Portal',
  command: '',
  action: 'Punto 2',
  state: 'form',
  response: {
    responseType: 'form',
    form: {
      id: 'punto',
      title: 'Punto 2',
      schema: {
        type: 'object',
        required: ['densidadCampo'],
        properties: {
          lat: { type: 'number', title: 'Latitud', 'x-input': 'gps' },
          lng: { type: 'number', title: 'Longitud', 'x-input': 'gps' },
          precisionM: { type: 'number', title: 'Precisión', 'x-input': 'gps', 'x-unit': 'm' },
          calleId: { type: 'string', title: 'Calle', 'x-input': 'work-street' },
          progresiva: { type: 'string', title: 'Progresiva', 'x-input': 'work-station' },
          densidadCampo: { type: 'number', title: 'Densidad de campo', 'x-unit': 'g/cm³' },
        },
      },
    },
  },
};
const HEROES: WorkMapStreet = { id: '6731f0a2c4e8b91d2a7f0011', name: 'Av. Los Héroes', line: [{ lat: -12.1, lng: -77.0 }, { lat: -12.1, lng: -76.999 }], lengthM: 109 };
const PUNO: WorkMapStreet = { id: '6731f0a2c4e8b91d2a7f0022', name: 'Jr. Puno', line: [{ lat: -12.1, lng: -77.0 }, { lat: -12.101, lng: -77.0 }], lengthM: 111 };

function gpsAnswers(accuracy: number) {
  const getCurrentPosition = vi.fn((done: PositionCallback) => done({ coords: { latitude: -12.09996, longitude: -76.99945, accuracy } } as GeolocationPosition));
  Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true });
  return getCurrentPosition;
}
const draw = (streets: WorkMapStreet[] | null) => {
  const onSubmit = vi.fn(async (_values: FormValues): Promise<FormSubmitOutcome> => ({ done: true, answer: null }));
  render(<AppFormDialog answer={point} workStreets={streets} onSubmit={onSubmit} onUpload={vi.fn()} onClose={vi.fn()} />);
  return onSubmit;
};

afterEach(() => {
  Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true });
});

describe('a CON-CAP point fills its place on its own', () => {
  it('reads the GPS on opening, picks the nearest street and its station; only the density is typed', async () => {
    // Arrange
    gpsAnswers(6);
    const onSubmit = draw([PUNO, HEROES]);
    // Act
    await screen.findByText('Precisión ± 6 m');
    fireEvent.change(screen.getByTestId('campo-densidadCampo'), { target: { value: '2.21' } });
    fireEvent.click(screen.getByRole('button', { name: /registrar|guardar|enviar/i }));
    // Assert
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]![0]).toEqual({ lat: -12.09996, lng: -76.99945, precisionM: 6, calleId: HEROES.id, progresiva: '0+060', densidadCampo: '2.21' });
  });

  it('the three numbers are one block, never three boxes to type', async () => {
    gpsAnswers(6);
    draw([HEROES]);
    await screen.findByTestId('gps-coordenadas');
    expect(screen.queryByTestId('campo-lng')).toBeNull();
    expect(screen.queryByTestId('campo-precisionM')).toBeNull();
    expect(screen.getAllByTestId('campo-gps')).toHaveLength(1);
  });

  it('an approximate reading says so, and «Volver a tomar» reads again', async () => {
    const reads = gpsAnswers(32);
    draw([HEROES]);
    expect(await screen.findByText(/Ubicación aproximada \(± 32 m\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('gps-tomar'));
    expect(reads).toHaveBeenCalledTimes(2);
  });

  it('with no streets on the work map the street says it, and nothing is invented', async () => {
    gpsAnswers(6);
    draw([]);
    expect(await screen.findByText('No hay calles del mapa de obra para elegir.')).toBeInTheDocument();
    expect(screen.getByTestId('campo-progresiva')).toHaveValue('');
  });

  it('without GPS the block says how to fix it', async () => {
    Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: vi.fn((_done: PositionCallback, fail: PositionErrorCallback) => fail({ code: 1 } as GeolocationPositionError)) }, configurable: true });
    draw([HEROES]);
    expect(await screen.findByText(/No se pudo leer el GPS/)).toBeInTheDocument();
  });
});
