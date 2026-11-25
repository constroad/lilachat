import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ZoomColumn, useZoomSlider } from './WebZoom';

type Lens = { range: { min: number; max: number } | null; zoom: number; setZoom: (ratio: number) => void };

function Harness(props: { lens: Lens }) {
  const slider = useZoomSlider();
  return <ZoomColumn lens={props.lens} slider={slider} />;
}

// José 25/11: «como la cámara de Samsung: .6, 1, 2, 3, 5, 10 y un slider».
describe('the web camera zoom', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('offers only the chips this lens reaches', () => {
    render(<Harness lens={{ range: { min: 1, max: 10 }, zoom: 1, setZoom: vi.fn() }} />);
    expect(screen.getAllByRole('button').map((chip) => chip.textContent)).toEqual(['1x', '2x', '3x', '5x', '10x']);
  });

  it('a browser without zoom shows nothing (iPhone Safari)', () => {
    const { container } = render(<Harness lens={{ range: null, zoom: 1, setZoom: vi.fn() }} />);
    expect(container.innerHTML).toBe('');
  });

  it('a chip sets its ratio', () => {
    const setZoom = vi.fn();
    render(<Harness lens={{ range: { min: 1, max: 10 }, zoom: 1, setZoom }} />);
    fireEvent.click(screen.getByTestId('zoom-5x'));
    expect(setZoom).toHaveBeenCalledWith(5);
  });

  it('a long press opens the slider, which moves the zoom and hides 2 s after the last touch', () => {
    const setZoom = vi.fn();
    render(<Harness lens={{ range: { min: 1, max: 100 }, zoom: 1, setZoom }} />);
    fireEvent.pointerDown(screen.getByTestId('zoom-2x'));
    act(() => void vi.advanceTimersByTime(400));
    const slider = screen.getByTestId('zoom-slider');
    fireEvent.change(slider, { target: { value: '500' } });
    expect(setZoom).toHaveBeenLastCalledWith(expect.closeTo(10, 5));
    act(() => void vi.advanceTimersByTime(2100));
    expect(screen.queryByTestId('zoom-slider')).toBeNull();
  });
});
