import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { AgendaReminder } from '@lilachat/shared';
import { api } from '../../api';
import { RemindersCard } from './RemindersCard';

vi.mock('../../api', () => ({ api: vi.fn() }));

const CHAT_ID = '6739f0c2a1b2c3d4e5f60718';
const reminderOf = (overrides: Partial<AgendaReminder> = {}): AgendaReminder =>
  ({ _id: '6739f0c2a1b2c3d4e5f60799', title: 'Insistir con Alonso', startsAt: '2099-01-02T14:00:00.000Z', recurrence: 'none', active: true, ...overrides }) as AgendaReminder;
const answer = (reminders: AgendaReminder[]) => vi.mocked(api).mockResolvedValue({ ok: true, status: 200, data: { reminders } } as Awaited<ReturnType<typeof api>>);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** José 27/11: «cuando veo el detalle del canal no veo los recordatorios que agregué en ese canal». */
describe('RemindersCard (the reminders of a chat, in its info)', () => {
  it('lists the chat\'s reminders from its own route', async () => {
    // Arrange
    answer([reminderOf()]);
    // Act
    render(<RemindersCard chatId={CHAT_ID} jwt="jwt" />);
    // Assert
    expect(await screen.findByText('Insistir con Alonso')).toBeTruthy();
    expect(api).toHaveBeenCalledWith(`/agenda/reminders/del-chat/${CHAT_ID}`, { method: 'GET', jwt: 'jwt' });
    expect(screen.getByTestId('tarjeta-recordatorios').textContent).toContain('1');
  });

  it('whoever can manage them opens one to edit it', async () => {
    answer([reminderOf()]);
    const onEdit = vi.fn();
    render(<RemindersCard chatId={CHAT_ID} jwt="jwt" onEdit={onEdit} />);
    fireEvent.click(await screen.findByTestId('recordatorio-del-chat-6739f0c2a1b2c3d4e5f60799'));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ title: 'Insistir con Alonso' }));
  });

  it('a member who cannot manage them only reads them', async () => {
    answer([reminderOf()]);
    render(<RemindersCard chatId={CHAT_ID} jwt="jwt" />);
    expect((await screen.findByTestId('recordatorio-del-chat-6739f0c2a1b2c3d4e5f60799')).hasAttribute('disabled')).toBe(true);
  });

  it('without reminders the card does not show', async () => {
    answer([]);
    render(<RemindersCard chatId={CHAT_ID} jwt="jwt" />);
    await vi.waitFor(() => expect(api).toHaveBeenCalled());
    expect(screen.queryByTestId('tarjeta-recordatorios')).toBeNull();
  });

  it('a failed read says so instead of an empty card', async () => {
    vi.mocked(api).mockResolvedValue({ ok: false, status: 500, message: 'x' } as Awaited<ReturnType<typeof api>>);
    render(<RemindersCard chatId={CHAT_ID} jwt="jwt" />);
    expect(await screen.findByText('No se pudieron cargar los recordatorios.')).toBeTruthy();
  });
});
