import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { AccessScreens } from '../auth/AccessScreens';
import { LegalPage } from './LegalPage';
import { PRIVACY_POLICY } from './privacyPolicy';

vi.mock('socket.io-client', () => ({ io: () => ({ on: vi.fn(), off: vi.fn(), close: vi.fn(), emit: vi.fn(), connect: vi.fn() }) }));

const SESSION = { jwt: 'jwt-de-prueba', userId: 'u1', phone: '902049935', name: 'José', deviceId: 'device-1' };

const textOf = (sections: typeof PRIVACY_POLICY.sections) => sections.flatMap((section) => [...(section.paragraphs ?? []), ...(section.bullets ?? [])]).join('\n');

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ chats: [] }), { status: 200 })));
});

afterEach(() => {
  window.history.pushState({}, '', '/');
  vi.unstubAllGlobals();
});

describe('public legal pages (Google Play)', () => {
  it('/privacidad opens without a session, instead of the sign-in', () => {
    window.history.pushState({}, '', '/privacidad');

    render(<App />);

    expect(screen.getByTestId('pagina-legal-privacy')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Política de privacidad de Lilachat' })).toBeInTheDocument();
    expect(screen.queryByTestId('input-correo')).not.toBeInTheDocument();
  });

  it('/seguridad-infantil opens with a session too, instead of the chats', () => {
    localStorage.setItem('lilachat.credential', JSON.stringify(SESSION));
    window.history.pushState({}, '', '/seguridad-infantil/');

    render(<App />);

    expect(screen.getByTestId('pagina-legal-childSafety')).toBeInTheDocument();
    expect(screen.queryByTestId('panel-lista')).not.toBeInTheDocument();
  });

  it('the privacy policy links to account deletion and to the child-safety standards', () => {
    render(<LegalPage page="privacy" />);

    expect(screen.getByRole('link', { name: 'Borrar mi cuenta' })).toHaveAttribute('href', '/borrar-cuenta');
    expect(screen.getByRole('link', { name: 'Normas de seguridad infantil' })).toHaveAttribute('href', '/seguridad-infantil');
  });

  it('the privacy policy says the phone numbers of the contacts go to the server (POST /api/contacts/match)', () => {
    const text = textOf(PRIVACY_POLICY.sections);

    expect(text).toMatch(/envía los números al servidor/);
    expect(text).not.toMatch(/no se envían a ningún lado/);
  });

  it('the child-safety page says how to report inside the app and who answers', () => {
    render(<LegalPage page="childSafety" />);

    expect(screen.getByText(/«Abuso infantil»/)).toBeInTheDocument();
    expect(screen.getByText(/NCMEC/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '4. Punto de contacto' })).toBeInTheDocument();
  });
});

describe('LegalFooter on the sign-in', () => {
  it('shows «Privacidad · Seguridad infantil» with their addresses', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));

    render(<AccessScreens onReady={vi.fn()} />);

    const footer = within(screen.getByTestId('pie-legal'));
    expect(footer.getByRole('link', { name: 'Privacidad' })).toHaveAttribute('href', '/privacidad');
    expect(footer.getByRole('link', { name: 'Seguridad infantil' })).toHaveAttribute('href', '/seguridad-infantil');
  });
});
