import { describe, expect, it } from 'vitest';
import { evidenceLine, formSubmitOutcome, geoPointOf, precisionLabel, quickActionRows, shortcutRows, submitLabelOf } from './appActions.js';
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
    expect(formSubmitOutcome({ ok: true, outcome: { ...base, outcome: 'pending' } }, 'x')).toMatchObject({ done: true, answer: { state: 'pending' } });
  });

  it('errors by field, a failed app or a refusal keep the form open with what to fix', () => {
    expect(formSubmitOutcome({ ok: false, errors: { accion: 'Ya marcaste ingreso hoy.' } }, 'x')).toEqual({ done: false, errors: { accion: 'Ya marcaste ingreso hoy.' } });
    expect(formSubmitOutcome({ ok: true, outcome: { ...base, outcome: 'failed', message: 'Inframaq no pudo responder.' } }, 'x')).toEqual({ done: false, errors: {}, message: 'Inframaq no pudo responder.' });
    expect(formSubmitOutcome({ ok: false, message: 'Pasaron más de 15 minutos: vuelve a abrir el formulario.' }, 'x')).toEqual({ done: false, errors: {}, message: 'Pasaron más de 15 minutos: vuelve a abrir el formulario.' });
  });
});

describe('the button and the foot of a form (design e-28)', () => {
  const choice: FormField = { kind: 'choice', name: 'accion', label: 'Acción', required: true, segmented: true, options: [{ value: 'ingreso', label: 'Ingreso' }, { value: 'salida', label: 'Salida' }] };
  const photo: FormField = { kind: 'photo', name: 'foto', label: 'Selfie', required: true };
  const location: FormField = { kind: 'location', name: 'ubicacion', label: 'Tu ubicación', required: true };

  it('«Marcar» + the option chosen in the first segmented choice: «Marcar ingreso»; without a label, «Enviar»', () => {
    expect(submitLabelOf({ submitLabel: 'Marcar' }, [choice, photo], { accion: 'ingreso' })).toBe('Marcar ingreso');
    expect(submitLabelOf({ submitLabel: 'Marcar' }, [choice], {})).toBe('Marcar');
    expect(submitLabelOf({}, [photo], {})).toBe('Enviar');
  });

  it('says what goes with it: the location and the photo', () => {
    expect(evidenceLine([choice, location, photo])).toBe('Se registra con tu ubicación y tu foto');
    expect(evidenceLine([location])).toBe('Se registra con tu ubicación');
    expect(evidenceLine([photo])).toBe('Se registra con tu foto');
    expect(evidenceLine([choice])).toBe('');
  });
});
