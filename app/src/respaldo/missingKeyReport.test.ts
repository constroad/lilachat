import { describe, expect, it, vi } from 'vitest';
import { reportMissingKeyOncePerDay } from './missingKeyReport';

/** Pending 83: the phone says «no backup key yet» to the server, once a day at most. */
function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: async (key: string) => values.get(key) ?? null, setItem: async (key: string, value: string) => void values.set(key, value) };
}

describe('reportMissingKeyOncePerDay', () => {
  it('reports the first time in the day and not again that day', async () => {
    const storage = memoryStorage();
    const report = vi.fn(async () => ({ ok: true }));
    const morning = new Date('2026-10-23T13:00:00.000Z');
    await reportMissingKeyOncePerDay({ storage, report, now: morning });
    await reportMissingKeyOncePerDay({ storage, report, now: new Date('2026-10-23T20:00:00.000Z') });
    expect(report).toHaveBeenCalledTimes(1);
    await reportMissingKeyOncePerDay({ storage, report, now: new Date('2026-10-24T13:00:00.000Z') });
    expect(report).toHaveBeenCalledTimes(2);
  });

  it('a report that did not arrive is tried again in the next run, and a failure never throws', async () => {
    const storage = memoryStorage();
    const report = vi.fn().mockResolvedValueOnce({ ok: false }).mockRejectedValueOnce(new Error('sin red')).mockResolvedValue({ ok: true });
    const now = new Date('2026-10-23T13:00:00.000Z');
    await reportMissingKeyOncePerDay({ storage, report, now });
    await expect(reportMissingKeyOncePerDay({ storage, report, now })).resolves.toBeUndefined();
    await reportMissingKeyOncePerDay({ storage, report, now });
    await reportMissingKeyOncePerDay({ storage, report, now });
    expect(report).toHaveBeenCalledTimes(3);
  });
});
