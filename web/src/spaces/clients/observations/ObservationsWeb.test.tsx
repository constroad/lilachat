import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SpaceClientService } from '@lilachat/shared';
import { ObservationsWeb } from './ObservationsWeb';

vi.mock('../workMap/WorkMapCanvas', () => ({ default: () => <div data-testid="lienzo-mapa" /> }));

/** Portal's REG-OBS as agentes passes it (Portal ead85b1a, agentes 275fb32). */
const media = { url: 'https://lila.constroad.com/m/a.jpg', mime: 'image/jpeg' };
const item = (id: string, status: 'open' | 'lifted', note: string) => ({ id, code: `OBS-00${id}`, note, lat: -12.05, lng: -77.03, at: '2026-11-11T15:42:00.000Z', status, media: [media], liftMedia: status === 'lifted' ? [{ url: 'https://lila.constroad.com/m/b.mp4', mime: 'video/mp4', durationS: 12 }] : [], ...(status === 'lifted' ? { liftedAt: '2026-11-11T20:10:00.000Z', liftNote: 'Sellada con emulsión' } : {}) });
const documentOf = (items: unknown[]) => ({
  id: 'r1', type: 'REG-OBS', title: 'Registro de observaciones', status: 'draft', forms: {},
  sections: [{ id: 'observaciones', title: 'Observaciones', items }],
  map: { streets: [{ id: 's1', name: 'Av. Los Incas', geometry: [{ lat: -12.05, lng: -77.031 }, { lat: -12.05, lng: -77.029 }] }] },
  publish: { label: 'Publicar', missing: ['Por ahora este informe se publica desde Portal.'] },
});
const service = { id: 'sv1', name: 'Av. Los Incas' } as SpaceClientService;
const target = { jwt: 't', spaceId: 'w1', clientId: 'c1' };

function answer(body: unknown, status = 200) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push(`${String(url)} ${init?.body as string}`);
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }));
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('ObservationsWeb (design ob-07b)', () => {
  it('shows the totals, the map and every observation, and filters by state', async () => {
    const calls = answer({ document: documentOf([item('1', 'open', 'Fisura en junta fría'), item('2', 'lifted', 'Segregación'), item('3', 'open', 'Bache')]) });
    render(<ObservationsWeb target={target} chatId="ch1" service={service} type="REG-OBS" onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByTestId('obs-total').textContent).toContain('3'));
    expect(calls[0]).toContain('"type":"REG-OBS"');
    expect(screen.getByTestId('obs-levantadas').textContent).toContain('1');
    expect(screen.getByTestId('obs-pendientes').textContent).toContain('2');
    expect(screen.getByTestId('obs-avance').textContent).toContain('33 %');
    expect(await screen.findByTestId('lienzo-mapa')).toBeTruthy();
    expect(screen.getByTestId('publicar-desde-portal').textContent).toBe('Por ahora este informe se publica desde Portal.');

    await userEvent.click(screen.getByTestId('filtro-lifted'));
    expect(screen.queryByTestId('observacion-OBS-001')).toBeNull();
    expect(screen.getByTestId('observacion-OBS-002').textContent).toContain('Segregación');
  });

  it('opens one to see its before and after', async () => {
    answer({ document: documentOf([item('2', 'lifted', 'Segregación')]) });
    render(<ObservationsWeb target={target} chatId="ch1" service={service} type="LEV-OBS" onClose={vi.fn()} />);

    await userEvent.click(await screen.findByTestId('observacion-OBS-002'));

    expect(screen.getByTestId('detalle-OBS-002').textContent).toContain('Sellada con emulsión');
    expect(screen.getByTestId('detalle-OBS-002').textContent).toContain('Levantada 11/11 · 15:10');
  });

  it('says why when Portal does not answer, and asks again', async () => {
    answer({ error: 'report_draft_failed', message: 'No se pudo traer el informe' }, 200);
    render(<ObservationsWeb target={target} chatId="ch1" service={service} type="REG-OBS" onClose={vi.fn()} />);

    expect((await screen.findByTestId('observaciones-fallo')).textContent).toContain('No se pudo traer el informe');
  });
});

describe('registering and lifting from the browser (an iPhone has no APK)', () => {
  const ticket = { url: 'https://portal.constroad.com/api/obs/upload', method: 'POST', fields: { t: 'x' }, fileField: 'file', expiresAt: '2030-01-01T00:00:00.000Z', maxBytes: 50_000_000, maxSeconds: 30, mimeTypes: ['image/jpeg', 'image/png', 'video/mp4'] };
  const answered = (data: Record<string, unknown>) => ({ commandId: 'c1', outcome: 'answered', response: { responseType: 'ephemeral', data, upload: ticket } });

  /** Portal behind the server: the document, the run, its answer and the file. */
  function portal(after: unknown[], answeredId = 'r1') {
    const calls: string[] = [];
    let reads = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const body = typeof init?.body === 'string' ? init.body : '';
      calls.push(`${String(url)} ${body}`);
      const reply = String(url).includes('/reports/draft') ? { document: documentOf(reads++ === 0 ? [item('1', 'open', 'Fisura')] : after) }
        : String(url).includes('/reports/forms') ? { commandId: 'c1', appId: 'a', appName: 'Portal', outcome: 'form', response: { responseType: 'form' } }
        : String(url).includes('/commands/c1/form') ? answered({ informeId: answeredId, observacionId: 'o9', codigo: 'OBS-009' })
        : { mediaId: 'm1', url: 'https://lila.constroad.com/m/1.jpg' };
      return new Response(JSON.stringify(reply), { status: String(url).includes('/obs/upload') ? 201 : 200, headers: { 'Content-Type': 'application/json' } });
    }));
    return calls;
  }
  const photo = () => new File([new Uint8Array([255, 216, 255])], 'foto.jpg', { type: 'image/jpeg' });

  it('«Nueva observación» opens the camera, reads the GPS and registers with its precision', async () => {
    const calls = portal([item('1', 'open', 'Fisura'), item('9', 'open', 'Bache')]);
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: -12.05, longitude: -77.03, accuracy: 6.4 } } as GeolocationPosition) } });
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => undefined }));
    render(<ObservationsWeb target={target} chatId="ch1" service={service} type="REG-OBS" onClose={vi.fn()} />);

    await userEvent.click(await screen.findByTestId('nueva-observacion'));
    await userEvent.upload(screen.getByTestId('entrada-nueva'), photo());
    expect(await screen.findByTestId('gps-nueva')).toHaveTextContent('GPS ±6 m');
    await userEvent.click(screen.getByTestId('registrar-observacion'));

    await waitFor(() => expect(calls.some((call) => call.includes('/obs/upload'))).toBe(true));
    const opened = calls.find((call) => call.includes('/reports/forms'))!;
    expect(opened).toContain('"kind":"observation_register"');
    expect(opened).toContain('"precision_m":6');
    expect(opened).toContain('"source":"web"');
    await waitFor(() => expect(screen.queryByTestId('nueva-observacion-web')).toBeNull());
    expect(await screen.findByTestId('observacion-OBS-009')).toBeTruthy();
  });

  it('a pending one: the button takes the photo of after first, then lifts it', async () => {
    const calls = portal([item('1', 'lifted', 'Fisura')]);
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => undefined }));
    render(<ObservationsWeb target={target} chatId="ch1" service={service} type="LEV-OBS" onClose={vi.fn()} />);

    await userEvent.click(await screen.findByTestId('observacion-OBS-001'));
    expect(screen.getByTestId('marcar-levantada')).toHaveTextContent('Tomar foto del después');
    await userEvent.upload(screen.getAllByTestId('entrada-foto')[0]!, photo());
    await waitFor(() => expect(screen.getByTestId('marcar-levantada')).toHaveTextContent('Marcar como levantada'));
    await userEvent.click(screen.getByTestId('marcar-levantada'));

    await waitFor(() => expect(calls.some((call) => call.includes('"kind":"observation_lift"') && call.includes('"observation_id":"1"'))).toBe(true));
    await waitFor(() => expect(screen.getByTestId('observacion-OBS-001')).toHaveTextContent('Levantada'));
  });

  it('a lift from the registry asks the registry again, not the lifting report Portal answers with', async () => {
    const calls = portal([item('1', 'lifted', 'Fisura')], 'lev9');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => undefined }));
    render(<ObservationsWeb target={target} chatId="ch1" service={service} type="REG-OBS" reportId="r1" onClose={vi.fn()} />);

    await userEvent.click(await screen.findByTestId('observacion-OBS-001'));
    await userEvent.upload(screen.getAllByTestId('entrada-foto')[0]!, photo());
    await waitFor(() => expect(screen.getByTestId('marcar-levantada')).toHaveTextContent('Marcar como levantada'));
    await userEvent.click(screen.getByTestId('marcar-levantada'));

    await waitFor(() => expect(screen.getByTestId('observacion-OBS-001')).toHaveTextContent('Levantada'));
    const asks = calls.filter((call) => call.includes('/reports/draft'));
    expect(asks.at(-1)).toContain('"type":"REG-OBS"');
    expect(asks.at(-1)).not.toContain('lev9');
  });
});

