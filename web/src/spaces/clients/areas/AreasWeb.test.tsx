import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SpaceClientService } from '@lilachat/shared';
import { AreasWeb } from './AreasWeb';

/**
 * The additional-area report from the client's channel, against Portal's agreed
 * contract: `informe_area_adicional` reads it. Since José 15/11 the phone PWA
 * no longer measures: a banner sends that to the APK (design la-11).
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
    expect(screen.queryByTestId('fotos-sin-area')).toBeNull();
  });

  it('photos with no area show under the report, outside the areas', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ document: { ...documentOf([area('1', 4.8)]), fotosSinArea: [{ url: 'https://lila.constroad.com/m/suelta.jpg' }] } }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    render(<AreasWeb target={target} chatId="ch1" service={service} iphone onClose={vi.fn()} />);

    const loose = await screen.findByTestId('fotos-sin-area');
    expect(loose).toHaveTextContent('Fotos sin área (1)');
    expect(loose.querySelectorAll('img')).toHaveLength(1);
  });

  it('with no areas yet, says so; measuring is not offered here (José 15/11)', async () => {
    portal([], []);
    render(<AreasWeb target={target} chatId="ch1" service={service} iphone={false} onClose={vi.fn()} />);

    expect(await screen.findByTestId('areas-vacio')).toHaveTextContent('Todavía no hay áreas');
    expect(screen.queryByTestId('nueva-area-boton')).toBeNull();
  });

  it('on Android the banner sends the measuring to the APK, with LilaStore when it is missing (design la-11)', async () => {
    portal([area('7', 4.8)], []);
    render(<AreasWeb target={target} chatId="ch1" service={service} iphone={false} onClose={vi.fn()} />);

    const banner = await screen.findByTestId('medir-en-apk');
    expect(banner).toHaveTextContent('MediciónSe mide en el APKCon la cámara (AR) y un lado medido con wincha hay menos error que midiendo sobre una foto.');
    expect(screen.getByTestId('medir-en-apk-abrir')).toHaveAttribute('href', expect.stringMatching(/^intent:#Intent;.*package=com\.lilachat\.app;/));
    expect(screen.getByTestId('medir-en-apk-instalar')).toHaveAttribute('href', 'https://lilastore.constroad.com/app/lilachat');
    expect(screen.getByTestId('area-7')).toBeTruthy();
  });

  it('on an iPhone there is no APK to open: it says to measure from an Android phone', async () => {
    portal([], []);
    render(<AreasWeb target={target} chatId="ch1" service={service} iphone onClose={vi.fn()} />);

    expect(await screen.findByTestId('medir-en-apk')).toHaveTextContent('Mide desde un teléfono Android con el APK de Lilachat.');
    expect(screen.queryByTestId('medir-en-apk-abrir')).toBeNull();
    expect(screen.queryByTestId('medir-en-apk-instalar')).toBeNull();
  });

  it('says why when Portal does not answer, and asks again', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'report_draft_failed', message: 'No se pudo traer el informe' }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    render(<AreasWeb target={target} chatId="ch1" service={service} iphone onClose={vi.fn()} />);

    expect(await screen.findByTestId('areas-fallo')).toHaveTextContent('No se pudo traer el informe');
  });

  it('«Quitar área» asks first, sends the quitar of Portal with only the area, and reads the report again', async () => {
    // Arrange
    const sent = portal([area('1', 4.8), area('2', 12.5, { metodo: 'foto-medida' })], [area('2', 12.5, { metodo: 'foto-medida' })]);
    render(<AreasWeb target={target} chatId="ch1" service={service} iphone onClose={vi.fn()} />);
    await screen.findByTestId('area-1');
    // Act
    await userEvent.click(screen.getByTestId('quitar-area-1'));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('¿Quitar el área 1?');
    await userEvent.click(screen.getByTestId('quitar-area-si-1'));
    // Assert
    await waitFor(() => expect(screen.queryByTestId('area-1')).toBeNull());
    expect(sent.calls.some((call) => call.includes('/reports/forms') && call.includes('"kind":"area_remove"') && call.includes('"area_id":"1"'))).toBe(true);
    expect(screen.queryByTestId('quitar-area-2')).toBeNull();
  });
});
