import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChannelLinks, UnitDischarge, WorkMap, WorkMapView } from '@lilachat/shared';
import { ServiceMapWeb } from './ServiceMapWeb';
import type { ProgressSend } from './workMap/WorkMapDischarges';
import type { StreetSend } from './workMap/workProgressSender';
import type { StreetDeleteSend } from './workMap/StreetDelete';

const askServer = vi.hoisted(() => vi.fn());
vi.mock('../../api', async (original) => ({ ...(await original<typeof import('../../api')>()), api: askServer }));
/** The street under every tap of the fake map: 500 m east-west, named in the tiles around. */
const pineStreet = vi.hoisted(() => (named: boolean) => ({ properties: { class: 'minor', ...(named ? { name: 'Jr. Los Pinos' } : {}) }, geometry: { type: 'LineString', coordinates: [[-77, -12], [-77 + 500 / 108_766, -12]] } }));
/** A tap on the fake map goes 100 m further east each time, as when a street is drawn (o-02). */
const taps = vi.hoisted(() => ({ count: 0 }));
vi.mock('./workMap/WorkMapCanvas', () => ({
  default: (props: { view: WorkMapView; expanded: boolean; pins?: unknown[]; stretches?: unknown[]; onTap?: (point: { lat: number; lng: number }, roads: unknown) => void }) => (
    <div data-testid="mapa-lienzo" data-done={props.view.done.length} data-expanded={props.expanded} data-pins={props.pins?.length ?? 0} data-stretches={props.stretches?.length ?? 0}>
      {props.onTap ? <button type="button" data-testid="mapa-tocar" onClick={() => { const point = { lat: -12, lng: -77 + (taps.count++ * 100) / 108_766 }; props.onTap?.(point, { underFinger: [pineStreet(false)], nearby: [pineStreet(true)], tap: point }); }} /> : null}
    </div>
  ),
}));

/** José 06/11 asked for the literal map of the work, with a full screen mode on the web. */
const serviceId = '6aedcc3a2f5e395dca260f16';
const target = { kind: 'service' as const, clientId: 'cli-1', serviceId };
const url = `https://constroad.com/public/test/service-report/${'a'.repeat(64)}`;
const linksWith = (map: ChannelLinks['map']): ChannelLinks => ({ can: () => true, open: vi.fn(), map });
const line = [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.99 }];
const workMap: WorkMap = {
  streets: [{ id: 's1', name: 'Av. Los Olivos', line, lengthM: 1000 }, { id: 's2', name: 'Jr. Las Dalias', line, lengthM: 500 }],
  scopes: [
    { id: 'c1', streetId: 's1', fromM: 0, toM: 400, workIds: ['base', 'asfalto'], stageId: 'e1' },
    { id: 'c2', streetId: 's2', fromM: 0, toM: 200, workIds: ['base'], stageId: 'e2' },
  ],
  progress: [{ streetId: 's1', workId: 'base', fromM: 0, toM: 400, date: '2026-11-01', rework: false }],
  works: [{ id: 'base', name: 'Base', color: '#c08a1e' }, { id: 'asfalto', name: 'Asfaltado', color: '#111111' }],
  stages: [{ id: 'e1', name: 'Etapa 1' }, { id: 'e2', name: 'Etapa 2' }],
};
const showMap = (map: ChannelLinks['map'] = vi.fn(async () => ({ ok: true as const, url })), extra: { drawUrl?: string | null; discharges?: UnitDischarge[]; send?: ProgressSend; drawStreet?: StreetSend; deleteStreet?: StreetDeleteSend } = {}) => render(<ServiceMapWeb jwt="jwt-1" links={linksWith(map)} target={target} title="Pavimentación Los Olivos" {...extra} />);

/** A spot on Av. Los Olivos, so many meters from its start (it runs east along -12). */
const METERS_PER_DEGREE_LNG = 111_195 * Math.cos((12 * Math.PI) / 180);
const onStreet = (meters: number, sideM = 0) => ({ lat: -12 + sideM / 111_195, lng: -77 + meters / METERS_PER_DEGREE_LNG });
const discharge = (dispatchId: string, plate: string, ...spots: Array<{ lat: number; lng: number }>): UnitDischarge => ({
  dispatchId, plate, m3: 15, arrivalAt: '2026-11-07T14:00:00.000Z',
  points: spots.map((spot, index) => ({ kind: index ? 'vacia' : 'ingreso', ...spot, precisionM: 6, at: '2026-11-07T14:00:00.000Z' })),
});
const discharges = [
  discharge('a', 'QAP-101', onStreet(10), onStreet(40)),
  discharge('b', 'QAP-102', onStreet(40), onStreet(70)),
  discharge('d', 'QAP-104', onStreet(50, 200)),
];

describe('ServiceMapWeb', () => {
  beforeEach(() => {
    askServer.mockReset();
    askServer.mockResolvedValue({ ok: true, data: { map: workMap } });
  });

  it('asks the map with the link of the service and draws it here', async () => {
    // Arrange
    const map = vi.fn(async () => ({ ok: true as const, url }));
    // Act
    showMap(map);
    // Assert
    expect(await screen.findByTestId('mapa-lienzo')).toBeInTheDocument();
    expect(map).toHaveBeenCalledWith(target);
    expect(askServer).toHaveBeenCalledWith('/service-work-map', { jwt: 'jwt-1', body: { link: url, serviceId } });
    expect(screen.getByTestId('mapa-avance')).toHaveTextContent('40 %');
    expect(screen.getByTestId('mapa-avance')).toHaveTextContent('400 m de 1 000 m');
  });

  it('lists the streets under their stage, says where each stage is and where the map is cut (design o-01)', async () => {
    // Act
    showMap();

    // Assert
    const first = await screen.findByText('Etapa 1 · En ejecución');
    expect(first.closest('section')).toContainElement(screen.getByTestId('mapa-calle-s1'));
    expect(screen.getByText('Etapa 2 · Por iniciar').closest('section')).toContainElement(screen.getByTestId('mapa-calle-s2'));
    expect(screen.getByTestId('mapa-barra-trabajos').children).toHaveLength(1);
    expect(screen.getByTestId('mapa-corte-pie')).toHaveTextContent('Corte: Hasta hoy');
  });

  it('on a wide board the filters float over the map and the panel goes to its right', async () => {
    // Arrange
    let report: (width: number) => void = () => undefined;
    vi.stubGlobal('ResizeObserver', class {
      constructor(private readonly onResize: ResizeObserverCallback) {}
      observe() { report = (width) => this.onResize([{ contentRect: { width } } as ResizeObserverEntry], this as unknown as ResizeObserver); }
      disconnect() { report = () => undefined; }
    });
    showMap();
    await screen.findByTestId('mapa-lienzo');

    // Act
    act(() => report(1200));

    // Assert
    expect(screen.getByTestId('mapa-servicio')).toHaveAttribute('data-wide', 'true');
    expect(screen.getByTestId('mapa-compartir')).toHaveTextContent('Compartir avance');
    act(() => report(600));
    expect(screen.getByTestId('mapa-servicio')).toHaveAttribute('data-wide', 'false');
    vi.unstubAllGlobals();
  });

  it('shows the progress up to the day chosen and keeps the work picked', async () => {
    // Arrange
    const twoDays: WorkMap = {
      ...workMap,
      progress: [
        { streetId: 's1', workId: 'base', fromM: 0, toM: 100, date: '2026-11-01', rework: false },
        { streetId: 's1', workId: 'base', fromM: 100, toM: 400, date: '2026-11-02', rework: false },
      ],
    };
    askServer.mockResolvedValue({ ok: true, data: { map: twoDays } });
    showMap();
    // Act
    fireEvent.click(await screen.findByTestId('mapa-trabajo-base'));
    fireEvent.change(screen.getByTestId('mapa-corte'), { target: { value: '2026-11-01' } });
    // Assert
    expect(screen.getByTestId('mapa-avance')).toHaveTextContent('100 m de 600 m');
    expect(screen.getByTestId('mapa-trabajo-base')).toHaveAttribute('aria-pressed', 'true');
    expect(within(screen.getByTestId('mapa-corte')).getByRole('option', { name: 'Hasta el 1 nov' })).toBeInTheDocument();
  });

  it('offers no cut with a single worked day, which would change nothing', async () => {
    // Act
    showMap();
    // Assert
    await screen.findByTestId('mapa-lienzo');
    expect(screen.queryByTestId('mapa-corte')).not.toBeInTheDocument();
  });

  it('keeps Portal one tap away, in its own tab', async () => {
    showMap();
    const open = await screen.findByTestId('mapa-abrir');
    expect(open).toHaveAttribute('href', `${url}/service/${serviceId}?section=map`);
    expect(open).toHaveAttribute('target', '_blank');
  });

  it('lists each street with how far it went', async () => {
    showMap();
    const row = await screen.findByTestId('mapa-calle-s1');
    expect(within(row).getByText('Av. Los Olivos')).toBeInTheDocument();
    expect(row).toHaveTextContent('Base completa');
    expect(screen.getByTestId('mapa-calle-s2')).toHaveTextContent('Sin avance');
  });

  it('a work chip narrows the map, and the other chips stay', async () => {
    showMap();
    fireEvent.click(await screen.findByTestId('mapa-trabajo-asfalto'));
    expect(screen.getByTestId('mapa-avance')).toHaveTextContent('0 %');
    expect(screen.getByTestId('mapa-trabajo-base')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('mapa-trabajo-todos'));
    expect(screen.getByTestId('mapa-avance')).toHaveTextContent('40 %');
  });

  it('a stage narrows the streets', async () => {
    showMap();
    fireEvent.change(await screen.findByTestId('mapa-etapa'), { target: { value: 'e2' } });
    expect(screen.queryByTestId('mapa-calle-s1')).not.toBeInTheDocument();
    expect(screen.getByTestId('mapa-calle-s2')).toBeInTheDocument();
  });

  it('a stage that lacks the chosen work does not leave an empty map', async () => {
    showMap();
    fireEvent.click(await screen.findByTestId('mapa-trabajo-asfalto'));
    fireEvent.change(screen.getByTestId('mapa-etapa'), { target: { value: 'e2' } });
    expect(screen.getByTestId('mapa-calle-s2')).toBeInTheDocument();
  });

  it('goes full screen and comes back with Escape', async () => {
    showMap();
    fireEvent.click(await screen.findByTestId('mapa-pantalla-completa'));
    expect(screen.getByTestId('mapa-servicio')).toHaveAttribute('data-expanded', 'true');
    expect(await screen.findByTestId('mapa-lienzo')).toHaveAttribute('data-expanded', 'true');
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(screen.getByTestId('mapa-servicio')).toHaveAttribute('data-expanded', 'false');
  });

  it('exports what the map shows to Google Earth, named after the service (design o-12)', async () => {
    // Arrange
    const saved: Blob[] = [];
    URL.createObjectURL = vi.fn((blob: Blob) => { saved.push(blob); return 'blob:kmz'; });
    URL.revokeObjectURL = vi.fn();
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    showMap();
    await screen.findByTestId('mapa-lienzo');
    fireEvent.change(screen.getByTestId('mapa-etapa'), { target: { value: 'e1' } });
    // Act
    fireEvent.click(screen.getByTestId('mapa-exportar'));
    fireEvent.click(screen.getByTestId('mapa-descargar-kmz'));
    // Assert
    expect(screen.getByTestId('mapa-exportar-alcance')).toHaveTextContent('Etapa 1 · Hasta hoy');
    expect(saved[0]?.type).toBe('application/vnd.google-earth.kmz');
    const link = clicked.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(link.download).toMatch(/^pavimentacion-los-olivos-\d{4}-\d{2}-\d{2}\.kmz$/);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:kmz');
    clicked.mockRestore();
  });

  it('copies the link the client opens, and the panel closes', async () => {
    // Arrange
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    showMap();
    await screen.findByTestId('mapa-lienzo');
    fireEvent.click(screen.getByTestId('mapa-exportar'));
    // Act
    fireEvent.click(screen.getByTestId('mapa-copiar-enlace-visor'));
    // Assert
    await waitFor(() => expect(screen.getByTestId('mapa-copiar-enlace-visor')).toHaveTextContent('Enlace copiado'));
    expect(writeText).toHaveBeenCalledWith(`${url}/service/${serviceId}?section=map`);
    fireEvent.click(screen.getByTestId('mapa-exportar-cerrar'));
    expect(screen.queryByTestId('mapa-exportar-panel')).not.toBeInTheDocument();
  });

  it('shows the progress the units suggest, with a pin per unit (design o-07)', async () => {
    // Act
    showMap(undefined, { discharges });
    // Assert
    const canvas = await screen.findByTestId('mapa-lienzo');
    expect(screen.getByTestId('avance-listas')).toHaveTextContent('2 de 3 listas');
    expect(within(screen.getByTestId('tramo-sugerido-s1')).getByText('+60 m')).toBeInTheDocument();
    expect(screen.getByTestId('avance-progresivas')).toHaveTextContent('0+010 a 0+070');
    expect(screen.getByTestId('descarga-d')).toHaveTextContent('Fuera de la obra');
    expect(canvas).toHaveAttribute('data-pins', '3');
    expect(canvas).toHaveAttribute('data-stretches', '1');
    // Until Portal's tool is on, nothing pretends to register.
    expect(screen.queryByTestId('avance-confirmar')).not.toBeInTheDocument();
  });

  it('picks the work, adjusts the stretch and confirms it with the units that did it', async () => {
    // Arrange
    const send = vi.fn<ProgressSend>(async () => ({ ok: true, message: 'Avance registrado. Queda pendiente de aprobación del residente.' }));
    showMap(undefined, { discharges, send });
    await screen.findByTestId('mapa-lienzo');
    // Act: two works on that street, so nothing goes until one is picked.
    fireEvent.click(screen.getByTestId('avance-confirmar'));
    const missing = screen.getByTestId('avance-respuesta').textContent;
    fireEvent.click(screen.getByTestId('avance-trabajo-asfalto'));
    fireEvent.click(screen.getByTestId('avance-ajustar'));
    fireEvent.change(screen.getByTestId('avance-hasta'), { target: { value: '65' } });
    fireEvent.click(screen.getByTestId('avance-confirmar'));
    // Assert
    expect(missing).toBe('Elige el trabajo que se hizo en el tramo.');
    await waitFor(() => expect(screen.getByTestId('avance-respuesta')).toHaveTextContent('pendiente de aprobación'));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toMatchObject({ servicioId: serviceId, calleId: 's1', etiquetaId: 'asfalto', desdeM: 10, hastaM: 65, despachoIds: ['a', 'b'] });
    expect(screen.getByTestId('avance-confirmar')).toHaveTextContent('Confirmar avance (55 m)');
  });

  it('every member sees the suggestion, not only an admin (José 07/11: «todos pueden crear y actualizar»)', async () => {
    showMap(undefined, { discharges });
    expect(await screen.findByTestId('avance-sugerido')).toBeInTheDocument();
  });


  it('a service without streets shows how to start and where to draw them, to everyone (design o-10)', async () => {
    // Arrange
    askServer.mockResolvedValue({ ok: true, data: { map: null } });
    const drawUrl = 'https://portal.constroad.com/admin/service-management/6aedcc3a0c104549fea4aa30?tab=mapa';
    // Act
    showMap(undefined, { drawUrl });
    // Assert
    const card = await screen.findByTestId('mapa-primera-calle');
    expect(card).toHaveTextContent('Todavía no hay calles');
    expect(card).toHaveTextContent('Dibuja las calles');
    expect(screen.getByTestId('mapa-dibujar-portal')).toHaveAttribute('href', drawUrl);
    expect(screen.queryByTestId('mapa-vacio')).not.toBeInTheDocument();
  });

  it('without the Portal page there is no button that leads nowhere', async () => {
    askServer.mockResolvedValue({ ok: true, data: { map: null } });
    showMap(undefined, { drawUrl: null });
    expect(await screen.findByTestId('mapa-primera-calle')).toHaveTextContent('Todavía no hay calles');
    expect(screen.queryByTestId('mapa-dibujar-portal')).not.toBeInTheDocument();
  });

  it('a link that fails says so and can be tried again', async () => {
    const map = vi.fn().mockResolvedValueOnce({ ok: false, message: 'No se pudo abrir el mapa.' }).mockResolvedValueOnce({ ok: true, url });
    showMap(map);
    expect(await screen.findByTestId('mapa-fallo')).toHaveTextContent('No se pudo abrir el mapa.');
    fireEvent.click(screen.getByTestId('mapa-reintentar'));
    expect(await screen.findByTestId('mapa-lienzo')).toBeInTheDocument();
    expect(map).toHaveBeenCalledTimes(2);
  });

  it('when Portal does not answer it still offers its page', async () => {
    askServer.mockResolvedValue({ ok: false, status: 502, message: 'No se pudo cargar el mapa. Prueba de nuevo.' });
    showMap();
    expect(await screen.findByTestId('mapa-fallo')).toHaveTextContent('No se pudo cargar el mapa');
    expect(screen.getByTestId('mapa-abrir')).toHaveAttribute('href', `${url}/service/${serviceId}?section=map`);
    await waitFor(() => expect(askServer).toHaveBeenCalledTimes(1));
  });

  it('draws the first street: taps, name, length, and «Guardar calle» reloads the map (design o-02)', async () => {
    // Arrange
    askServer.mockResolvedValueOnce({ ok: true, data: { map: null } }).mockResolvedValue({ ok: true, data: { map: workMap } });
    const drawStreet = vi.fn<StreetSend>(async () => ({ ok: true, message: 'Calle guardada.' }));
    taps.count = 0;
    showMap(undefined, { drawStreet });
    fireEvent.click(await screen.findByTestId('mapa-dibujar-calle'));
    fireEvent.click(await screen.findByTestId('editor-modo-hand'));
    // Act
    fireEvent.click(await screen.findByTestId('mapa-tocar'));
    fireEvent.click(screen.getByTestId('editor-calle-guardar'));
    expect(screen.getByTestId('editor-calle-error')).toHaveTextContent('Toca el inicio y el fin');
    fireEvent.click(screen.getByTestId('mapa-tocar'));
    fireEvent.click(screen.getByTestId('editor-calle-guardar'));
    expect(screen.getByTestId('editor-calle-error')).toHaveTextContent('Ponle nombre a la calle');
    fireEvent.change(screen.getByTestId('editor-calle-nombre'), { target: { value: 'Jr. Los Pinos' } });
    fireEvent.change(screen.getByTestId('editor-calle-ancho'), { target: { value: '6' } });
    // Assert
    expect(screen.getByTestId('editor-calle-largo')).toHaveTextContent('100 m');
    expect(screen.getByTestId('mapa-lienzo')).toHaveAttribute('data-stretches', '1');
    fireEvent.click(screen.getByTestId('editor-calle-guardar'));
    await waitFor(() => expect(drawStreet).toHaveBeenCalledTimes(1));
    const [draft, entryId] = drawStreet.mock.calls[0]!;
    expect(draft).toMatchObject({ name: 'Jr. Los Pinos', widthM: 6 });
    expect(draft.points).toHaveLength(2);
    expect(entryId).toMatch(/^[0-9a-f-]{36}$/);
    expect(await screen.findByTestId('mapa-avance')).toBeInTheDocument();
    expect(screen.queryByTestId('editor-calle')).not.toBeInTheDocument();
  });

  it('anyone deletes a street after confirming it, and the map is asked again (José 07/11)', async () => {
    // Arrange
    askServer.mockResolvedValue({ ok: true, data: { map: workMap } });
    const deleteStreet = vi.fn<StreetDeleteSend>(async () => ({ ok: true, message: 'Calle borrada. Un admin puede restaurarla.' }));
    showMap(undefined, { deleteStreet });
    const asked = askServer.mock.calls.length;
    // Act
    fireEvent.click(await screen.findByTestId('borrar-calle-s2'));
    // Assert
    expect(screen.getByTestId('confirmar-borrar-s2')).toHaveTextContent('¿Borrar «Jr. Las Dalias»?');
    expect(screen.getByTestId('confirmar-borrar-s2')).toHaveTextContent('Un admin puede restaurarla.');
    expect(deleteStreet).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('borrar-calle-si-s2'));
    await waitFor(() => expect(deleteStreet).toHaveBeenCalledWith('s2'));
    await waitFor(() => expect(askServer.mock.calls.length).toBeGreaterThan(asked));
  });

  it('a street with progress stays, with Portal\'s words under the question', async () => {
    askServer.mockResolvedValue({ ok: true, data: { map: workMap } });
    const deleteStreet = vi.fn<StreetDeleteSend>(async () => ({ ok: false, message: 'La calle tiene avance registrado.' }));
    showMap(undefined, { deleteStreet });
    fireEvent.click(await screen.findByTestId('borrar-calle-s1'));
    fireEvent.click(screen.getByTestId('borrar-calle-si-s1'));
    expect(await screen.findByRole('alert')).toHaveTextContent('La calle tiene avance registrado.');
    expect(screen.getByTestId('mapa-calle-s1')).toBeInTheDocument();
  });

  it('without a sender there is no delete button', async () => {
    askServer.mockResolvedValue({ ok: true, data: { map: workMap } });
    showMap();
    await screen.findByTestId('mapa-calle-s1');
    expect(screen.queryByTestId('borrar-calle-s1')).not.toBeInTheDocument();
  });

  it('«Tocar la calle»: a tap brings the street named, two more keep only the stretch of work (audit 07/11)', async () => {
    // Arrange
    askServer.mockResolvedValue({ ok: true, data: { map: workMap } });
    const drawStreet = vi.fn<StreetSend>(async () => ({ ok: true, message: 'Calle guardada.' }));
    taps.count = 1;
    showMap(undefined, { drawStreet });
    fireEvent.click(await screen.findByTestId('mapa-nueva-calle'));
    // Act
    fireEvent.click(await screen.findByTestId('mapa-tocar'));
    // Assert
    expect(screen.getByTestId('editor-calle-nombre')).toHaveValue('Jr. Los Pinos');
    expect(screen.getByTestId('editor-calle-largo')).toHaveTextContent('500 m');
    expect(screen.getByTestId('editor-calle-ayuda')).toHaveTextContent('Toca dónde empieza la obra');
    fireEvent.click(screen.getByTestId('mapa-tocar'));
    fireEvent.click(screen.getByTestId('mapa-tocar'));
    expect(screen.getByTestId('editor-calle-largo')).toHaveTextContent('100 m');
    expect(screen.getByTestId('editor-calle-extremos')).toHaveTextContent('Inicio 0+000 · Fin 0+100');
    expect(screen.queryByTestId('editor-calle-area')).toBeNull();
    fireEvent.change(screen.getByTestId('editor-calle-ancho'), { target: { value: '6' } });
    expect(screen.getByTestId('editor-calle-area')).toHaveTextContent('600 m²');
    fireEvent.click(screen.getByTestId('editor-calle-guardar'));
    await waitFor(() => expect(drawStreet).toHaveBeenCalledTimes(1));
    expect(drawStreet.mock.calls[0]![0]).toMatchObject({ name: 'Jr. Los Pinos', mode: 'street' });
  });

  it('«Deshacer» takes back a tap, and a refusal from Portal stays in the editor with its words', async () => {
    askServer.mockResolvedValue({ ok: true, data: { map: workMap } });
    const drawStreet = vi.fn<StreetSend>(async () => ({ ok: false, message: 'Ese trazo deja fuera un avance aprobado.' }));
    showMap(undefined, { drawStreet });
    fireEvent.click(await screen.findByTestId('mapa-nueva-calle'));
    fireEvent.click(await screen.findByTestId('editor-modo-hand'));
    fireEvent.click(await screen.findByTestId('mapa-tocar'));
    fireEvent.click(screen.getByTestId('mapa-tocar'));
    fireEvent.click(screen.getByTestId('mapa-tocar'));
    fireEvent.click(screen.getByTestId('editor-calle-deshacer'));
    expect(screen.getByTestId('editor-calle-puntos')).toHaveTextContent('2 puntos');
    fireEvent.change(screen.getByTestId('editor-calle-nombre'), { target: { value: 'Calle Lima' } });
    fireEvent.click(screen.getByTestId('editor-calle-guardar'));
    expect(await screen.findByTestId('editor-calle-error')).toHaveTextContent('Ese trazo deja fuera un avance aprobado.');
    expect(screen.getByTestId('editor-calle')).toBeInTheDocument();
  });
});
