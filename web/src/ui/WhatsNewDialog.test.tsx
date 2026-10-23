import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RELEASE_NOTES } from '@lilachat/shared';
import { WhatsNewDialog } from './WhatsNewDialog';

afterEach(() => window.localStorage.clear());

describe('WhatsNewDialog (pending 66)', () => {
  it('shows what is new once, and «Entendido» remembers it', () => {
    const { unmount } = render(<WhatsNewDialog />);
    expect(screen.getByTestId('novedades-de-la-version').textContent).toContain(RELEASE_NOTES[0]!.items[0]!);
    fireEvent.click(screen.getByTestId('btn-novedades-entendido'));
    expect(screen.queryByTestId('novedades-de-la-version')).toBeNull();
    unmount();
    render(<WhatsNewDialog />);
    expect(screen.queryByTestId('novedades-de-la-version')).toBeNull();
  });
});
