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
    render(<DaliChats directs={[general, direct]} whatsappGroups={[]} yo={ME} selectedChatId={null} onOpenChat={onOpenChat} onChatAction={vi.fn()} />);
    expect(screen.getByText('general')).toBeTruthy();
    fireEvent.click(screen.getByText('Rosa Quispe'));
    expect(onOpenChat).toHaveBeenCalledWith(direct);
  });

  it('says there are no direct chats instead of an empty list', () => {
    render(<DaliChats directs={[]} whatsappGroups={[]} yo={ME} selectedChatId={null} onOpenChat={vi.fn()} onChatAction={vi.fn()} />);
    expect(screen.getByText('No hay chats directos.')).toBeTruthy();
  });

  it('a company with no WhatsApp group sees no section header at all (fase 1 does not change today\'s look)', () => {
    render(<DaliChats directs={[chatOf({ id: 'chat-general', name: 'general' })]} whatsappGroups={[]} yo={ME} selectedChatId={null} onOpenChat={vi.fn()} onChatAction={vi.fn()} />);
    expect(screen.queryByText('Mensajes directos')).toBeNull();
    expect(screen.queryByText('Grupos de WhatsApp')).toBeNull();
  });

  it('WhatsApp groups (fase 1, agentes 20/11) show under their own section, apart from direct chats', () => {
    const direct = chatOf({ id: 'chat-rosa', name: 'Rosa Quispe' });
    const group = chatOf({ id: 'chat-obra', name: 'Obra Lomas' });
    const onOpenChat = vi.fn();
    render(<DaliChats directs={[direct]} whatsappGroups={[group]} yo={ME} selectedChatId={null} onOpenChat={onOpenChat} onChatAction={vi.fn()} />);
    expect(screen.getByText('Mensajes directos')).toBeTruthy();
    expect(screen.getByText('Grupos de WhatsApp')).toBeTruthy();
    fireEvent.click(screen.getByText('Obra Lomas'));
    expect(onOpenChat).toHaveBeenCalledWith(group);
  });
});
