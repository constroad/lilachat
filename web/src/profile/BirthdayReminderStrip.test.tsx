import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { birthdayReminderKey, type MyProfile } from '@lilachat/shared';
import { BirthdayReminderStrip } from './BirthdayReminderStrip';
import { forgetBirthdayReminderCache } from './useBirthdayReminder';

const invited: MyProfile = { name: 'Medaly', phone: 'mail:abc', avatarUrl: null, email: 'medaly@example.com', emailVerified: true, birthday: null, birthdayVisible: true, missing: [], birthdayMissing: true };
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  localStorage.clear();
  forgetBirthdayReminderCache();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** José, 14/11: the people invited by email never wrote their birthday; the chat list reminds them. */
describe('birthday reminder strip (web)', () => {
  it('shows while the server says the birthday is missing', async () => {
    // Arrange
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ profile: invited }));
    // Act
    render(<BirthdayReminderStrip jwt="jwt" userId="u1" />);
    // Assert
    expect(await screen.findByText('Agrega tu cumpleaños')).toBeTruthy();
  });

  it('says nothing once the birthday is set, or when the server does not answer', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json({ profile: { ...invited, birthday: { day: 3, month: 5 }, birthdayMissing: false } }));
    render(<BirthdayReminderStrip jwt="jwt" userId="u1" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByTestId('franja-cumpleanos')).toBeNull();
    cleanup();
    forgetBirthdayReminderCache();
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 503 }));
    render(<BirthdayReminderStrip jwt="jwt" userId="u1" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId('franja-cumpleanos')).toBeNull();
  });

  it('«Ahora no» hides it and remembers it on this device; a snoozed one does not even ask', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ profile: invited }));
    render(<BirthdayReminderStrip jwt="jwt" userId="u1" />);
    fireEvent.click(await screen.findByTestId('btn-cumpleanos-ahora-no'));
    expect(screen.queryByTestId('franja-cumpleanos')).toBeNull();
    expect(Number(localStorage.getItem(birthdayReminderKey('u1')))).toBeGreaterThan(0);
    cleanup();
    forgetBirthdayReminderCache();
    fetchMock.mockClear();
    render(<BirthdayReminderStrip jwt="jwt" userId="u1" />);
    expect(screen.queryByTestId('franja-cumpleanos')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('«Agregar» opens the profile with the birthday boxes, and saving it makes the strip go away', async () => {
    const calls: { url: string; body?: unknown }[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      calls.push({ url: String(input), body: init?.body ? JSON.parse(String(init.body)) : undefined });
      return json({ profile: init?.method === 'PUT' ? { ...invited, birthday: { day: 3, month: 5 }, birthdayMissing: false } : invited });
    });
    render(<BirthdayReminderStrip jwt="jwt" userId="u1" />);
    fireEvent.click(await screen.findByTestId('btn-cumpleanos-agregar'));
    expect(screen.getByTestId('pantalla-completa-perfil')).toBeTruthy();
    fireEvent.change(screen.getByTestId('perfil-dia'), { target: { value: '3' } });
    fireEvent.change(screen.getByTestId('perfil-mes'), { target: { value: '5' } });
    fireEvent.click(screen.getByTestId('perfil-continuar'));
    await waitFor(() => expect(screen.queryByTestId('pantalla-completa-perfil')).toBeNull());
    expect(screen.queryByTestId('franja-cumpleanos')).toBeNull();
    expect(calls.find((call) => call.body)?.body).toEqual({ name: 'Medaly', birthday: { day: 3, month: 5 } });
  });

  it('closing the profile without saving keeps the reminder', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ profile: invited }));
    render(<BirthdayReminderStrip jwt="jwt" userId="u1" />);
    fireEvent.click(await screen.findByTestId('btn-cumpleanos-agregar'));
    fireEvent.click(screen.getByTestId('perfil-cerrar'));
    expect(screen.queryByTestId('pantalla-completa-perfil')).toBeNull();
    expect(screen.getByTestId('franja-cumpleanos')).toBeTruthy();
  });
});
