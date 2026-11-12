import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpaceClient } from '@lilachat/shared';
import { useClientOfChat, useClientsOfChannelSpace } from './useSpaceClients';

const askServer = vi.hoisted(() => vi.fn());
vi.mock('../../api', async (original) => ({ ...(await original<typeof import('../../api')>()), api: askServer }));

const clientChannel: SpaceClient = { id: 'c-1', chat_id: '6aecc7a454a328c01722f25a', name: 'Constructora Los Andes SAC', live: true, archived_since: null, last_activity_at: null, last_order_at: null, orders_total: 0, archived_group: 'recent' as SpaceClient['archived_group'], services: [] };

beforeEach(() => askServer.mockReset());

/**
 * E2E 12/11 at 430 px: reloading a client's channel showed a plain group, no «Cuenta» nor «Servicios».
 * On the phone the space's list is not on screen, and only the list asked for the clients.
 */
describe('a client channel opened with no space list on screen', () => {
  it('asks its space\'s clients once, and the channel knows its client', async () => {
    // Arrange
    askServer.mockResolvedValue({ ok: true, data: { clients: [clientChannel] } });
    // Act
    renderHook(() => useClientsOfChannelSpace('jwt', 'space-test', true));
    const { result } = renderHook(() => useClientOfChat(clientChannel.chat_id));
    // Assert
    await waitFor(() => expect(result.current?.name).toBe('Constructora Los Andes SAC'));
    expect(askServer).toHaveBeenCalledTimes(1);
    expect(askServer.mock.calls[0]![0]).toBe('/workspaces/space-test/clients');
  });

  it('not a channel, or no session yet: nothing is asked', async () => {
    askServer.mockResolvedValue({ ok: true, data: { clients: [clientChannel] } });
    renderHook(() => useClientsOfChannelSpace('jwt', 'space-other', false));
    renderHook(() => useClientsOfChannelSpace(undefined, 'space-other', true));
    expect(askServer).not.toHaveBeenCalled();
  });
});
