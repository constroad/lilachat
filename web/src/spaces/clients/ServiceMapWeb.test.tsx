import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChannelLinks, WorkMap, WorkMapView } from '@lilachat/shared';
import { ServiceMapWeb } from './ServiceMapWeb';

const askServer = vi.hoisted(() => vi.fn());
vi.mock('../../api', async (original) => ({ ...(await original<typeof import('../../api')>()), api: askServer }));
vi.mock('./workMap/WorkMapCanvas', () => ({
  default: (props: { view: WorkMapView; expanded: boolean }) => <div data-testid="mapa-lienzo" data-done={props.view.done.length} data-expanded={props.expanded} />,
}));

/** José 06/11: «el mapa literal de la obra», y en la web «un modo pantalla completa». */
const serviceId = '6aedcc3a2f5e395dca260f16';
const target = { kind: 'service' as const, clientId: 'cli-1', serviceId };
const url = `https://constroad.com/public/test/service-report/${'a'.repeat(64)}`;
const linksWith = (map: ChannelLinks['map']): ChannelLinks => ({ can: () => true, open: vi.fn(), map });
const line = [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.99 }];
const workMap: WorkMap = {
  streets: [{ id: 's1', name: 'Av. Los Olivos', line, lengthM: 1000 }, { id: 's2', name: 'Jr. Las Dalias', line, lengthM: 500 }],
  scopes: [
    { streetId: 's1', fromM: 0, toM: 400, workIds: ['base', 'asfalto'], stageId: 'e1' },
    { streetId: 's2', fromM: 0, toM: 200, workIds: ['base'], stageId: 'e2' },
  ],
  progress: [{ streetId: 's1', workId: 'base', fromM: 0, toM: 400, rework: false }],
  works: [{ id: 'base', name: 'Base', color: '#c08a1e' }, { id: 'asfalto', name: 'Asfaltado', color: '#111111' }],
  stages: [{ id: 'e1', name: 'Etapa 1' }, { id: 'e2', name: 'Etapa 2' }],
};
const showMap = (map: ChannelLinks['map'] = vi.fn(async () => ({ ok: true as const, url }))) => render(<ServiceMapWeb jwt="jwt-1" links={linksWith(map)} target={target} />);

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

  it('a service without streets says so', async () => {
    askServer.mockResolvedValue({ ok: true, data: { map: null } });
    showMap();
    expect(await screen.findByTestId('mapa-vacio')).toHaveTextContent('todavía no tiene calles');
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
});
