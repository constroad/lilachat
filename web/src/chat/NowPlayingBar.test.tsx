import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NowPlayingBar } from './NowPlayingBar';
import { playVoiceNote, resetVoicePlayerForTests } from './voicePlayer';

class FakeAudio {
  currentTime = 0;
  duration = 72;
  playbackRate = 1;
  paused = true;
  src = '';
  listeners = new Map<string, () => void>();
  addEventListener(type: string, listener: () => void) {
    this.listeners.set(type, listener);
  }
  play() {
    this.paused = false;
    this.listeners.get('play')?.();
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
    this.listeners.get('pause')?.();
  }
}

beforeEach(() => {
  vi.stubGlobal('Audio', FakeAudio);
  resetVoicePlayerForTests();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Backlog 34 (José, 21/10; design `a-02-audio-en-curso`): the bar on top of the list while a note plays elsewhere. */
describe('now playing bar (web)', () => {
  it('shows outside the note\'s chat with who and how far; it pauses, changes speed, opens the chat and closes', async () => {
    const onOpen = vi.fn();
    const { rerender } = render(<NowPlayingBar openChatId="c1" onOpen={onOpen} />);
    await act(async () => playVoiceNote({ id: 'c1:5', chatId: 'c1', url: '/a.m4a', authorName: 'Ana Torres', durationS: 72, rate: 1, startShare: null }));
    expect(screen.queryByTestId('barra-audio-en-curso')).toBeNull();
    rerender(<NowPlayingBar openChatId="c2" onOpen={onOpen} />);
    expect(screen.getByTestId('barra-audio-en-curso').textContent).toContain('Ana Torres');
    expect(screen.getByTestId('barra-audio-en-curso').textContent).toContain('Nota de voz · 0:00 de 1:12');
    fireEvent.click(screen.getByTestId('barra-audio-velocidad'));
    expect(screen.getByTestId('barra-audio-velocidad').textContent).toBe('1,5×');
    fireEvent.click(screen.getByTestId('barra-audio-pausa'));
    expect(screen.getByRole('button', { name: 'Reproducir' })).toBeTruthy();
    fireEvent.click(screen.getByTestId('barra-audio-abrir'));
    expect(onOpen).toHaveBeenCalledWith('c1');
    fireEvent.click(screen.getByTestId('barra-audio-cerrar'));
    expect(screen.queryByTestId('barra-audio-en-curso')).toBeNull();
  });
});
