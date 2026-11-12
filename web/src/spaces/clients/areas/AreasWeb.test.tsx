import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { areaDraftKey, type SpaceClientService } from '@lilachat/shared';
import { AreasWeb } from './AreasWeb';

/**
 * The additional-area report from the client's channel (José 12/11, option B),
 * against Portal's agreed contract: `informe_area_adicional` reads it,
 * `registrar_area_adicional` writes each area, and the Medición picture goes
 * after with `captura: true`.
 */
const service = { id: 'sv1', name: 'Av. Los Incas' } as SpaceClientService;
const target = { jwt: 't', spaceId: 'w1', clientId: 'c1' };
const ticket = { url: 'https://portal.constroad.com/api/iaa/upload', method: 'POST', fields: { t: 'x' }, fileField: 'file', expiresAt: '2030-01-01T00:00:00.000Z', maxBytes: 50_000_000, maxSeconds: 30, mimeTypes: ['image/jpeg', 'image/png'] };
const area = (id: string, areaM2: number, extra: Record<string, unknown> = {}) => ({ id, item: id, areaM2, metodo: 'medidas-iphone', verificar: true, fotos: [{ mediaId: `m${id}`, url: `https://lila.constroad.com/m/${id}.jpg`, captura: true }], ...extra });
const documentOf = (areas: unknown[]) => ({ id: areas.length ? 'r9' : null, codigo: 'IAA-003', estado: 'draft', areas, totales: { areaM2: areas.reduce((sum: number, one) => sum + (one as { areaM2: number }).areaM2, 0), volumenM3: 0 } });

/** Portal behind the server: the report, the run, its answer and each file. */
function portal(before: unknown[], after: unknown[]) {
  const calls: string[] = [];
  const files: FormData[] = [];
  let reads = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const body = typeof init?.body === 'string' ? init.body : '';
    calls.push(`${String(url)} ${body}`);
    if (init?.body instanceof FormData) files.push(init.body);
    const reply = String(url).includes('/reports/draft') ? { document: documentOf(reads++ === 0 ? before : after) }
      : String(url).includes('/reports/forms') ? { commandId: 'c1', appId: 'a', appName: 'Portal', outcome: 'form', response: { responseType: 'form' } }
      : String(url).includes('/commands/c1/form') ? { commandId: 'c1', outcome: 'answered', response: { responseType: 'ephemeral', data: { informeId: 'r9', areaId: 'a7', codigo: 'Área 3' }, upload: ticket } }
      : { mediaId: 'm7', url: 'https://lila.constroad.com/m/7.jpg' };
    return new Response(JSON.stringify(reply), { status: String(url).includes('/iaa/upload') ? 201 : 200, headers: { 'Content-Type': 'application/json' } });
  }));
  return { calls, files };
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => undefined }));
});
afterEach(() => vi.unstubAllGlobals());

const photo = () => new File([new Uint8Array([255, 216, 255])], 'medicion.jpg', { type: 'image/jpeg' });

describe('AreasWeb', () => {
  it('shows the total and each area with its m², sides and how it was measured; the office mark stays out', async () => {
    portal([area('1', 4.8, { largoM: 3.2, anchoM: 1.5, ubicacion: 'Jr. Moquegua' }), area('2', 12.5, { metodo: 'a-mano' })], []);
    render(<AreasWeb target={target} chatId="ch1" service={service} iphone onClose={vi.fn()} />);

    expect(await screen.findByTestId('areas-total')).toHaveTextContent('2 áreas · 17,30 m²');
    expect(screen.getByTestId('area-1')).toHaveTextContent('4,80 m²');
    expect(screen.getByTestId('area-1')).toHaveTextContent('3,20 × 1,50 m');
    expect(screen.getByTestId('area-1')).toHaveTextContent('Medidas (iPhone)');
    expect(screen.getByTestId('area-1')).toHaveTextContent('Jr. Moquegua');
    expect(screen.getByTestId('area-2')).toHaveTextContent('A mano');
    expect(screen.queryByText(/Verifica/)).toBeNull();
  });

  it('with no areas yet, says so and offers the first one', async () => {
    portal([], []);
    render(<AreasWeb target={target} chatId="ch1" service={service} iphone onClose={vi.fn()} />);

    expect(await screen.findByTestId('areas-vacio')).toHaveTextContent('Todavía no hay áreas');
    expect(screen.getByTestId('nueva-area-boton')).toBeEnabled();
  });

  it('an iPhone measures, saves with Medidas, and its picture goes marked as the capture', async () => {
    const { calls, files } = portal([], [area('7', 4.8)]);
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: -12.05, longitude: -77.03, accuracy: 6.4 } } as GeolocationPosition) } });
    render(<AreasWeb target={target} chatId="ch1" service={service} iphone onClose={vi.fn()} />);

    await userEvent.click(await screen.findByTestId('nueva-area-boton'));
    expect(screen.getByTestId('guia-medicion')).toBeTruthy();
    await userEvent.type(screen.getByTestId('area-largo'), '3,2');
    await userEvent.type(screen.getByTestId('area-ancho'), '1,5');
    await userEvent.upload(screen.getByTestId('area-foto-entrada'), photo());
    await screen.findByTestId('area-foto-0');
    await waitFor(() => expect(screen.getByTestId('guardar-area')).toBeEnabled());
    await userEvent.click(screen.getByTestId('guardar-area'));

    await waitFor(() => expect(files).toHaveLength(1));
    const opened = calls.find((call) => call.includes('/reports/forms'))!;
    expect(opened).toContain('"kind":"area_create"');
    expect(opened).toContain('"method":"medidas-iphone"');
    expect(opened).toContain('"area_m2":4.8');
    expect(opened).toContain('"precision_m":6');
    expect(opened).toContain('"source":"web"');
    expect(files[0]!.get('captura')).toBe('true');
    expect(files[0]!.get('t')).toBe('x');
    expect(await screen.findByTestId('area-7')).toBeTruthy();
    expect(screen.queryByTestId('nueva-area')).toBeNull();
    expect(localStorage.getItem(areaDraftKey('sv1'))).toBeNull();
  });

  it('coming back from Medición, a half-filled area opens by itself', async () => {
    portal([], []);
    localStorage.setItem(areaDraftKey('sv1'), JSON.stringify({ entryId: '7f6c1d2e-1111-4a2b-9c3d-123456789abc', mode: 'sides', length: '3,2', width: '', area: '', thickness: '', place: '', note: '', point: null, savedAt: Date.now() }));
    render(<AreasWeb target={target} chatId="ch1" service={service} iphone onClose={vi.fn()} />);

    expect(await screen.findByTestId('area-largo')).toHaveValue('3,2');
  });

  it('says why when Portal does not answer, and asks again', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'report_draft_failed', message: 'No se pudo traer el informe' }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    render(<AreasWeb target={target} chatId="ch1" service={service} iphone onClose={vi.fn()} />);

    expect(await screen.findByTestId('areas-fallo')).toHaveTextContent('No se pudo traer el informe');
  });
});
