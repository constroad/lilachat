import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GPS_UNAVAILABLE, MANUAL_NO_LENGTH, MANUAL_SENT, workMapOf, type ManualPhotoUpload, type MapEditSend, type WorkMap } from '@lilachat/shared';
import { ManualProgress } from './ManualProgress';

/** Design o-06 on the web: a stretch done by hand, from where the work stopped, with a photo. */
const line = [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.997 }];
const MEDIA = '6aef8d455e4b25190f7c3177';
const mapOf = (): WorkMap => workMapOf({
  workStreets: {
    streets: [{ _id: 's1', name: 'Jr. Los Pinos', geometry: line, lengthM: 320, widthM: 6 }],
    scopes: [{ _id: 'c1', streetId: 's1', fromM: 0, toM: 320, tagIds: ['base'], partidaIds: [] }],
    progress: [{ streetId: 's1', tagId: 'base', fromM: 0, toM: 120, date: '2026-11-01' }],
    tags: [{ _id: 'base', name: 'Base', color: '#c08a1e', order: 1 }],
    stages: [],
  },
})!;

describe('ManualProgress', () => {
  it('starts where the work stopped, moves the end, adds a photo and sends it pending', async () => {
    // Arrange
    const send = vi.fn<MapEditSend>(async () => ({ ok: true, message: MANUAL_SENT }));
    const uploadPhoto = vi.fn<ManualPhotoUpload<File>>(async () => ({ ok: true, mediaId: MEDIA }));
    render(<ManualProgress map={mapOf()} streetId="s1" lengthM={320} widthM={6} send={send} uploadPhoto={uploadPhoto} onDone={vi.fn()} />);
    // Act
    expect(screen.getByTestId('avance-manual-desde')).toHaveTextContent('0+120');
    fireEvent.click(screen.getByTestId('avance-manual-mas'));
    fireEvent.change(screen.getByTestId('avance-manual-hasta'), { target: { value: '240' } });
    expect(screen.getByTestId('avance-manual-hasta-progresiva')).toHaveTextContent('Progresiva 0+240');
    fireEvent.change(screen.getByTestId('avance-foto-archivo'), { target: { files: [new File(['x'], 'base.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(screen.getByTestId('avance-fotos')).toHaveTextContent('1 de 6 fotos'));
    fireEvent.click(screen.getByTestId('avance-manual-enviar'));
    // Assert
    expect(screen.getByTestId('avance-manual-metrado')).toHaveTextContent('+120 m · 720 m²');
    expect(await screen.findByTestId('avance-manual-respuesta')).toHaveTextContent(MANUAL_SENT);
    expect(send.mock.calls[0]![0]).toMatchObject({ kind: 'work_manual_progress', street_id: 's1', tag_id: 'base', from_m: 120, to_m: 240, photo_ids: [MEDIA] });
  });

  it('says what is missing without sending, and shows a refused photo', async () => {
    const send = vi.fn<MapEditSend>();
    render(<ManualProgress map={mapOf()} streetId="s1" lengthM={320} send={send} uploadPhoto={async () => ({ ok: false, message: 'El archivo pesa demasiado.' })} onDone={vi.fn()} />);
    fireEvent.click(screen.getByTestId('avance-manual-enviar'));
    expect(await screen.findByTestId('avance-manual-error')).toHaveTextContent(MANUAL_NO_LENGTH);
    expect(send).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId('avance-foto-archivo'), { target: { files: [new File(['x'], 'big.jpg', { type: 'image/jpeg' })] } });
    expect(await screen.findByText('El archivo pesa demasiado.')).toBeTruthy();
  });

  it('«Mi GPS» puts the end where the person stands, and says when there is no position', async () => {
    // Arrange
    const line = mapOf().streets[0]!.line;
    const at = { lat: line[0]!.lat, lng: line[0]!.lng + (line[1]!.lng - line[0]!.lng) * 0.75 };
    const getCurrentPosition = vi.fn((ok: PositionCallback) => ok({ coords: { latitude: at.lat, longitude: at.lng, accuracy: 4 } } as GeolocationPosition));
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } });
    render(<ManualProgress map={mapOf()} streetId="s1" lengthM={320} send={vi.fn<MapEditSend>()} onDone={vi.fn()} />);
    // Act
    fireEvent.click(screen.getByTestId('avance-manual-gps'));
    // Assert
    await waitFor(() => expect(Number((screen.getByTestId('avance-manual-hasta') as HTMLInputElement).value)).toBeGreaterThan(230));
    vi.stubGlobal('navigator', { ...navigator, geolocation: undefined });
    fireEvent.click(screen.getByTestId('avance-manual-gps'));
    expect(await screen.findByTestId('avance-manual-error')).toHaveTextContent(GPS_UNAVAILABLE);
    vi.unstubAllGlobals();
  });

  it('without an uploader there is no photo step', () => {
    render(<ManualProgress map={mapOf()} streetId="s1" lengthM={320} send={vi.fn<MapEditSend>()} onDone={vi.fn()} />);
    expect(screen.queryByTestId('avance-foto')).toBeNull();
  });
});
