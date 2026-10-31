import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExportChatRow } from './ExportChatRow';

/** «Exportar chat» in the chat info (R31/10-B7). */
describe('ExportChatRow', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks the server for the text in my zone and saves it with the server name', async () => {
    // Arrange
    const fetchMock = vi.fn(async () => new Response('hola\n', { status: 200, headers: { 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('Chat de Lilachat con Beto.txt')}` } }));
    vi.stubGlobal('fetch', fetchMock);
    const saved: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      saved.push(this.download);
    });
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    render(<ExportChatRow chatId="c1" jwt="t" onNotice={vi.fn()} />);
    // Act
    fireEvent.click(screen.getByTestId('btn-exportar-chat'));
    // Assert
    await waitFor(() => expect(saved).toEqual(['Chat de Lilachat con Beto.txt']));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/chats\/c1\/export\?tz=/), { headers: { Authorization: 'Bearer t' } });
  });

  it('a refusal says the server reason', async () => {
    // Arrange
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'Los chats secretos no se pueden exportar.' }), { status: 409 })));
    const onNotice = vi.fn();
    render(<ExportChatRow chatId="c1" jwt="t" onNotice={onNotice} />);
    // Act
    fireEvent.click(screen.getByTestId('btn-exportar-chat'));
    // Assert
    await waitFor(() => expect(onNotice).toHaveBeenCalledWith('Los chats secretos no se pueden exportar.'));
  });
});
