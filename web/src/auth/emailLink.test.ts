import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { emailHintOf, emailLinkOf, useEmailLink } from './emailLink';

const PATH = '/login/callback';

describe('the link of the code email', () => {
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('reads the email and the code of the callback', () => {
    expect(emailLinkOf(PATH, '?d=ana%40constroad.com&c=424242')).toEqual({ email: 'ana@constroad.com', code: '424242' });
  });

  it('is no link with a phone, a broken code or another path', () => {
    expect(emailLinkOf(PATH, '?d=902049935&c=424242')).toBeNull();
    expect(emailLinkOf(PATH, '?d=ana%40constroad.com&c=42')).toBeNull();
    expect(emailLinkOf(PATH, '?d=ana%40constroad.com')).toBeNull();
    expect(emailLinkOf('/', '?d=ana%40constroad.com&c=424242')).toBeNull();
  });

  it('takes the code out of the address as soon as it is read', () => {
    // Arrange
    window.history.pushState(null, '', `${PATH}?d=ana%40constroad.com&c=424242`);
    // Act
    const { result } = renderHook(() => useEmailLink());
    // Assert
    expect(result.current).toEqual({ email: 'ana@constroad.com', code: '424242' });
    expect(window.location.pathname + window.location.search).toBe('/');
  });
});

describe('the invitation link (José 12/11: «Entra con este correo» from the invite email)', () => {
  it('`?d=<email>` without a code writes the email in «Entrar con mi correo»', () => {
    expect(emailHintOf('/', '?d=luis%40empresa.pe')).toBe('luis@empresa.pe');
    expect(emailHintOf('/', '?d=Luis@Empresa.PE')).toBe('luis@empresa.pe');
  });

  it('is nothing with a phone, without `d`, or when it is the code email\'s callback', () => {
    expect(emailHintOf('/', '?d=987654321')).toBeNull();
    expect(emailHintOf('/', '')).toBeNull();
    expect(emailHintOf('/login/callback', '?d=luis%40empresa.pe&c=123456')).toBeNull();
  });
});
