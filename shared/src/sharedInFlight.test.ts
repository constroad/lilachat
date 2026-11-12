import { describe, expect, it, vi } from 'vitest';
import { sharedInFlight } from './sharedInFlight.js';

/**
 * agentes 12/11: opening the observations sent the same report read 8 to 18
 * times in a second, and its cap of 20 tool calls a minute per person refused
 * the rest. One open is one read: calls that overlap share it.
 */
describe('sharedInFlight', () => {
  const deferred = () => {
    let settle: (value: string) => void = () => undefined;
    let fail: (error: Error) => void = () => undefined;
    const promise = new Promise<string>((resolve, reject) => { settle = resolve; fail = reject; });
    return { promise, settle, fail };
  };

  it('calls that overlap with the same key share one call and its answer', async () => {
    const pending = deferred();
    const call = vi.fn((_id: string) => pending.promise);
    const ask = sharedInFlight((id: string) => id, call);

    const first = ask('r1');
    const second = ask('r1');
    pending.settle('doc');

    expect(call).toHaveBeenCalledTimes(1);
    expect(await first).toBe('doc');
    expect(await second).toBe('doc');
  });

  it('another key is another call', () => {
    const call = vi.fn((_id: string) => deferred().promise);
    const ask = sharedInFlight((id: string) => id, call);

    void ask('r1');
    void ask('r2');

    expect(call).toHaveBeenCalledTimes(2);
  });

  it('once it answered, the next ask goes out again (a write is read fresh)', async () => {
    const call = vi.fn(async (_id: string) => 'doc');
    const ask = sharedInFlight((id: string) => id, call);

    await ask('r1');
    await ask('r1');

    expect(call).toHaveBeenCalledTimes(2);
  });

  it('a failure reaches everyone who shared it and does not stick', async () => {
    const pending = deferred();
    const call = vi.fn((_id: string) => pending.promise);
    const ask = sharedInFlight((id: string) => id, call);

    const first = ask('r1');
    const second = ask('r1');
    pending.fail(new Error('502'));

    await expect(first).rejects.toThrow('502');
    await expect(second).rejects.toThrow('502');
    call.mockResolvedValueOnce('doc');
    expect(await ask('r1')).toBe('doc');
    expect(call).toHaveBeenCalledTimes(2);
  });
});
