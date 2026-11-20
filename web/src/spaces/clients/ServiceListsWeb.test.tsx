import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DISPATCH_THUMB_SLOTS, type ServiceDetail } from '@lilachat/shared';
import { ServiceListWeb } from './ServiceListsWeb';

/** José 20/11: a dispatch showed only 3 photos, videos as a plain icon, and no way to see the rest. */
const ok = { label: 'Despachado', tone: 'ok' as const };
const photo = (index: number) => ({ url: `https://lila.constroad.com/p${index}.jpg`, mime: 'image/jpeg' });
const video = { url: 'https://lila.constroad.com/v1.mp4', thumbUrl: 'https://lila.constroad.com/v1.jpg', mime: 'video/mp4' };
const detailWith = (pictures: object[]): ServiceDetail => ({
  service: { id: 's1', name: 'Parches' },
  orders: [{ id: 'o1', product: 'Mezcla asfáltica', quantity: 12, unit: 'm³', date: '2026-11-18', status: ok }],
  dispatches: [{ id: 'd1', orderId: 'o1', plate: 'ABC-123', status: ok, pictures } as ServiceDetail['dispatches'][number]],
  reports: [],
  totals: { orders: 1, dispatches: 1, reports: 0 },
});
const renderList = (pictures: object[]) => {
  const onOpenFile = vi.fn();
  render(<ServiceListWeb detail={detailWith(pictures)} tab="orders" onOpen={() => undefined} onOpenDispatch={() => undefined} onOpenFile={onOpenFile} />);
  return { onOpenFile, row: screen.getByTestId('despacho-d1') };
};

describe('a dispatch row shows what fits and opens ALL its media (José 20/11)', () => {
  it('more pictures than the row fits: the last slot is «+K» and it opens the first hidden one among all', () => {
    // Arrange
    const pictures = Array.from({ length: 8 }, (_, index) => photo(index));
    const { onOpenFile, row } = renderList(pictures);
    // Act
    fireEvent.click(within(row).getByTestId('despacho-mas-d1'));
    // Assert
    expect(within(row).getAllByTestId(/^despacho-foto-/)).toHaveLength(DISPATCH_THUMB_SLOTS.wide - 1);
    expect(within(row).getByTestId('despacho-mas-d1')).toHaveTextContent(`+${8 - (DISPATCH_THUMB_SLOTS.wide - 1)}`);
    const [opened, all] = onOpenFile.mock.calls[0]!;
    expect(opened.url).toBe(pictures[DISPATCH_THUMB_SLOTS.wide - 1]!.url);
    expect(all).toHaveLength(8);
  });

  it('a thumb opens the viewer with every picture and video of the dispatch', () => {
    // Arrange
    const { onOpenFile, row } = renderList([photo(1), video]);
    // Act
    fireEvent.click(within(row).getByTestId('despacho-foto-0'));
    // Assert
    expect(onOpenFile.mock.calls[0]![1].map((one: { url: string }) => one.url)).toEqual([photo(1).url, video.url]);
    expect(within(row).queryByTestId('despacho-mas-d1')).toBeNull();
  });

  it('a video shows its frame with a play mark, not a plain gallery icon', () => {
    // Arrange / Act
    const { row } = renderList([video]);
    // Assert
    const thumb = within(row).getByTestId('despacho-foto-0');
    expect(thumb.querySelector('img')?.getAttribute('src')).toBe(video.thumbUrl);
    expect(thumb.querySelector('.lucide-play')).not.toBeNull();
  });

  it('a thumb opens the viewer, not the dispatch sheet', () => {
    // Arrange
    const onOpenDispatch = vi.fn();
    render(<ServiceListWeb detail={detailWith([photo(1)])} tab="orders" onOpen={() => undefined} onOpenDispatch={onOpenDispatch} onOpenFile={vi.fn()} />);
    // Act
    fireEvent.click(screen.getByTestId('despacho-foto-0'));
    // Assert
    expect(onOpenDispatch).not.toHaveBeenCalled();
  });
});

/** José 20/11 (ped-v2): «¿te parece ordenado?» and «no veo los archivos al tocar un despacho». */
describe('ped-v2: the order card with its summary and the dispatches by hour', () => {
  const sent = (id: string, hourUtc: string, pictures: object[] = []) => ({ id, orderId: 'o1', plate: `P-${id}`, quantity: 3, unit: 'm³', at: `2026-11-18T${hourUtc}:00Z`, status: ok, pictures });
  const timed: ServiceDetail = {
    ...detailWith([]),
    dispatches: [sent('late', '15:00', [photo(1)]), sent('early', '12:30')] as ServiceDetail['dispatches'],
  };

  it('tapping anywhere on a dispatch row opens its sheet (where its media grid lives)', () => {
    // Arrange
    const onOpenDispatch = vi.fn();
    render(<ServiceListWeb detail={timed} tab="orders" onOpen={() => undefined} onOpenDispatch={onOpenDispatch} onOpenFile={vi.fn()} />);
    // Act
    fireEvent.click(screen.getByTestId('despacho-early'));
    // Assert
    expect(onOpenDispatch).toHaveBeenCalledWith('early');
  });

  it('lists the dispatches by hour and sums them against the order with a progress bar', () => {
    // Arrange / Act
    render(<ServiceListWeb detail={timed} tab="orders" onOpen={() => undefined} onOpenDispatch={() => undefined} onOpenFile={vi.fn()} />);
    // Assert
    expect(screen.getAllByTestId(/^despacho-(early|late)$/).map((row) => row.dataset.testid)).toEqual(['despacho-early', 'despacho-late']);
    expect(screen.getByTestId('resumen-o1')).toHaveTextContent('2 despachos');
    expect(screen.getByTestId('resumen-o1')).toHaveTextContent('6 / 12 m³');
    expect(screen.getByTestId('resumen-o1')).toHaveTextContent('1 medio');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
  });

  it('an order without dispatches says so, with no summary nor bar', () => {
    // Arrange / Act
    render(<ServiceListWeb detail={{ ...timed, dispatches: [] }} tab="orders" onOpen={() => undefined} onOpenDispatch={() => undefined} onOpenFile={vi.fn()} />);
    // Assert
    expect(screen.getByTestId('fila-o1')).toHaveTextContent('Sin despachos todavía');
    expect(screen.queryByTestId('resumen-o1')).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});
