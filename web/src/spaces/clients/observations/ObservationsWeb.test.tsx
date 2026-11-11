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
