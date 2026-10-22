import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { MyProfile } from '@lilachat/shared';
import { CompleteProfileScreen } from './CompleteProfileScreen';

const base: MyProfile = { name: 'Ana', phone: '987654321', avatarUrl: null, email: null, emailVerified: false, birthday: null, birthdayVisible: true, missing: ['birthday', 'email'] };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** «Completa tu perfil» on the web (José, 21/10; backlog 17). */
describe('complete profile (web)', () => {
  it('proves the email with a code, saves name and birthday, and lets the person in', async () => {
    const calls: { url: string; body?: unknown }[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (url.endsWith('/email/code')) return json(200, { sent: true });
      if (url.endsWith('/email/verify')) return json(200, { profile: { ...base, email: 'ana@example.com', emailVerified: true, missing: ['birthday'] } });
      return json(200, { profile: { ...base, email: 'ana@example.com', emailVerified: true, birthday: { day: 29, month: 8 }, missing: [] } });
    });
    const onDone = vi.fn();
    render(<CompleteProfileScreen jwt="jwt" profile={base} onDone={onDone} />);
    expect((screen.getByTestId('perfil-continuar') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByTestId('perfil-dia'), { target: { value: '29' } });
    fireEvent.change(screen.getByTestId('perfil-mes'), { target: { value: '8' } });
    fireEvent.change(screen.getByTestId('perfil-correo'), { target: { value: 'Ana@Example.com' } });
    fireEvent.click(screen.getByTestId('perfil-enviar-codigo'));
    fireEvent.change(await screen.findByTestId('perfil-codigo'), { target: { value: '123456' } });
    fireEvent.click(screen.getByTestId('perfil-verificar'));
    await screen.findByTestId('perfil-correo-ok');
    fireEvent.click(screen.getByTestId('perfil-continuar'));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(calls.find((call) => call.url.endsWith('/email/code'))?.body).toEqual({ email: 'ana@example.com' });
    expect(calls.find((call) => call.url.endsWith('/me/profile'))?.body).toEqual({ name: 'Ana', birthday: { day: 29, month: 8 }, birthdayVisible: true });
  });

  it('an impossible birthday says what to fix right away, and «Continuar» stays off', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, {}));
    render(<CompleteProfileScreen jwt="jwt" profile={{ ...base, email: 'ana@example.com', emailVerified: true, missing: ['birthday'] }} onDone={vi.fn()} />);
    fireEvent.change(screen.getByTestId('perfil-dia'), { target: { value: '31' } });
    fireEvent.change(screen.getByTestId('perfil-mes'), { target: { value: '4' } });
    expect(await screen.findByText('Ese día no existe en ese mes.')).toBeTruthy();
    expect((screen.getByTestId('perfil-continuar') as HTMLButtonElement).disabled).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
