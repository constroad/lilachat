import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DaliChats } from './DaliChats';
import { chatOf, ME } from './daliTestData';

afterEach(cleanup);

describe('DaliChats (José 20/11, via Agentes)', () => {
  it('lists the direct chats and opens the one tapped', () => {
    const onOpenChat = vi.fn();
    const general = chatOf({ id: 'chat-general', name: 'general' });
    const direct = chatOf({ id: 'chat-rosa', name: 'Rosa Quispe' });
    render(<DaliChats chats={[general, direct]} yo={ME} selectedChatId={null} onOpenChat={onOpenChat} onChatAction={vi.fn()} />);
    expect(screen.getByText('general')).toBeTruthy();
    fireEvent.click(screen.getByText('Rosa Quispe'));
    expect(onOpenChat).toHaveBeenCalledWith(direct);
  });

  it('says there are no direct chats instead of an empty list', () => {
    render(<DaliChats chats={[]} yo={ME} selectedChatId={null} onOpenChat={vi.fn()} onChatAction={vi.fn()} />);
    expect(screen.getByText('No hay chats directos.')).toBeTruthy();
  });
});
