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
  defaultPlaybackRate = 1;
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
  removeEventListener(type: string, listener: () => void) {
    if (this.listeners.get(type) === listener) this.listeners.delete(type);
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

  it('the speed goes 1× → 1,5× → 2× → 3× → 1×, also on an audio whose length nobody said (José 27/11, a bot\'s audio)', async () => {
    const { durationMs: _unknown, ...withoutLength } = note(1);
    render(<NotaDeVoz {...withoutLength} />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Reproducir' })));
    const chip = screen.getByTestId('velocidad-voz');
    const seen: [string, number][] = [];
    for (let step = 0; step < 4; step += 1) {
      fireEvent.click(chip);
      seen.push([chip.textContent ?? '', session().playbackRate]);
    }
    expect(seen).toEqual([['1,5×', 1.5], ['2×', 2], ['3×', 3], ['1×', 1]]);
  });

  it('a speed chosen before playing holds when the source loads, even if the browser put it back', async () => {
    render(<NotaDeVoz {...note(1)} />);
    fireEvent.click(screen.getByTestId('velocidad-voz'));
    fireEvent.click(screen.getByTestId('velocidad-voz'));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Reproducir' })));
    session().playbackRate = 1;
    act(() => session().emit('loadedmetadata'));
    expect(session().playbackRate).toBe(2);
    expect(session().defaultPlaybackRate).toBe(2);
  });

  it('without a length in the message it shows the file\'s own, read from its metadata, not 0:00 (José 27/11)', () => {
    const { durationMs: _unknown, ...withoutLength } = note(1);
    render(<NotaDeVoz {...withoutLength} />);
    expect(screen.getByTestId('nota-de-voz')).toHaveTextContent('0:00');
    const ahead = FakeAudio.all[0]!;
    ahead.duration = 12.4;
    act(() => ahead.emit('durationchange'));
    expect(screen.getByTestId('nota-de-voz')).toHaveTextContent('0:12');
    expect(screen.getByTestId('barra-voz').children.length).toBeGreaterThan(0);
  });

  it('an unknown length (Infinity, a stream) is not shown as a length', () => {
    const { durationMs: _unknown, ...withoutLength } = note(1);
    render(<NotaDeVoz {...withoutLength} />);
    const ahead = FakeAudio.all[0]!;
    ahead.duration = Number.POSITIVE_INFINITY;
    act(() => ahead.emit('loadedmetadata'));
    expect(screen.getByTestId('nota-de-voz')).toHaveTextContent('0:00');
  });

  it('leaving the chat does not cut it', async () => {
    const { unmount } = render(<NotaDeVoz {...note(1)} />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Reproducir' })));
    unmount();
    expect(session().paused).toBe(false);
  });
});
