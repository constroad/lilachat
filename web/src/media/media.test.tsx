import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MediaDialog } from './MediaDialog';

/** «Medios» on the web (pending 38): by tab and month; a click opens the chat at that message. */
let urls: string[] = [];
beforeEach(() => {
  urls = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    urls.push(url);
    const type = new URL(url, 'http://x').searchParams.get('type');
    const items = type === 'files'
      ? [{ chatId: 'c1', seq: 4, at: new Date().toISOString(), senderId: 'u2', kind: 'file', chat: { kind: 'group', name: 'Obra' }, media: { url: 'https://x/f.pdf', fileName: 'Informe.pdf', sizeBytes: 2048 } }]
      : [{ chatId: 'c1', seq: 2, at: new Date().toISOString(), senderId: 'u2', kind: 'image', chat: { kind: 'direct', phone: '987654321' }, media: { url: 'https://x/b.jpg', thumbUrl: 'https://x/b-t.jpg' } }];
    return new Response(JSON.stringify({ items, hasMore: false }), { status: 200 });
  }));
});

describe('MediaDialog', () => {
  it('photos of the personal chats first; documents in their tab; a click opens the message', async () => {
    const onOpen = vi.fn();
    render(<MediaDialog jwt="t" spaceId={null} chatName={(item) => item.chat.name ?? item.chat.phone ?? ''} onOpen={onOpen} onClose={() => undefined} />);
    expect(await screen.findByTestId('medio-c1-2')).toBeInTheDocument();
    expect(urls[0]).toContain('/api/media/library?type=photos');
    expect(urls[0]).not.toContain('workspace=');
    expect(screen.getByText('Este mes')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('medios-files'));
    expect(await screen.findByText('Informe.pdf')).toBeInTheDocument();
    expect(screen.getByTestId('medio-c1-4')).toHaveTextContent('Obra · 2.0 KB');
    await userEvent.click(screen.getByTestId('medio-c1-4'));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ chatId: 'c1', seq: 4 }));
  });

  it('inside a space, only that space', async () => {
    render(<MediaDialog jwt="t" spaceId="w1" spaceName="QA Obra" chatName={() => ''} onOpen={() => undefined} onClose={() => undefined} />);
    await waitFor(() => expect(urls[0]).toContain('workspace=w1'));
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Medios de QA Obra');
  });
});
