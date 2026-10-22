import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotaDeVoz } from './NotaDeVoz';
import { resetVoicePlayerForTests } from './voicePlayer';

/** A fake <audio>: what the note asks of the browser, without sound. */
class FakeAudio {
  static all: FakeAudio[] = [];
  currentTime = 0;
  duration = 20;
  playbackRate = 1;
  paused = true;
  preload = '';
  src: string;
  listeners = new Map<string, () => void>();
  constructor(src?: string) {
    this.src = src ?? '';
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
  resetVoicePlayerForTests();
});
afterEach(() => vi.unstubAllGlobals());

const note = (seq: number, url = '/a.m4a') => ({ id: `c1:${seq}`, chatId: 'c1', authorName: 'Ana', url, durationMs: 20_000, mio: false });
/** The session's <audio>: created without a source; the others only fetch ahead. */
const session = () => FakeAudio.all.find((audio) => !audio.preload)!;

/** Backlog 34 (José, 21/10): like WhatsApp — one tap plays, the bar seeks, 1× · 1,5× · 2×, one at a time, and it keeps playing outside the chat. */
describe('a voice note on the web', () => {
  it('the note is fetched ahead as soon as it shows, so a tap plays at once (José, 21/10)', () => {
    render(<NotaDeVoz {...note(1, 'https://x/n.m4a')} durationMs={4000} />);
    expect(FakeAudio.all).toHaveLength(1);
    expect(FakeAudio.all[0]!.preload).toBe('auto');
    expect(FakeAudio.all[0]!.paused).toBe(true);
  });

  it('one tap plays through the session\'s player; the speed goes 1× → 1,5× and the audio follows it', async () => {
    render(<NotaDeVoz {...note(1)} />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Reproducir' })));
    expect(session().src).toBe('/a.m4a');
    expect(session().paused).toBe(false);
    expect(screen.getByRole('button', { name: 'Pausar' })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('velocidad-voz'));
    expect(screen.getByTestId('velocidad-voz')).toHaveTextContent('1,5×');
    expect(session().playbackRate).toBe(1.5);
  });

  it('clicking the bar jumps to that point, even before playing', async () => {
    render(<NotaDeVoz {...note(1)} />);
    const bar = screen.getByTestId('barra-voz');
    vi.spyOn(bar, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 200, top: 0, height: 20, right: 200, bottom: 20, x: 0, y: 0, toJSON: () => ({}) });
    await act(async () => {
      fireEvent.pointerDown(bar, { clientX: 100, pointerId: 1 });
      fireEvent.pointerUp(bar, { clientX: 100, pointerId: 1 });
    });
    expect(session().currentTime).toBe(10);
  });

  it('a second note takes the player: the first one goes back to its play button', async () => {
    render(
      <>
        <NotaDeVoz {...note(1)} />
        <NotaDeVoz {...note(2, '/b.m4a')} />
      </>
    );
    const [first, second] = screen.getAllByRole('button', { name: 'Reproducir' });
    await act(async () => fireEvent.click(first!));
    await act(async () => fireEvent.click(second!));
    expect(session().src).toBe('/b.m4a');
    expect(screen.getAllByRole('button', { name: 'Reproducir' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Pausar' })).toHaveLength(1);
  });

  it('leaving the chat does not cut it', async () => {
    const { unmount } = render(<NotaDeVoz {...note(1)} />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Reproducir' })));
    unmount();
    expect(session().paused).toBe(false);
  });
});
