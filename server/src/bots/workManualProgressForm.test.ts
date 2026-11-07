import { describe, expect, it } from 'vitest';
import { workManualProgressInputOf, workManualProgressPrepared } from './workManualProgressForm.js';

/** Design o-06 through the door (Portal 57f06ec7): a stretch without units, with photos of the service's Drive. */
const ENTRY = '0b7e7d0e-6a8f-4c3b-9d2e-1f2a3b4c5d6e';
const MEDIA = '6aef8d455e4b25190f7c3177';
const SERVICE = 'srv-318';
const raw = { kind: 'work_manual_progress', street_id: 'st-1', tag_id: 'tg-1', from_m: 120, to_m: 240, entry_id: ENTRY, device_at: '2026-11-07T15:00:00.000Z', photo_ids: [MEDIA, MEDIA] };

describe('manual progress through the door', () => {
  it('opens Portal\'s tool with the stretch, the phone\'s hour and the photos, asking only for the note', () => {
    // Act
    const input = workManualProgressInputOf(raw);
    // Assert
    expect(input).not.toBeNull();
    const { form, context } = workManualProgressPrepared(SERVICE, input!);
    expect(form).toMatchObject({ id: 'registrar_avance_manual_de_obra', schema: { properties: { nota: { type: 'string' } } } });
    expect(context).toEqual({ servicioId: SERVICE, calleId: 'st-1', etiquetaId: 'tg-1', desdeM: 120, hastaM: 240, entradaId: ENTRY, horaDelEquipo: '2026-11-07T15:00:00.000Z', fotoIds: [MEDIA] });
  });

  it('without photos it leaves the key out; a partida goes as partidaId', () => {
    const input = workManualProgressInputOf({ ...raw, tag_id: undefined, partida_id: 'pt-1', photo_ids: undefined });
    const { context } = workManualProgressPrepared(SERVICE, input!);
    expect(context).toMatchObject({ partidaId: 'pt-1' });
    expect(context).not.toHaveProperty('fotoIds');
  });

  it.each([
    ['a photo that is not a Drive id', { photo_ids: ['../x'] }],
    ['more than six photos', { photo_ids: Array.from({ length: 7 }, (_, index) => `6aef8d455e4b25190f7c317${index}`) }],
    ['an end before the start', { to_m: 100 }],
    ['both a tag and a partida', { partida_id: 'pt-1' }],
    ['no entry', { entry_id: 'x' }],
    ['no hour', { device_at: 'ayer' }],
  ])('refuses %s', (_, change) => {
    expect(workManualProgressInputOf({ ...raw, ...change })).toBeNull();
  });
});
