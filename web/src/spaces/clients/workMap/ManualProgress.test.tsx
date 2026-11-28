import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GPS_UNAVAILABLE, MANUAL_NO_LENGTH, MANUAL_SENT, workMapOf, type ManualPhotoUpload, type MapEditSend, type WorkMap, type WorkMapPoint } from '@lilachat/shared';
import { ManualProgress } from './ManualProgress';

/** The canvas as a stand-in: it shows the ring's chainage and drops it where a test says. */
const drops: { at: WorkMapPoint | null } = { at: null };
vi.mock('./WorkMapCanvas', () => ({
  default: (props: { handles?: Array<{ label: string; handle: 'start' | 'end' }>; stretches?: Array<{ fromM?: number; toM?: number }>; onHandleDrop?: (end: 'start' | 'end', point: WorkMapPoint) => void }) => (
    <div data-testid="avance-mapa-lienzo" data-tramo={(props.stretches ?? []).map((one) => `${one.fromM}-${one.toM}`).join(',')}>
      {(props.handles ?? []).map((handle) => <button key={handle.label} type="button" data-testid="avance-anillo" onClick={() => drops.at && props.onHandleDrop?.(handle.handle, drops.at)}>{handle.label}</button>)}
    </div>
  ),
}));

/** Design ma04 on the web: the street by GPS, a ring along its axis, a photo and send. */
const line = [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.997 }];
const lima = [{ lat: -12.01, lng: -77 }, { lat: -12.01, lng: -76.997 }];
const MEDIA = '6aef8d455e4b25190f7c3177';
const along = (share: number, on = line) => ({ lat: on[0]!.lat, lng: on[0]!.lng + (on[1]!.lng - on[0]!.lng) * share });
const mapOf = (pending: WorkMap['pending'] = []): WorkMap => ({
  ...workMapOf({
    workStreets: {
      streets: [{ _id: 's1', name: 'Jr. Los Pinos', geometry: line, lengthM: 320, widthM: 6 }, { _id: 's2', name: 'Jr. Lima', geometry: lima, lengthM: 320 }],
      scopes: [{ _id: 'c1', streetId: 's1', fromM: 0, toM: 320, tagIds: ['base'], partidaIds: [] }, { _id: 'c2', streetId: 's2', fromM: 0, toM: 320, tagIds: ['base'], partidaIds: [] }],
      progress: [{ streetId: 's1', tagId: 'base', fromM: 0, toM: 120, date: '2026-11-01' }],
      tags: [{ _id: 'base', name: 'Base', color: '#c08a1e', order: 1 }],
      stages: [],
    },
  })!,
  pending,
});
const gpsAt = (point: WorkMapPoint, accuracy = 4) => vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: point.lat, longitude: point.lng, accuracy } } as GeolocationPosition) } });

afterEach(() => { vi.unstubAllGlobals(); drops.at = null; });

describe('ManualProgress (ma04)', () => {
  it('starts at the front, the ring dropped off the axis snaps, and the photo goes with the progress', async () => {
    // Arrange
    const send = vi.fn<MapEditSend>(async () => ({ ok: true, message: MANUAL_SENT }));
    const uploadPhoto = vi.fn<ManualPhotoUpload<File>>(async () => ({ ok: true, mediaId: MEDIA }));
    render(<ManualProgress map={mapOf()} streetId="s1" send={send} uploadPhoto={uploadPhoto} onDone={vi.fn()} />);
    expect(screen.getByTestId('avance-titulo')).toHaveTextContent('Registrar avance de Base');
    expect(screen.getByTestId('avance-manual-tramo')).toHaveTextContent('0+120 → 0+120');
    // Act
    drops.at = { ...along(0.5), lat: -12.0001 };
    fireEvent.click(await screen.findByTestId('avance-anillo'));
    expect(screen.queryByTestId('avance-manual-nota')).toBeNull();
    fireEvent.click(screen.getByTestId('avance-nota-abrir'));
    fireEvent.change(screen.getByTestId('avance-manual-nota'), { target: { value: '  Falta la esquina  ' } });
    fireEvent.click(screen.getByTestId('avance-manual-enviar'));
    fireEvent.change(screen.getByTestId('avance-foto-archivo'), { target: { files: [new File(['x'], 'base.jpg', { type: 'image/jpeg' })] } });
    // Assert
    expect(await screen.findByTestId('avance-manual-respuesta')).toHaveTextContent(MANUAL_SENT);
    const request = send.mock.calls[0]![0] as { to_m: number };
    expect(send.mock.calls[0]![0]).toMatchObject({ kind: 'work_manual_progress', street_id: 's1', tag_id: 'base', from_m: 120, photo_ids: [MEDIA] });
    expect(request.to_m).toBeGreaterThan(150);
    // The note rides as before: trimmed, as `nota` of the form.
    const submit = vi.fn(async () => ({ ok: false as const, message: 'x' }));
    await send.mock.calls[0]![1]({ open: async () => ({ ok: true, data: { commandId: 'c1' } }), submit, notice: vi.fn() } as never);
    expect(submit).toHaveBeenCalledWith('c1', { nota: 'Falta la esquina' });
  });

  it('the typed % and the slider move the ring and the summary (José 28/11)', async () => {
    // Arrange
    render(<ManualProgress map={mapOf()} streetId="s1" send={vi.fn<MapEditSend>()} onDone={vi.fn()} />);
    // Act: 75 % of 320 m
    fireEvent.change(screen.getByTestId('avance-porcentaje'), { target: { value: '75' } });
    // Assert
    expect(screen.getByTestId('avance-manual-tramo')).toHaveTextContent('0+120 → 0+240');
    expect(screen.getByTestId('avance-manual-metrado')).toHaveTextContent('+120 m');
    expect((screen.getByTestId('avance-porcentaje-slider') as HTMLInputElement).value).toBe('75');
    expect((await screen.findByTestId('avance-mapa-lienzo')).dataset.tramo).toBe('120-240');
    // Act: the slider to half the street
    fireEvent.change(screen.getByTestId('avance-porcentaje-slider'), { target: { value: '50' } });
    // Assert
    expect(screen.getByTestId('avance-manual-tramo')).toHaveTextContent('0+120 → 0+160');
    expect((screen.getByTestId('avance-porcentaje') as HTMLInputElement).value).toBe('50');
  });

  it('focusing the % selects it, so typing replaces the 0 instead of adding to it', () => {
    // Arrange
    render(<ManualProgress map={mapOf()} streetId="s1" send={vi.fn<MapEditSend>()} onDone={vi.fn()} />);
    const field = screen.getByTestId('avance-porcentaje') as HTMLInputElement;
    // Act
    fireEvent.focus(field);
    // Assert
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, field.value.length]);
    expect(field.value.length).toBeGreaterThan(0);
  });

  it('a % before where the work stopped keeps the ring there; a decimal typed with a comma stays', () => {
    render(<ManualProgress map={mapOf()} streetId="s1" send={vi.fn<MapEditSend>()} onDone={vi.fn()} />);
    fireEvent.change(screen.getByTestId('avance-porcentaje'), { target: { value: '10' } });
    expect(screen.getByTestId('avance-manual-tramo')).toHaveTextContent('0+120 → 0+120');
    fireEvent.change(screen.getByTestId('avance-porcentaje'), { target: { value: '62,5' } });
    expect(screen.getByTestId('avance-manual-tramo')).toHaveTextContent('0+120 → 0+200');
    expect((screen.getByTestId('avance-porcentaje') as HTMLInputElement).value).toBe('62,5');
  });

  it('says what blocks it before the camera, and a refused photo sends nothing', async () => {
    const send = vi.fn<MapEditSend>();
    const uploadPhoto = vi.fn<ManualPhotoUpload<File>>(async () => ({ ok: false, message: 'El archivo pesa demasiado.' }));
    render(<ManualProgress map={mapOf()} streetId="s1" send={send} uploadPhoto={uploadPhoto} onDone={vi.fn()} />);
    fireEvent.click(screen.getByTestId('avance-manual-enviar'));
    expect(await screen.findByTestId('avance-manual-error')).toHaveTextContent(MANUAL_NO_LENGTH);
    fireEvent.click(screen.getByTestId('avance-toda-la-calle'));
    expect(screen.getByTestId('avance-manual-tramo')).toHaveTextContent('0+120 → 0+320');
    expect(screen.getByTestId('avance-manual-area')).toHaveTextContent('Metrado 1 200 m²');
    fireEvent.change(screen.getByTestId('avance-foto-archivo'), { target: { files: [new File(['x'], 'big.jpg', { type: 'image/jpeg' })] } });
    expect(await screen.findByText('El archivo pesa demasiado.')).toBeTruthy();
    expect(send).not.toHaveBeenCalled();
  });

  it('never registers twice what already waits for approval: it starts after it', async () => {
    const send = vi.fn<MapEditSend>(async () => ({ ok: true, message: MANUAL_SENT }));
    render(<ManualProgress map={mapOf([{ streetId: 's1', workId: 'base', fromM: 120, toM: 200 }])} streetId="s1" send={send} onDone={vi.fn()} />);
    expect(screen.getByTestId('avance-manual-tramo')).toHaveTextContent('0+200 → 0+200');
    fireEvent.click(screen.getByTestId('avance-toda-la-calle'));
    fireEvent.click(screen.getByTestId('avance-manual-enviar'));
    expect(await screen.findByTestId('avance-manual-respuesta')).toBeTruthy();
    expect(send.mock.calls[0]![0]).toMatchObject({ from_m: 200, to_m: 320 });
  });

  it('«Hasta mi ubicación» moves the ring where the person stands, and says when there is no position', async () => {
    gpsAt(along(0.75));
    render(<ManualProgress map={mapOf()} streetId="s1" send={vi.fn<MapEditSend>()} onDone={vi.fn()} />);
    expect(await screen.findByTestId('avance-ubicado')).toHaveTextContent('Estás en Jr. Los Pinos · ±4 m');
    fireEvent.click(screen.getByTestId('avance-manual-gps'));
    await waitFor(() => expect(screen.getByTestId('avance-manual-tramo').textContent).toMatch(/0\+120 → 0\+2[4-5]\d/));
    vi.stubGlobal('navigator', { ...navigator, geolocation: undefined });
    fireEvent.click(screen.getByTestId('avance-manual-gps'));
    expect(await screen.findByTestId('avance-manual-error')).toHaveTextContent(GPS_UNAVAILABLE);
  });

  it('without a street, the GPS picks it; «Cambiar» lets the person pick another', async () => {
    gpsAt(along(0.5, lima));
    render(<ManualProgress map={mapOf()} streetId={null} send={vi.fn<MapEditSend>()} onDone={vi.fn()} />);
    expect(await screen.findByTestId('avance-calle-nombre')).toHaveTextContent('Jr. Lima');
    fireEvent.click(screen.getByTestId('avance-cambiar-calle'));
    fireEvent.click(screen.getByTestId('avance-calle-s1'));
    expect(screen.getByTestId('avance-calle-nombre')).toHaveTextContent('Jr. Los Pinos');
    expect(screen.queryByTestId('avance-ubicado')).toBeNull();
  });

  it('a weak GPS leaves the choice to the person; without an uploader it registers without a photo', async () => {
    gpsAt(along(0.5), 80);
    const send = vi.fn<MapEditSend>(async () => ({ ok: true, message: MANUAL_SENT }));
    render(<ManualProgress map={mapOf()} streetId={null} send={send} onDone={vi.fn()} />);
    expect(await screen.findByText(/GPS débil \(±80 m\)/)).toBeTruthy();
    fireEvent.click(screen.getByTestId('avance-calle-s1'));
    expect(screen.getByTestId('avance-manual-enviar')).toHaveTextContent('Registrar avance');
    expect(screen.queryByTestId('avance-sin-foto')).toBeNull();
    fireEvent.click(screen.getByTestId('avance-toda-la-calle'));
    fireEvent.click(screen.getByTestId('avance-manual-enviar'));
    expect(await screen.findByTestId('avance-manual-respuesta')).toHaveTextContent(MANUAL_SENT);
    expect(send.mock.calls[0]![0]).toMatchObject({ photo_ids: [] });
  });

  it('after «Registrar sin foto» the answer offers «Agregar foto» for that record (José 28/11)', async () => {
    // Arrange
    const send = vi.fn<MapEditSend>(async (request) => (request.kind === 'work_progress_photo' ? { ok: true, message: '', data: { avanceId: 'p5', fotos: 1 } } : { ok: true, message: MANUAL_SENT, data: { avanceId: 'p5', estado: 'pendiente' } }));
    const uploadPhoto = vi.fn<ManualPhotoUpload<File>>(async () => ({ ok: true, mediaId: MEDIA }));
    render(<ManualProgress map={mapOf()} streetId="s1" send={send} uploadPhoto={uploadPhoto} onDone={vi.fn()} />);
    fireEvent.click(screen.getByTestId('avance-toda-la-calle'));
    // Act
    fireEvent.click(screen.getByTestId('avance-sin-foto'));
    await screen.findByTestId('avance-manual-respuesta');
    fireEvent.change(screen.getByTestId('agregar-foto-archivo-p5'), { target: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] } });
    // Assert
    await waitFor(() => expect(send.mock.calls.at(-1)?.[0]).toMatchObject({ kind: 'work_progress_photo', progress_id: 'p5', photo_ids: [MEDIA] }));
    expect(await screen.findByTestId('avance-fotos-p5')).toHaveTextContent('1 foto');
  });

  it('a record sent with its photo offers no «Agregar foto»', async () => {
    const send = vi.fn<MapEditSend>(async () => ({ ok: true, message: MANUAL_SENT, data: { avanceId: 'p6' } }));
    const uploadPhoto = vi.fn<ManualPhotoUpload<File>>(async () => ({ ok: true, mediaId: MEDIA }));
    render(<ManualProgress map={mapOf()} streetId="s1" send={send} uploadPhoto={uploadPhoto} onDone={vi.fn()} />);
    fireEvent.click(screen.getByTestId('avance-toda-la-calle'));
    fireEvent.change(screen.getByTestId('avance-foto-archivo'), { target: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] } });
    await screen.findByTestId('avance-manual-respuesta');
    expect(screen.queryByTestId('agregar-foto-p6')).toBeNull();
  });
});
