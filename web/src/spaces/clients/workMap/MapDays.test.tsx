import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, renderHook, act, screen } from '@testing-library/react';
import { MapDayChips, useMapDays } from './MapDays';

afterEach(cleanup);

const photo = (id: string, at: string) => ({ id, at, lat: -12, lng: -77, kind: 'photo' as const, url: `https://lila.constroad.com/${id}.jpg`, thumbnailUrl: `https://lila.constroad.com/${id}-t.jpg` });
const photos = [photo('a', '2026-11-07T15:00:00.000Z'), photo('b', '2026-11-08T15:00:00.000Z')];

/** «Todos» or one day of placement (José 09/11, Globofast). */
describe('the day of the map', () => {
  it('shows a chip per day and picks one', () => {
    // Arrange
    const { result } = renderHook(() => useMapDays(photos, []));
    // Act
    act(() => result.current.setDay('2026-11-07'));
    // Assert
    expect(result.current.photos.map((one) => one.id)).toEqual(['a']);
    expect(result.current.options.map((one) => one.label)).toEqual(['Todos', expect.stringContaining('08/11'), expect.stringContaining('07/11')]);
  });

  it('a tap on a chip says which day', () => {
    // Arrange
    const picked: string[] = [];
    render(<MapDayChips options={[{ key: 'all', label: 'Todos' }, { key: '2026-11-08', label: 'Dom 08/11', color: '#2563eb' }]} day="all" onDay={(day) => picked.push(day)} />);
    // Act
    fireEvent.click(screen.getByTestId('mapa-dia-2026-11-08'));
    // Assert
    expect(picked).toEqual(['2026-11-08']);
    expect(screen.getByTestId('mapa-dia-all').getAttribute('aria-pressed')).toBe('true');
  });

  it('draws nothing with a single day', () => {
    const { container } = render(<MapDayChips options={[]} day="all" onDay={() => undefined} />);
    expect(container.innerHTML).toBe('');
  });
});
