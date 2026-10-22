import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotaDeVoz } from './NotaDeVoz';

/** A fake <audio>: what the note asks of the browser, without sound. */
class FakeAudio {
  static all: FakeAudio[] = [];
  currentTime = 0;
  duration = 20;
  playbackRate = 1;
  paused = true;
  preload = '';
  listeners = new Map<string, () => void>();
  constructor(public src: string) {
    FakeAudio.all.push(this);
  }
  addEventListener(type: string, listener: () => void) {
    this.listeners.set(type, listener);
  }
  emit(type: string) {
    this.listeners.get(type)?.();
  }
  play() {
    this.paused = false;
    this.emit('play');
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
    this.emit('pause');
  }
}

// jsdom has no PointerEvent: without it the event carries no `clientX`.
if (!('PointerEvent' in window)) Object.assign(window, { PointerEvent: MouseEvent });

beforeEach(() => {
  FakeAudio.all = [];
  vi.stubGlobal('Audio', FakeAudio);
});
afterEach(() => vi.unstubAllGlobals());

/** Backlog 34 (José, 21/10): like WhatsApp — one tap plays, the bar seeks, 1× · 1,5× · 2×, one at a time. */
describe('a voice note on the web', () => {
  it('the note is fetched ahead as soon as it shows, so a tap plays at once (José, 21/10)', () => {
    render(<NotaDeVoz url="https://x/n.m4a" durationMs={4000} mio={false} />);
    expect(FakeAudio.all).toHaveLength(1);
    expect(FakeAudio.all[0]!.preload).toBe('auto');
    expect(FakeAudio.all[0]!.paused).toBe(true);
  });

  it('one tap plays; the speed goes 1× → 1,5× and the audio follows it', async () => {
    render(<NotaDeVoz url="/a.m4a" durationMs={20_000} mio={false} />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Reproducir' })));
    expect(FakeAudio.all[0]!.paused).toBe(false);
    expect(screen.getByRole('button', { name: 'Pausar' })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('velocidad-voz'));
    expect(screen.getByTestId('velocidad-voz')).toHaveTextContent('1,5×');
    expect(FakeAudio.all[0]!.playbackRate).toBe(1.5);
  });

  it('clicking the bar jumps to that point, even before playing', async () => {
    render(<NotaDeVoz url="/a.m4a" durationMs={20_000} mio={false} />);
    const bar = screen.getByTestId('barra-voz');
    vi.spyOn(bar, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 200, top: 0, height: 20, right: 200, bottom: 20, x: 0, y: 0, toJSON: () => ({}) });
    await act(async () => {
      fireEvent.pointerDown(bar, { clientX: 100, pointerId: 1 });
      fireEvent.pointerUp(bar, { clientX: 100, pointerId: 1 });
    });
    expect(FakeAudio.all[0]!.currentTime).toBe(10);
  });

  it('a second note playing pauses the first', async () => {
    render(
      <>
        <NotaDeVoz url="/a.m4a" durationMs={20_000} mio={false} />
        <NotaDeVoz url="/b.m4a" durationMs={20_000} mio={false} />
      </>
    );
    const [first, second] = screen.getAllByRole('button', { name: 'Reproducir' });
    await act(async () => fireEvent.click(first!));
    await act(async () => fireEvent.click(second!));
    expect(FakeAudio.all[0]!.paused).toBe(true);
    expect(FakeAudio.all[1]!.paused).toBe(false);
  });
});
