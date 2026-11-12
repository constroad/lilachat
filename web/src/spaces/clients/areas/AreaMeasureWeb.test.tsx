import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { areaDraftKey } from '@lilachat/shared';
import { AreaMeasureForm, type MeasuredArea } from './AreaMeasureWeb';

/**
 * José 12/11, option B: on an iPhone the area is measured with Apple's
 * «Medición» and typed here. Lilachat says each step, computes the area, and
 * keeps what was typed while the person is in Medición. Limits are Portal's.
 */
const here = { lat: -12.05, lng: -77.03, precision: 6 };

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => undefined }));
});
afterEach(() => vi.unstubAllGlobals());

const photo = () => new File([new Uint8Array([255, 216, 255])], 'medicion.jpg', { type: 'image/jpeg' });
const form = (overrides: Partial<Parameters<typeof AreaMeasureForm>[0]> = {}) => <AreaMeasureForm serviceId="sv1" iphone reading={Promise.resolve(here)} onSave={vi.fn(async () => true)} {...overrides} />;

describe('AreaMeasureForm', () => {
  it('on an iPhone, says what to open, how to measure, and how to come back', () => {
    render(form());

    const guide = screen.getByTestId('guia-medicion');
    expect(guide).toHaveTextContent('Abre la app Medición');
    expect(guide).toHaveTextContent('Utilidades');
    expect(guide).toHaveTextContent('Vuelve a Lilachat');
    expect(guide.querySelectorAll('li')).toHaveLength(7);
  });

  it('without an iPhone, the guide stays closed until asked for', async () => {
    render(form({ iphone: false }));

    expect(screen.queryByTestId('guia-medicion')).toBeNull();
    await userEvent.click(screen.getByTestId('ver-guia-medicion'));
    expect(screen.getByTestId('guia-medicion')).toBeTruthy();
  });

  it('computes the area as the length and width are typed, and the volume with a thickness', async () => {
    render(form());

    await userEvent.type(screen.getByTestId('area-largo'), '3,2');
    await userEvent.type(screen.getByTestId('area-ancho'), '1,5');
    expect(screen.getByTestId('area-calculada')).toHaveTextContent('3,20 m × 1,50 m = 4,80 m²');

    await userEvent.type(screen.getByTestId('area-espesor'), '5');
    expect(screen.getByTestId('area-calculada')).toHaveTextContent('4,80 m² · 0,240 m³');
  });

  it('the total area can be typed straight, when Medición shows it', async () => {
    render(form());

    await userEvent.click(screen.getByTestId('modo-area-direct'));
    await userEvent.type(screen.getByTestId('area-total'), '17,6');

    expect(screen.getByTestId('area-calculada')).toHaveTextContent('17,60 m²');
    expect(screen.queryByTestId('area-largo')).toBeNull();
  });

  it('what was typed is still there after iOS reloads the app on the way back', async () => {
    const first = render(form());
    await userEvent.type(screen.getByTestId('area-largo'), '3,2');
    await waitFor(() => expect(localStorage.getItem(areaDraftKey('sv1'))).toContain('3,2'));
    first.unmount();

    render(form({ reading: Promise.resolve(null) }));

    expect(screen.getByTestId('area-largo')).toHaveValue('3,2');
    expect(await screen.findByTestId('area-gps')).toHaveTextContent('GPS ±6 m');
  });

  it('a place past 15 m says it is approximate', async () => {
    render(form({ reading: Promise.resolve({ ...here, precision: 22 }) }));

    expect(await screen.findByTestId('area-gps')).toHaveTextContent('Ubicación aproximada (±22 m)');
  });

  it('on an iPhone the Medición picture comes from Fotos; elsewhere the camera opens', () => {
    const { unmount } = render(form());
    expect(screen.getByTestId('area-foto-entrada').hasAttribute('capture')).toBe(false);
    expect(screen.getByTestId('area-foto')).toHaveTextContent('Captura de Medición');
    unmount();

    render(form({ iphone: false }));
    expect(screen.getByTestId('area-foto-entrada').getAttribute('capture')).toBe('environment');
  });

  it('«Guardar área» waits for the area and the photo, then hands everything over and forgets the draft', async () => {
    const onSave = vi.fn(async (_area: MeasuredArea) => true);
    render(form({ onSave }));
    expect(screen.getByTestId('guardar-area')).toBeDisabled();

    await userEvent.type(screen.getByTestId('area-largo'), '3,2');
    await userEvent.type(screen.getByTestId('area-ancho'), '1,5');
    await userEvent.type(screen.getByTestId('area-ubicacion'), 'Jr. Moquegua cdra 3');
    await userEvent.upload(screen.getByTestId('area-foto-entrada'), photo());
    await screen.findByTestId('area-foto-0');
    await waitFor(() => expect(screen.getByTestId('guardar-area')).toBeEnabled());
    await userEvent.click(screen.getByTestId('guardar-area'));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const saved = onSave.mock.calls[0]![0];
    expect(saved).toMatchObject({ method: 'medidas-iphone', point: here, place: 'Jr. Moquegua cdra 3', note: '', figures: { lengthM: 3.2, widthM: 1.5, areaM2: 4.8 } });
    expect(saved.photos).toHaveLength(1);
    expect(saved.entryId).toMatch(/^[0-9a-f-]{36}$/);
    await waitFor(() => expect(localStorage.getItem(areaDraftKey('sv1'))).toBeNull());
  });

  it('above 1 000 m² it asks «¿Seguro?» before saving', async () => {
    const onSave = vi.fn(async (_area: MeasuredArea) => true);
    render(form({ onSave }));
    await userEvent.click(screen.getByTestId('modo-area-direct'));
    await userEvent.type(screen.getByTestId('area-total'), '1500');
    await userEvent.upload(screen.getByTestId('area-foto-entrada'), photo());
    await screen.findByTestId('area-foto-0');

    await userEvent.click(screen.getByTestId('guardar-area'));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByTestId('guardar-area')).toHaveTextContent('¿Seguro? 1 500,00 m²');

    await userEvent.click(screen.getByTestId('guardar-area'));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  });

  it('a failed save keeps the draft to try again', async () => {
    const onSave = vi.fn(async (_area: MeasuredArea) => false);
    render(form({ onSave, line: 'No se pudo guardar el área.' }));
    await userEvent.type(screen.getByTestId('area-largo'), '3');
    await userEvent.type(screen.getByTestId('area-ancho'), '2');
    await userEvent.upload(screen.getByTestId('area-foto-entrada'), photo());
    await screen.findByTestId('area-foto-0');
    await userEvent.click(screen.getByTestId('guardar-area'));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(localStorage.getItem(areaDraftKey('sv1'))).toContain('"length":"3"');
    expect(screen.getByTestId('guardar-area-nota')).toHaveTextContent('No se pudo guardar el área.');
  });
});
