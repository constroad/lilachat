import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppCommandsPanel } from './AppCommandsPanel';

const api = vi.hoisted(() => ({ appItems: vi.fn(), appSchedules: vi.fn(), spaceMembers: vi.fn() }));
vi.mock('../spacesApi', () => api);

const props = { jwt: 'jwt', spaceId: 's1', appId: 'a1', appName: 'Inframaq' };

beforeEach(() => {
  api.appItems.mockReset();
  api.appSchedules.mockResolvedValue({ ok: false, status: 500 });
  api.spaceMembers.mockResolvedValue({ ok: true, data: { members: [] } });
});

describe('«Comandos» when its list does not load (E2E 04/11: a blank tab)', () => {
  it('says so and reads again from a tap, instead of an empty tab', async () => {
    // Arrange
    api.appItems.mockResolvedValueOnce({ ok: false, status: 502 });
    api.appItems.mockResolvedValueOnce({ ok: true, data: { items: [], channels: [], canEdit: true } });
    render(<AppCommandsPanel {...props} />);
    // Act
    fireEvent.click(await screen.findByTestId('comandos-reintentar'));
    // Assert
    await waitFor(() => expect(screen.queryByTestId('comandos-reintentar')).not.toBeInTheDocument());
    expect(api.appItems).toHaveBeenCalledTimes(2);
  });

  it('shows no error while the list is on its way', () => {
    api.appItems.mockReturnValue(new Promise(() => undefined));
    render(<AppCommandsPanel {...props} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
