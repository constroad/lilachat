import { limaDayKey } from '@lilachat/shared';

const REPORTED_KEY = 'lilachat.respaldo.sinClaveReportado';

type DayStorage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void> };

/**
 * «No backup key yet», told to the server once a day at most (pending 83): the
 * background task wakes every hour, and the server only needs to know who is
 * waiting. A report that did not arrive is tried again in the next run; a
 * failure never stops the backup.
 */
export async function reportMissingKeyOncePerDay(params: { storage: DayStorage; report: () => Promise<{ ok: boolean }>; now?: Date }): Promise<void> {
  try {
    const today = limaDayKey(params.now ?? new Date());
    if ((await params.storage.getItem(REPORTED_KEY)) === today) return;
    if ((await params.report()).ok) await params.storage.setItem(REPORTED_KEY, today);
  } catch {
    // Without network or storage the count waits for the next run.
  }
}
