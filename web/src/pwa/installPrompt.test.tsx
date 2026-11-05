import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { catchInstallPrompt, useInstallPrompt } from './installPrompt';

function browserOffers() {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  const prompt = vi.fn(async () => undefined);
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) });
  act(() => {
    window.dispatchEvent(event);
  });
  return { event, prompt };
}

beforeAll(() => catchInstallPrompt());

afterEach(() => {
  act(() => {
    window.dispatchEvent(new Event('appinstalled'));
  });
});

describe('useInstallPrompt', () => {
  it('keeps an offer fired before anyone signed in', () => {
    const { event } = browserOffers();
    const { result } = renderHook(() => useInstallPrompt());

    expect(event.defaultPrevented).toBe(true);
    expect(result.current.canInstall).toBe(true);
  });

  it('asks the browser once, and the offer is gone after', async () => {
    const { prompt } = browserOffers();
    const { result } = renderHook(() => useInstallPrompt());

    await act(() => result.current.install());

    expect(prompt).toHaveBeenCalledTimes(1);
    expect(result.current.canInstall).toBe(false);
  });

  it('drops the offer when the app gets installed another way', () => {
    browserOffers();
    const { result } = renderHook(() => useInstallPrompt());

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    expect(result.current.canInstall).toBe(false);
  });

  it('has nothing to offer on Safari, which never fires it', async () => {
    const { result } = renderHook(() => useInstallPrompt());

    await act(() => result.current.install());

    expect(result.current.canInstall).toBe(false);
  });
});
