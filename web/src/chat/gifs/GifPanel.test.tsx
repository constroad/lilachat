import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GifPanel } from './GifPanel';
import { GifInBubble } from './GifInBubble';

const gif = (id: string) => ({ id, title: `GIF ${id}`, previewUrl: `https://media.giphy.com/media/${id}/100w.webp`, width: 200, height: 150 });
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Backlog 37 (José, 21/10; design `g-01-panel-gif-giphy`): GIPHY in the panel, through the server. */
describe('GIF panel (web)', () => {
  it('shows trending, searches from a chip, sends the one clicked, and says «Powered by GIPHY»', async () => {
    const calls: { url: string; body?: unknown }[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      return url.includes('/gifs/send') ? json({ message: {} }) : json({ gifs: url.includes('q=Gracias') ? [gif('g2')] : [gif('g1')] });
    });
    render(<GifPanel jwt="jwt" chatId="chat1" />);
    await screen.findByTestId('gif-g1');
    expect(calls[0]?.url).toContain('/api/gifs/search?q=&offset=0');
    expect(screen.getByText('Powered by GIPHY')).toBeTruthy();
    fireEvent.click(screen.getByTestId('chip-gif-Gracias'));
    await screen.findByTestId('gif-g2');
    fireEvent.click(screen.getByTestId('gif-g2'));
    await waitFor(() => expect(calls.find((call) => call.url.endsWith('/api/gifs/send'))?.body).toMatchObject({ chatId: 'chat1', gifId: 'g2' }));
  });

  it('GIPHY not answering is said, not an empty grid', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 503 }));
    render(<GifPanel jwt="jwt" chatId="chat1" />);
    expect(await screen.findByText('GIPHY no respondió. Inténtalo de nuevo.')).toBeTruthy();
  });
});

/** José 27/11 (design sa-04): a sticker with sound from the GIF tab, without sending the GIF first. */
describe('«Sticker con sonido» on a GIF', () => {
  it('hands the GIF to the editor and sends nothing', async () => {
    // Arrange
    const calls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => (calls.push(String(input)), json({ gifs: [gif('g1')] })));
    const onSoundSticker = vi.fn();
    render(<GifPanel jwt="jwt" chatId="chat1" onSoundSticker={onSoundSticker} />);
    // Act
    fireEvent.click(await screen.findByTestId('sticker-sonido-g1'));
    // Assert
    expect(onSoundSticker).toHaveBeenCalledWith(expect.objectContaining({ id: 'g1' }));
    expect(calls.some((url) => url.endsWith('/api/gifs/send'))).toBe(false);
  });

  it('without the editor (a thread that cannot take it) there is no button', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ gifs: [gif('g1')] }));
    render(<GifPanel jwt="jwt" chatId="chat1" />);
    await screen.findByTestId('gif-g1');
    expect(screen.queryByTestId('sticker-sonido-g1')).toBeNull();
  });
});

describe('GIF in the bubble (web)', () => {
  it('moves with its «GIF» mark, and a click while it moves opens the viewer', () => {
    const onOpen = vi.fn();
    render(<GifInBubble testId="gif-1" url="/media/a.gif" alt="GIF" onOpen={onOpen} />);
    expect(screen.getByText('GIF')).toBeTruthy();
    fireEvent.click(screen.getByTestId('gif-1'));
    expect(onOpen).toHaveBeenCalled();
  });
});
