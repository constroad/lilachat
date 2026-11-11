import { describe, expect, it, vi } from 'vitest';
import type { CommandResponse } from './botCommands.js';
import { liftRequest, noteValues, observationAnswerOf, registerRequest, writeObservation, writeOutcome, type ObservationWriteDeps } from './observationWrite.js';

const ticket = { url: 'https://portal.constroad.com/api/obs/upload', method: 'POST' as const, fields: { t: 'x' }, fileField: 'file', expiresAt: '2026-11-11T18:00:00.000Z', maxBytes: 50_000_000, maxSeconds: 30, mimeTypes: ['image/jpeg', 'video/mp4'] };
const answered = (data: Record<string, unknown>, upload: typeof ticket | null = ticket): CommandResponse => ({ responseType: 'ephemeral', data, ...(upload ? { upload } : {}) });
const PORTAL = { informeId: 'r1', observacionId: 'o1', codigo: 'OBS-001' };

/** A fake app run: each confirmation answers `responses` in turn; `statuses` are Portal's answers to the files. */
function deps(responses: CommandResponse[], statuses: number[]) {
  const sent: string[] = [];
  const submitted: Record<string, string>[] = [];
  let opened = 0;
  const fake: ObservationWriteDeps<string> = {
    open: vi.fn(async () => ({ ok: true as const, data: { commandId: `c${++opened}`, appId: 'a', appName: 'Portal', outcome: 'form' as const, response: { responseType: 'form' as const } } })),
    submit: vi.fn(async (_commandId: string, values: Record<string, string>) => { submitted.push(values); return { ok: true as const, outcome: { commandId: 'c', outcome: 'answered' as const, response: responses.shift()! } }; }),
    notice: vi.fn(async () => null),
    send: vi.fn(async (_upload, file: string, key: string) => { sent.push(`${file}:${key}`); return { status: statuses.shift() }; }),
  };
  return { fake, sent, submitted };
}

const photo = { key: 'k1', source: 'foto.jpg', facts: { mime: 'image/jpeg', sizeBytes: 1000 } };
const video = { key: 'k2', source: 'clip.mp4', facts: { mime: 'video/mp4', seconds: 18 } };

describe('the requests', () => {
  it('a registry passes its id; from a lifting the observation lands in the open registry', () => {
    expect(registerRequest({ id: 'r1', type: 'REG-OBS' }, 'e1', { lat: -12, lng: -77 })).toEqual({ kind: 'observation_register', entry_id: 'e1', lat: -12, lng: -77, report_id: 'r1', forms: expect.any(Number) });
    expect(registerRequest({ id: 'l1', type: 'LEV-OBS' }, 'e1', { lat: -12, lng: -77 })).not.toHaveProperty('report_id');
    expect(liftRequest({ id: 'l1', type: 'LEV-OBS' }, 'o1')).toEqual({ kind: 'observation_lift', observation_id: 'o1', report_id: 'l1', forms: expect.any(Number) });
    expect(liftRequest({ id: 'r1', type: 'REG-OBS' }, 'o1')).not.toHaveProperty('report_id');
  });

  it('a blank note goes as nothing: Portal writes its own line', () => {
    expect(noteValues('   ')).toEqual({});
    expect(noteValues(' Fisura ')).toEqual({ nota: 'Fisura' });
    expect(noteValues('x'.repeat(700)).nota).toHaveLength(600);
  });

  it('reads the ids Portal answered, and none without them', () => {
    expect(observationAnswerOf(answered(PORTAL))).toEqual({ reportId: 'r1', observationId: 'o1', code: 'OBS-001', upload: ticket });
    expect(observationAnswerOf(answered({ informeId: 'r1' }))).toBeNull();
  });
});

describe('writeObservation', () => {
  it('confirms once and sends every file with its own key', async () => {
    const { fake, sent, submitted } = deps([answered(PORTAL)], [201, 201]);

    const result = await writeObservation(fake, 'Fisura', [photo, video]);

    expect(result).toEqual({ ok: true, answer: expect.objectContaining({ observationId: 'o1' }), failed: [] });
    expect(sent).toEqual(['foto.jpg:k1', 'clip.mp4:k2']);
    expect(submitted).toEqual([{ nota: 'Fisura' }]);
  });

  it('an expired ticket asks Portal again with the same values and sends the file once more', async () => {
    const { fake, sent, submitted } = deps([answered(PORTAL), answered(PORTAL)], [410, 200]);

    const result = await writeObservation(fake, '', [photo]);

    expect(result.ok && result.failed).toEqual([]);
    expect(sent).toEqual(['foto.jpg:k1', 'foto.jpg:k1']);
    expect(submitted).toEqual([{}, {}]);
  });

  it('a file Portal refuses is reported and the rest still go', async () => {
    const { fake, sent } = deps([answered(PORTAL)], [413, 201]);

    const result = await writeObservation(fake, 'x', [photo, video]);

    expect(result.ok && result.failed).toEqual([{ key: 'k1', message: 'El archivo pesa demasiado.' }]);
    expect(sent).toHaveLength(2);
  });

  it('a video over the ticket\'s seconds never leaves the phone', async () => {
    const { fake, sent } = deps([answered(PORTAL)], []);

    const result = await writeObservation(fake, 'x', [{ ...video, facts: { mime: 'video/mp4', seconds: 41 } }]);

    expect(result.ok && result.failed[0]?.message).toBe('El video dura más de 30 segundos.');
    expect(sent).toEqual([]);
  });

  it('a refusal or an answer without ids writes nothing', async () => {
    const refused = deps([], []);
    refused.fake.submit = vi.fn(async () => ({ ok: false as const, errors: { _: 'Esa herramienta todavía no está aprobada.' } }));
    expect(await writeObservation(refused.fake, 'x', [photo])).toEqual({ ok: false, message: 'Esa herramienta todavía no está aprobada.' });

    const empty = deps([answered({})], []);
    expect((await writeObservation(empty.fake, 'x', [photo])).ok).toBe(false);
  });

  it('without a ticket the observation is written and its files wait', async () => {
    const { fake } = deps([answered(PORTAL, null)], []);

    const result = await writeObservation(fake, 'x', [photo]);

    expect(result.ok && result.failed).toEqual([{ key: 'k1', message: 'No llegó el permiso para subir el archivo. Vuelve a intentarlo.' }]);
  });
});

describe('writeOutcome', () => {
  const answer = { reportId: 'r1', observationId: 'o1', code: 'OBS-003', upload: null };

  it('says it is done, which files are missing, or why nothing was written', () => {
    expect(writeOutcome({ ok: true, answer, failed: [] }, 'registrada')).toEqual({ done: true, line: 'OBS-003 registrada.' });
    expect(writeOutcome({ ok: true, answer, failed: [{ key: 'k', message: 'El archivo pesa demasiado.' }] }, 'levantada')).toEqual({ done: false, line: 'OBS-003 levantada; falta 1 archivo: El archivo pesa demasiado.' });
    expect(writeOutcome({ ok: true, answer: { ...answer, code: undefined }, failed: [{ key: 'a', message: 'x' }, { key: 'b', message: 'y' }] }, 'registrada').line).toBe('La observación registrada; faltan 2 archivos: x');
    expect(writeOutcome({ ok: false, message: 'Sin señal' }, 'registrada')).toEqual({ done: false, line: 'Sin señal' });
  });
});

