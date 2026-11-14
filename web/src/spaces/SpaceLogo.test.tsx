import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { SpaceLogo } from './SpaceLogo';

afterEach(cleanup);

describe('SpaceLogo (web)', () => {
  it('shows the picture when the space has one', () => {
    const { container } = render(<SpaceLogo space={{ name: 'Globofast', logoUrl: 'https://example.com/logo.png' }} size={44} />);
    expect(container.querySelector('img')).toBeTruthy();
  });

  it('falls back to the initials when the picture fails to load', () => {
    const { container } = render(<SpaceLogo space={{ name: 'Globofast', logoUrl: 'https://example.com/roto.png' }} size={44} />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('GL');
  });
});
