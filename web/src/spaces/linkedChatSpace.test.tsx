import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { linkedChatSwitch, useLinkedChatSpace } from './linkedChatSpace';

const askServer = vi.hoisted(() => vi.fn());
vi.mock('../api', async (original) => ({ ...(await original<typeof import('../api')>()), api: askServer }));

const TEST = '6a0f1c2b3d4e5f6a7b8c9d01';
const INFRAMAQ = '6a0f1c2b3d4e5f6a7b8c9d02';
const CHANNEL = '6aecc7a454a328c01722f25a';

beforeEach(() => askServer.mockReset());

describe('which space a linked chat opens in', () => {
  it('a chat of another of my spaces switches to it', () => {
    expect(linkedChatSwitch({ chatSpaceIds: [TEST], currentSpaceId: INFRAMAQ, mySpaceIds: [INFRAMAQ, TEST] })).toEqual({ to: TEST });
  });

  it('already in its space, or a shared channel seen from this one: stays', () => {
    expect(linkedChatSwitch({ chatSpaceIds: [TEST], currentSpaceId: TEST, mySpaceIds: [TEST] })).toBeNull();
    expect(linkedChatSwitch({ chatSpaceIds: [TEST, INFRAMAQ], currentSpaceId: INFRAMAQ, mySpaceIds: [TEST, INFRAMAQ] })).toBeNull();
  });

  it('a personal chat opened from a space goes back to personal', () => {
    expect(linkedChatSwitch({ chatSpaceIds: [], currentSpaceId: INFRAMAQ, mySpaceIds: [INFRAMAQ] })).toEqual({ to: null });
  });

  it('a space I am not active in is never entered', () => {
    expect(linkedChatSwitch({ chatSpaceIds: [TEST], currentSpaceId: INFRAMAQ, mySpaceIds: [INFRAMAQ] })).toBeNull();
  });
});

describe('the chat a page was opened with', () => {
  const base = { jwt: 'jwt', linkedChatId: CHANNEL, selectedChatId: CHANNEL, currentSpaceId: INFRAMAQ, mySpaceIds: [INFRAMAQ, TEST] };

  it('not in the lists on screen: asks once where it lives and switches there', async () => {
    // Arrange
    askServer.mockResolvedValue({ ok: true, data: { spaceIds: [TEST] } });
    const onSwitch = vi.fn();
    // Act
    const { rerender } = renderHook((props: { found: boolean }) => useLinkedChatSpace({ ...base, found: props.found, onSwitch }), { initialProps: { found: false } });
    rerender({ found: false });
    // Assert
    await waitFor(() => expect(onSwitch).toHaveBeenCalledWith(TEST));
    expect(askServer).toHaveBeenCalledTimes(1);
    expect(askServer.mock.calls[0]![0]).toBe(`/chats/${CHANNEL}/spaces`);
  });

  it('found on screen, another chat opened since, or no session: nothing is asked', () => {
    const onSwitch = vi.fn();
    renderHook(() => useLinkedChatSpace({ ...base, found: true, onSwitch }));
    renderHook(() => useLinkedChatSpace({ ...base, selectedChatId: 'another-chat', found: false, onSwitch }));
    renderHook(() => useLinkedChatSpace({ ...base, jwt: undefined, found: false, onSwitch }));
    expect(askServer).not.toHaveBeenCalled();
  });

  it('the server does not know it (404) or it showed up meanwhile: stays where it is', async () => {
    askServer.mockResolvedValueOnce({ ok: false, status: 404, error: 'No encontramos esa conversación.' });
    const onSwitch = vi.fn();
    renderHook(() => useLinkedChatSpace({ ...base, found: false, onSwitch }));
    await waitFor(() => expect(askServer).toHaveBeenCalledTimes(1));
    let answer: (value: unknown) => void = () => undefined;
    askServer.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
    const late = renderHook((props: { found: boolean }) => useLinkedChatSpace({ ...base, linkedChatId: 'chat-2', selectedChatId: 'chat-2', found: props.found, onSwitch }), { initialProps: { found: false } });
    late.rerender({ found: true });
    answer({ ok: true, data: { spaceIds: [TEST] } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onSwitch).not.toHaveBeenCalled();
  });
});
