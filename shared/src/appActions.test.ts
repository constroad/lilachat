import { describe, expect, it } from 'vitest';
import { evidenceLine, formSubmitOutcome, geoPointOf, photoStampLines, precisionLabel, quickActionRows, shortcutRows, submitLabelOf } from './appActions.js';
import type { FormField } from './appForms.js';
import type { CommandGroup, CommandOutcome } from './botCommands.js';

/** The actions of the apps (R160, designs e-29 and e-30) and what sending a form leaves on screen. */
const groups: CommandGroup[] = [
  { appId: 'a1', appName: 'Inframaq', avatarUrl: 'https://agentes.example.com/i.png', commands: [], shortcuts: [{ key: 'marcar_asistencia', name: 'Marcar asistencia' }, { key: 'medir_tanque', name: 'Medir tanque', description: 'Nivel en cm' }] },
  { appId: 'a2', appName: 'Portal', commands: [{ command: 'pedidos', description: 'Pedidos' }], shortcuts: [] },
];
const base = { commandId: 'c1', appId: 'a1', appName: 'Inframaq' };

describe('the rows of «Acciones rápidas»', () => {
  it('one per action, with its app and avatar, in the apps\' order; an app with only commands adds none', () => {
    expect(shortcutRows(groups)).toEqual([
      { kind: 'shortcut', appId: 'a1', appName: 'Inframaq', avatarUrl: 'https://agentes.example.com/i.png', key: 'marcar_asistencia', name: 'Marcar asistencia' },
      { kind: 'shortcut', appId: 'a1', appName: 'Inframaq', avatarUrl: 'https://agentes.example.com/i.png', key: 'medir_tanque', name: 'Medir tanque', description: 'Nivel en cm' },
    ]);
    expect(shortcutRows([{ appId: 'a3', appName: 'Vieja', commands: [] }])).toEqual([]);
  });

  it('the space\'s ⚡ also lists the commands made global, as «/command»', () => {
    expect(quickActionRows(groups).map((row) => [row.kind, row.name])).toEqual([['shortcut', 'Marcar asistencia'], ['shortcut', 'Medir tanque'], ['command', '/pedidos']]);
  });
});

describe('the location of a form', () => {
  it('rounds the precision to whole meters, never below 1, and says it as «± N m»', () => {
    const point = geoPointOf({ latitude: -11.98123, longitude: -76.95456, accuracy: 6.4 });
    expect(point).toEqual({ lat: -11.98123, lng: -76.95456, precision: 6 });
    expect(precisionLabel(geoPointOf({ latitude: 0, longitude: 0, accuracy: 0.2 }))).toBe('± 1 m');
    expect(precisionLabel({ lat: 0, lng: 0, precision: 1500 })).toBe('± 1,5 km');
  });
});

describe('what sending a form leaves on screen', () => {
  it('the app\'s answer replaces the form; one posted in the channel just closes it; a slow one waits', () => {
    const answered: CommandOutcome = { ...base, outcome: 'ephemeral', response: { responseType: 'ephemeral', text: 'Ingreso marcado · 07:12', shareable: false } };
    expect(formSubmitOutcome({ ok: true, outcome: answered }, 'Marcar asistencia')).toEqual({ done: true, answer: { commandId: 'c1', appName: 'Inframaq', command: 'Marcar asistencia', state: 'answered', response: answered.response } });
    expect(formSubmitOutcome({ ok: true, outcome: { ...base, outcome: 'posted' } }, 'x')).toEqual({ done: true, answer: null });
    // Answered later by /respond: the form stays open, «Enviando…» (consensus with agentes and Inframaq, 24/10).
    expect(formSubmitOutcome({ ok: true, outcome: { ...base, outcome: 'pending' } }, 'x')).toEqual({ done: false, errors: {}, waiting: true });
  });

  it('errors by field, a failed app or a refusal keep the form open with what to fix', () => {
    expect(formSubmitOutcome({ ok: false, errors: { accion: 'Ya marcaste ingreso hoy.' } }, 'x')).toEqual({ done: false, errors: { accion: 'Ya marcaste ingreso hoy.' } });
    expect(formSubmitOutcome({ ok: true, outcome: { ...base, outcome: 'failed', message: 'Inframaq no pudo responder.' } }, 'x')).toEqual({ done: false, errors: {}, message: 'Inframaq no pudo responder.' });
    expect(formSubmitOutcome({ ok: false, message: 'Pasaron más de 15 minutos: vuelve a abrir el formulario.' }, 'x')).toEqual({ done: false, errors: {}, message: 'Pasaron más de 15 minutos: vuelve a abrir el formulario.' });
  });
});

describe('the button and the foot of a form (design e-28)', () => {
  const choice: FormField = { kind: 'choice', name: 'accion', label: 'Acción', required: true, segmented: true, options: [{ value: 'ingreso', label: 'Ingreso' }, { value: 'salida', label: 'Salida' }] };
  const photo: FormField = { kind: 'photo', name: 'foto', label: 'Selfie', required: true, multiple: false, max: 1, min: 1 };
  const location: FormField = { kind: 'location', name: 'ubicacion', label: 'Tu ubicación', required: true };

  it('a signature says what it signs: «Marcar» + the option chosen, «Marcar ingreso»; without a label, «Enviar»', () => {
    expect(submitLabelOf({ submitLabel: 'Marcar' }, [choice, location, photo], { accion: 'ingreso' })).toBe('Marcar ingreso');
    expect(submitLabelOf({ submitLabel: 'Marcar' }, [choice], {})).toBe('Marcar');
    expect(submitLabelOf({}, [photo], {})).toBe('Enviar');
  });

  it('a form that is not a signature keeps its button as the app wrote it (E2E 24/10: «Registrar una medida de tanque medida»)', () => {
    expect(submitLabelOf({ submitLabel: 'Registrar una medida de tanque' }, [choice, photo], { accion: 'ingreso' })).toBe('Registrar una medida de tanque');
  });

  it('says what goes with it: the location and the photo', () => {
    expect(evidenceLine([choice, location, photo])).toBe('Se registra con tu ubicación y tu foto');
    expect(evidenceLine([location])).toBe('Se registra con tu ubicación');
    expect(evidenceLine([photo])).toBe('Se registra con tu foto');
    expect(evidenceLine([choice])).toBe('');
  });
});

describe('photoStampLines (pending 94: date, time and place burned into the selfie)', () => {
  it('says the day and the hour where the space is, and where the person stood', () => {
    // Arrange: 23:51 UTC is 18:51 in Lima.
    const at = new Date('2026-10-23T23:51:00.000Z');
    // Act
    const lines = photoStampLines({ at, timeZone: 'America/Lima', location: { lat: -11.98123456, lng: -76.954512, precision: 5 } });
    // Assert
    expect(lines).toEqual(['vie 23/10/2026 · 18:51', '-11.98123, -76.95451 · ± 5 m']);
  });
  it('without a location it says so, and an unknown zone falls back to Lima', () => {
    const lines = photoStampLines({ at: new Date('2026-10-24T05:05:00.000Z'), timeZone: 'Mars/Olympus' });
    expect(lines).toEqual(['sáb 24/10/2026 · 00:05', 'Sin ubicación']);
  });
});
