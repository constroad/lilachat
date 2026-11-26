import { describe, expect, it } from 'vitest';
import { discardFieldJob, enqueueFieldJob, fieldQueueLine, watchFieldRun, FIELD_JOB_GAVE_UP, FIELD_JOB_SERVER_TRIES, fieldJobsOfService, fieldJobsWakeAt, newFieldJob, nextFieldJob, retryFieldJob, settleFieldJob, type FieldJob } from './fieldQueue.js';
import { RETRY_MAX_MS } from './outbox.js';

const NOW = 1_764_160_000_000;
const SCOPE = { spaceId: '6650f1a2b3c4d5e6f7a8b9c0', clientId: 'cli-20601234567', serviceId: '66a1b2c3d4e5f6a7b8c9d0e1', chatId: '6651aa00bb11cc22dd33ee44' };
const KEY_A = '3f1c2b9a-6d7e-4f80-9a1b-2c3d4e5f6a7b';
const KEY_B = '8e2d1c0b-5a4f-4e3d-8c2b-1a0f9e8d7c6b';
const FILE = { key: '0b9c8d7e-6f5a-4b3c-9d2e-1f0a9b8c7d6e', ref: 'file:///data/user/0/com.lilachat.app/files/field-queue/0b9c8d7e.jpg', name: 'foto-1764160000000.jpeg', mime: 'image/jpeg' };

const jobOf = (key: string, at = NOW): FieldJob => newFieldJob({ key, kind: 'drive_file', scope: SCOPE, label: 'Foto al Drive', payload: { mime: 'image/jpeg' }, files: [FILE], now: at });

describe('newFieldJob', () => {
  it('starts ready, with no attempts', () => {
    // Act
    const job = jobOf(KEY_A);
    // Assert
    expect(job).toMatchObject({ key: KEY_A, attempts: 0, serverAttempts: 0, nextAt: NOW, done: {}, createdAt: NOW });
    expect(job.refusal).toBeUndefined();
  });
});

describe('enqueueFieldJob', () => {
  it('the same key twice is one job (a double tap)', () => {
    const queue = enqueueFieldJob(enqueueFieldJob([], jobOf(KEY_A)), jobOf(KEY_A, NOW + 5));
    expect(queue).toHaveLength(1);
  });
});

describe('nextFieldJob', () => {
  it('takes the oldest ready job', () => {
    const queue = [jobOf(KEY_A), jobOf(KEY_B)];
    expect(nextFieldJob(queue, NOW)?.key).toBe(KEY_A);
  });

  it('a job waiting its retry does not block the one behind (anti-wedge)', () => {
    const queue = [{ ...jobOf(KEY_A), nextAt: NOW + 10_000 }, jobOf(KEY_B)];
    expect(nextFieldJob(queue, NOW)?.key).toBe(KEY_B);
  });

  it('a refused job waits for the person', () => {
    const queue = [{ ...jobOf(KEY_A), refusal: 'El archivo pesa demasiado.' }];
    expect(nextFieldJob(queue, NOW)).toBeNull();
  });
});

describe('settleFieldJob', () => {
  it('done leaves the queue', () => {
    expect(settleFieldJob([jobOf(KEY_A), jobOf(KEY_B)], KEY_A, { outcome: 'done' }, NOW)).toEqual([jobOf(KEY_B)]);
  });

  it('without signal waits longer each time, capped, and never gives up', () => {
    // Arrange
    let queue = [jobOf(KEY_A)];
    // Act
    for (let round = 0; round < 40; round += 1) queue = settleFieldJob(queue, KEY_A, { outcome: 'retry', reached: false }, NOW);
    // Assert
    expect(queue[0]!.refusal).toBeUndefined();
    expect(queue[0]!.attempts).toBe(40);
    expect(queue[0]!.nextAt - NOW).toBe(RETRY_MAX_MS);
  });

  it('the first retry waits one second', () => {
    const [job] = settleFieldJob([jobOf(KEY_A)], KEY_A, { outcome: 'retry', reached: false }, NOW);
    expect(job!.nextAt).toBe(NOW + 1_000);
  });

  it('keeps the steps already done, so a retry does not repeat them', () => {
    const [job] = settleFieldJob([jobOf(KEY_A)], KEY_A, { outcome: 'retry', reached: false, done: { photo: '6650ffee0011223344556677' } }, NOW);
    expect(job!.done).toEqual({ photo: '6650ffee0011223344556677' });
  });

  it('a wait asked by the server (rate limit) is honored', () => {
    const [job] = settleFieldJob([jobOf(KEY_A)], KEY_A, { outcome: 'retry', reached: true, afterMs: 30_000 }, NOW);
    expect(job!.nextAt).toBe(NOW + 30_000);
  });

  it('a server that answers but keeps failing gives up after its tries, with a visible reason', () => {
    let queue = [jobOf(KEY_A)];
    for (let round = 0; round < FIELD_JOB_SERVER_TRIES; round += 1) queue = settleFieldJob(queue, KEY_A, { outcome: 'retry', reached: true }, NOW);
    expect(queue[0]!.refusal).toBe(FIELD_JOB_GAVE_UP);
  });

  it('a refusal stays at hand with its message', () => {
    const [job] = settleFieldJob([jobOf(KEY_A)], KEY_A, { outcome: 'refuse', message: 'El archivo pesa demasiado.' }, NOW);
    expect(job!.refusal).toBe('El archivo pesa demasiado.');
  });

  it('an unknown key changes nothing', () => {
    const queue = [jobOf(KEY_A)];
    expect(settleFieldJob(queue, KEY_B, { outcome: 'done' }, NOW)).toEqual(queue);
  });
});

describe('retryFieldJob and discardFieldJob', () => {
  it('«Reintentar» clears the refusal and the counters, keeping the steps done', () => {
    const refused = { ...jobOf(KEY_A), refusal: FIELD_JOB_GAVE_UP, attempts: 9, serverAttempts: 8, nextAt: NOW + 60_000, done: { photo: 'x' } };
    const [job] = retryFieldJob([refused], KEY_A, NOW + 5);
    expect(job).toMatchObject({ attempts: 0, serverAttempts: 0, nextAt: NOW + 5, done: { photo: 'x' } });
    expect(job!.refusal).toBeUndefined();
  });

  it('«Descartar» removes it and hands back its files to delete', () => {
    const { queue, dropped } = discardFieldJob([jobOf(KEY_A), jobOf(KEY_B)], KEY_A);
    expect(queue.map((one) => one.key)).toEqual([KEY_B]);
    expect(dropped?.files).toEqual([FILE]);
  });
});

describe('fieldJobsWakeAt', () => {
  it('is the soonest retry among the pending', () => {
    const queue = [{ ...jobOf(KEY_A), nextAt: NOW + 9_000 }, { ...jobOf(KEY_B), nextAt: NOW + 2_000 }];
    expect(fieldJobsWakeAt(queue)).toBe(NOW + 2_000);
  });

  it('is null with only refused jobs or none', () => {
    expect(fieldJobsWakeAt([{ ...jobOf(KEY_A), refusal: 'x' }])).toBeNull();
    expect(fieldJobsWakeAt([])).toBeNull();
  });
});

describe('fieldJobsOfService', () => {
  it('counts what waits and lists what was refused, only for that service', () => {
    const other = { ...jobOf(KEY_B), scope: { ...SCOPE, serviceId: '66a1b2c3d4e5f6a7b8c9d0ff' } };
    const refused = { ...jobOf('c0ffee00-1111-4222-8333-444455556666'), refusal: 'No va.' };
    const summary = fieldJobsOfService([jobOf(KEY_A), other, refused], SCOPE.serviceId);
    expect(summary.waiting).toBe(1);
    expect(summary.refused.map((one) => one.refusal)).toEqual(['No va.']);
  });
});

describe('watchFieldRun', () => {
  it('nothing came back: retry without counting it against the server', () => {
    // Arrange
    const watch = watchFieldRun();
    // Act
    watch.open({ ok: false });
    // Assert
    expect(watch.verdictOf({ ok: false, message: 'No se pudo subir el archivo.' })).toEqual({ outcome: 'retry', reached: false });
  });

  it('a busy server or a proxy while it restarts: retry, counted', () => {
    const watch = watchFieldRun();
    watch.open({ ok: true });
    watch.send(502);
    expect(watch.verdictOf({ ok: false, message: 'x' })).toEqual({ outcome: 'retry', reached: true });
  });

  it('agentes rate limit waits what it asked', () => {
    const watch = watchFieldRun();
    watch.submit({ ok: false, status: 429, code: 'rate_limited', retryAfterS: 20 });
    expect(watch.verdictOf({ ok: false, message: 'x' })).toEqual({ outcome: 'retry', reached: true, afterMs: 20_000 });
  });

  it('an answer that never arrived is a passing failure', () => {
    const watch = watchFieldRun();
    watch.open({ ok: true });
    watch.submit({ ok: true });
    watch.notice(false);
    expect(watch.verdictOf({ ok: false, message: 'x' }).outcome).toBe('retry');
  });

  it('Portal refusing the file keeps it at hand with Portal\'s words', () => {
    const watch = watchFieldRun();
    watch.open({ ok: true });
    watch.submit({ ok: true });
    watch.notice(true);
    watch.send(413);
    expect(watch.verdictOf({ ok: false, message: 'El archivo pesa demasiado.' })).toEqual({ outcome: 'refuse', message: 'El archivo pesa demasiado.' });
  });

  it('a send with no reply at all is no signal', () => {
    const watch = watchFieldRun();
    watch.send(undefined);
    expect(watch.verdictOf({ ok: false, message: 'x' })).toMatchObject({ outcome: 'retry', reached: false });
  });

  it('carries the steps done in any verdict', () => {
    const watch = watchFieldRun();
    watch.send(undefined);
    expect(watch.verdictOf({ ok: false, message: 'x' }, { photo: 'm1' })).toMatchObject({ done: { photo: 'm1' } });
  });

  it('success is done', () => {
    expect(watchFieldRun().verdictOf({ ok: true })).toEqual({ outcome: 'done' });
  });
});

describe('fieldQueueLine', () => {
  it('one and many', () => {
    expect(fieldQueueLine(1)).toBe('1 pendiente en el teléfono · sale solo apenas haya señal');
    expect(fieldQueueLine(4)).toBe('4 pendientes en el teléfono · salen solos apenas haya señal');
  });
});
