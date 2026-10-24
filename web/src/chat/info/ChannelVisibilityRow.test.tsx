import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChannelVisibilityRow } from './ChannelVisibilityRow';

/** «Canal privado» (pending 93): only the channel's admins, never #general. */
afterEach(() => vi.unstubAllGlobals());

describe('ChannelVisibilityRow', () => {
  it('an admin makes the channel private with one switch', async () => {
    // Arrange
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, visibility: 'private' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<ChannelVisibilityRow chatId="c1" jwt="jwt" isPrivate={false} isAdmin isGeneral={false} onAviso={() => undefined} />);
    // Act
    fireEvent.click(screen.getByTestId('interruptor-canal-privado'));
    // Assert
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/chats/c1', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ visibility: 'private' }) })));
    expect(screen.getByTestId('interruptor-canal-privado')).toBeChecked();
    expect(screen.getByText(/Solo lo ven sus miembros/)).toBeInTheDocument();
  });

  it('a refusal puts it back and says why', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'Solo los admins del canal cambian quién lo encuentra.' }), { status: 400 })));
    const onAviso = vi.fn();
    render(<ChannelVisibilityRow chatId="c1" jwt="jwt" isPrivate={false} isAdmin isGeneral={false} onAviso={onAviso} />);
    fireEvent.click(screen.getByTestId('interruptor-canal-privado'));
    await vi.waitFor(() => expect(onAviso).toHaveBeenCalledWith('Solo los admins del canal cambian quién lo encuentra.'));
    expect(screen.getByTestId('interruptor-canal-privado')).not.toBeChecked();
  });

  it('a member, or #general, cannot move it', () => {
    const { unmount } = render(<ChannelVisibilityRow chatId="c1" jwt="jwt" isPrivate={false} isAdmin={false} isGeneral={false} onAviso={() => undefined} />);
    expect(screen.getByTestId('interruptor-canal-privado')).toBeDisabled();
    unmount();
    render(<ChannelVisibilityRow chatId="g" jwt="jwt" isPrivate={false} isAdmin isGeneral onAviso={() => undefined} />);
    expect(screen.getByTestId('interruptor-canal-privado')).toBeDisabled();
    expect(screen.getByText(/siempre es público/)).toBeInTheDocument();
  });
});
