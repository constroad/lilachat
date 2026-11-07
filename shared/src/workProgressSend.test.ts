import { describe, expect, it, vi } from 'vitest';
import type { FormSubmitReply } from './appActions.js';
import type { CommandOutcome } from './botCommands.js';
import { PROGRESS_SENT, sendWorkProgress, workProgressRequest, type WorkProgressDeps } from './workProgressSend.js';
import type { ProgressEntry } from './workMapProgress.js';

const entry: ProgressEntry = { servicioId: 'srv-318', calleId: 'st-1', etiquetaId: 'tg-1', desdeM: 10, hastaM: 100, despachoIds: ['d1', 'd2'], entradaId: '3f0e2c1a-1111-4222-8333-444455556666', horaDelEquipo: '2026-11-07T15:00:00.000Z', nota: 'Tramo de la mañana' };
const form: CommandOutcome = { commandId: 'cmd-1', appId: 'app-1', appName: 'Portal', outcome: 'form', response: { responseType: 'form' } } as CommandOutcome;
const answered = (text: string): FormSubmitReply => ({ ok: true, outcome: { commandId: 'cmd-1', appId: 'app-1', appName: 'Portal', outcome: 'ephemeral', response: { responseType: 'ephemeral', text } } as CommandOutcome });

const depsWith = (reply: FormSubmitReply, opened: Awaited<ReturnType<WorkProgressDeps['open']>> = { ok: true, data: form }): WorkProgressDeps => ({
  open: vi.fn(async () => opened),
  submit: vi.fn(async () => reply),
  notice: vi.fn(async () => null),
});

describe('workProgressRequest (what the server opens, agentes 07/11)', () => {
  it("sends the stretch in the server's words, without the service: the door puts it", () => {
    expect(workProgressRequest(entry)).toEqual({ kind: 'work_progress', street_id: 'st-1', tag_id: 'tg-1', from_m: 10, to_m: 100, dispatch_ids: ['d1', 'd2'], entry_id: entry.entradaId, device_at: entry.horaDelEquipo, forms: 3 });
    expect(workProgressRequest({ ...entry, etiquetaId: undefined, partidaId: 'pa-1' })).toMatchObject({ partida_id: 'pa-1' });
  });
});

describe('sendWorkProgress', () => {
  it('opens, sends the note and says what Portal answered', async () => {
    // Arrange
    const deps = depsWith(answered('Avance registrado: 90 m, pendiente de aprobación.'));
    // Act
    const result = await sendWorkProgress(deps, entry);
    // Assert
    expect(deps.submit).toHaveBeenCalledWith('cmd-1', { nota: 'Tramo de la mañana' });
    expect(result).toEqual({ ok: true, message: 'Avance registrado: 90 m, pendiente de aprobación.' });
  });

  it('without a text it still says the progress waits for approval', async () => {
    const result = await sendWorkProgress(depsWith(answered('')), { ...entry, nota: undefined });
    expect(result).toEqual({ ok: true, message: PROGRESS_SENT });
  });

  it('the same entry sent again is no failure: agentes answers it as text (07/11)', async () => {
    const result = await sendWorkProgress(depsWith(answered('Ya estaba registrado.')), entry);
    expect(result).toEqual({ ok: true, message: 'Ya estaba registrado.' });
  });

  it('says why when Portal, agentes or the server refuse it', async () => {
    expect(await sendWorkProgress(depsWith({ ok: false, errors: { _: 'Por ahora solo un admin del espacio registra avance de obra.' } }), entry)).toEqual({ ok: false, message: 'Por ahora solo un admin del espacio registra avance de obra.' });
    expect(await sendWorkProgress(depsWith(answered(''), { ok: false, message: 'Esas unidades no salen en el detalle del servicio. Abre el mapa de nuevo.' }), entry)).toEqual({ ok: false, message: 'Esas unidades no salen en el detalle del servicio. Abre el mapa de nuevo.' });
    expect((await sendWorkProgress(depsWith({ ok: false, status: 429, errors: { _: 'Demasiadas llamadas.' }, code: 'rate_limited', retryAfterS: 12 }), entry)).message).toBe('Demasiadas llamadas. Espera 12 s y vuelve a confirmar.');
  });

  it('a late answer is read from the notice', async () => {
    const deps = { ...depsWith({ ok: true, outcome: { ...form, outcome: 'pending' } as CommandOutcome }), notice: vi.fn(async () => ({ response: { responseType: 'ephemeral', text: 'Avance registrado.' } })) } as WorkProgressDeps;
    expect(await sendWorkProgress(deps, entry)).toEqual({ ok: true, message: 'Avance registrado.' });
  });
});
