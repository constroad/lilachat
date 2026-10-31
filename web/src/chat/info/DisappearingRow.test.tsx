import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DisappearingRow } from './DisappearingRow';

afterEach(() => vi.unstubAllGlobals());

describe('«Mensajes temporales» on the web (R31/10-B6)', () => {
  it('shows the chat timer and saves a new one for everyone', async () => {
    // Arrange
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, key: '24h' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<DisappearingRow chatId="c1" jwt="t" seconds={604_800} canChange onAviso={vi.fn()} />);
    // Act
    fireEvent.change(screen.getByTestId('select-temporales'), { target: { value: '24h' } });
    // Assert
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith('/api/chats/c1/disappearing', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ key: '24h' }) }));
    expect(screen.getByTestId('fila-temporales')).toHaveTextContent('Los nuevos desaparecen después de 24 horas.');
  });

  it('a refusal goes back and says why', async () => {
    // Arrange
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'Solo los admins pueden cambiar la info del grupo.' }), { status: 403 })));
    const onNotice = vi.fn();
    render(<DisappearingRow chatId="c1" jwt="t" seconds={0} canChange onAviso={onNotice} />);
    // Act
    fireEvent.change(screen.getByTestId('select-temporales'), { target: { value: '7d' } });
    // Assert
    await waitFor(() => expect(onNotice).toHaveBeenCalledWith('Solo los admins pueden cambiar la info del grupo.'));
    expect(screen.getByTestId('select-temporales')).toHaveValue('off');
  });

  it('a member who may not edit the group sees it locked', () => {
    render(<DisappearingRow chatId="c1" jwt="t" seconds={86_400} canChange={false} onAviso={vi.fn()} />);
    expect(screen.getByTestId('select-temporales')).toBeDisabled();
    expect(screen.getByTestId('fila-temporales')).toHaveTextContent('Solo quien edita la info del grupo lo cambia.');
  });
});
