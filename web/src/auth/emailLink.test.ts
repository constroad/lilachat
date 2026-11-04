import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { emailLinkOf, useEmailLink } from './emailLink';

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
