import { describe, expect, it, vi } from 'vitest';
import { answeredSince, channelButtonRows, channelLinksOf, chatHasActionPlace, commandToWrite, evidenceLine, formSubmitOutcome, geoPointOf, linkActionOf, serviceValuesOf, photoStampLines, placedActionRow, precisionLabel, quickActionRows, shortcutRows, shortcutValuesOf, submitLabelOf } from './appActions.js';
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

  it('«Crear un cliente» lives in the clients\' picker, not in the ⚡ (José 30/10); the picker finds it only when it is on for that person', () => {
    // Arrange
    const withCreate: CommandGroup[] = [{ ...groups[1], shortcuts: [{ key: 'crear_cliente', name: 'Crear un cliente' }, { key: 'crear_pedido', name: 'Crear un pedido' }] }];
    // Act / Assert
    expect(quickActionRows(withCreate).map((row) => row.key)).toEqual(['crear_pedido', 'pedidos']);
    expect(placedActionRow(withCreate, 'crear_cliente')).toMatchObject({ kind: 'shortcut', appName: 'Portal', name: 'Crear un cliente' });
    expect(placedActionRow(groups, 'crear_cliente')).toBeUndefined();
  });

  it('a command whose name matches a placed action stays in the ⚡: only actions have their own place', () => {
    const commandOnly: CommandGroup[] = [{ appId: 'a2', appName: 'Portal', commands: [{ command: 'crear_cliente', description: 'Crear' }] }];
    expect(quickActionRows(commandOnly).map((row) => row.name)).toEqual(['/crear_cliente']);
  });
});

describe('the ⚡ of a chat (R31/10: since the clip lost the actions, a chat\'s own had no place)', () => {
  it('a channel of a space and the chat with an app can have actions; a person\'s 1:1 and a personal chat never', () => {
    // Arrange
    const channel = { workspaceId: 's1', isGroup: true };
    const appChat = { workspaceId: 's1', isGroup: false, appId: 'a1' };
    const personInSpace = { workspaceId: 's1', isGroup: false };
    const groupOutsideSpace = { workspaceId: null, isGroup: true };
    // Act / Assert
    expect(chatHasActionPlace(channel)).toBe(true);
    expect(chatHasActionPlace(appChat)).toBe(true);
    expect(chatHasActionPlace(personInSpace)).toBe(false);
    expect(chatHasActionPlace(groupOutsideSpace)).toBe(false);
  });

  it('a chat\'s ⚡ is one list: the actions and then the commands, without the ones with a place of their own', () => {
    // Arrange
    const withCreate: CommandGroup[] = [...groups, { appId: 'a3', appName: 'Portal', commands: [{ command: 'pedidos', description: 'Pedidos', usageHint: '[cliente]' }], shortcuts: [{ key: 'crear_cliente', name: 'Crear un cliente' }, { key: 'registrar_consumo', name: 'Registrar consumo' }] }];
    // Act
    const rows = quickActionRows(withCreate).filter((row) => row.appId === 'a3');
    // Assert
    expect(rows.map((row) => [row.kind, row.key])).toEqual([['shortcut', 'registrar_consumo'], ['command', 'pedidos']]);
    expect(rows[1]).toMatchObject({ name: '/pedidos', usageHint: '[cliente]' });
  });

  it('a command that needs its text goes to the field; one that does not runs from the ⚡', () => {
    // Arrange
    const row = { appId: 'a3', appName: 'Portal', key: 'pedidos', name: '/pedidos' };
    // Act and assert
    expect(commandToWrite({ ...row, kind: 'command', usageHint: '[cliente]' })).toBe('/pedidos ');
    expect(commandToWrite({ ...row, kind: 'command' })).toBeNull();
    expect(commandToWrite({ ...row, kind: 'shortcut', usageHint: '[cliente]' })).toBeNull();
  });

  it('no groups yet, or apps with nothing here: no rows, so no ⚡', () => {
    expect(quickActionRows([])).toEqual([]);
    expect(quickActionRows([{ appId: 'a2', appName: 'Portal', commands: [], shortcuts: [] }])).toEqual([]);
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
    expect(evidenceLine([{ ...photo, multiple: true, max: 6 }])).toBe('Se registra con las fotos');
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
  it('with an address it burns the address, not the coordinates (José 06/11)', () => {
    // Arrange
    const location = { lat: -12.0464, lng: -77.0428, precision: 12 };
    // Act
    const lines = photoStampLines({ at: new Date('2026-11-06T17:38:00.000Z'), location, place: 'Avenida Alfonso Ugarte 123, Breña, Lima' });
    // Assert
    expect(lines[1]).toBe('Avenida Alfonso Ugarte 123, Breña, Lima · ± 12 m');
  });

  it('a long address is cut at a word, keeping the precision in sight', () => {
    // Arrange
    const place = 'Avenida Nicolás de Piérola 1234, Cercado de Lima, Provincia de Lima, Lima Metropolitana';
    // Act
    const lines = photoStampLines({ at: new Date('2026-11-06T17:38:00.000Z'), location: { lat: -12.05, lng: -77.04, precision: 8 }, place });
    // Assert
    expect(lines[1].endsWith('… · ± 8 m')).toBe(true);
    expect(lines[1].length).toBeLessThanOrEqual(56);
  });

  it('without a location it says so, and an unknown zone falls back to Lima', () => {
    const lines = photoStampLines({ at: new Date('2026-10-24T05:05:00.000Z'), timeZone: 'Mars/Olympus' });
    expect(lines).toEqual(['sáb 24/10/2026 · 00:05', 'Sin ubicación']);
  });
});

describe('a link from a client\'s channel (José 31/10: «crear el enlace del pedido, del servicio o del cliente»)', () => {
  const portal: CommandGroup[] = [{ appId: 'p1', appName: 'Portal', commands: [], shortcuts: [{ key: 'crear_enlace_cliente', name: 'Crear enlace' }, { key: 'crear_enlace_de_servicio', name: 'Enlace del servicio' }] }];
  const actions = channelButtonRows(portal);

  it('the client\'s and an order\'s run Portal\'s «crear_enlace_cliente» with what it already knows; a service\'s, «crear_enlace_de_servicio»', () => {
    // Act
    const client = linkActionOf(actions, { kind: 'client', clientId: 'cli-1' });
    const order = linkActionOf(actions, { kind: 'order', clientId: 'cli-1', orderId: 'o-7' });
    const service = linkActionOf(actions, { kind: 'service', clientId: 'cli-1', serviceId: 'srv-3' });
    // Assert
    expect(client).toEqual({ row: expect.objectContaining({ appId: 'p1', key: 'crear_enlace_cliente' }), values: { alcance: 'cliente', clienteId: 'cli-1' } });
    expect(order?.values).toEqual({ alcance: 'pedido', clienteId: 'cli-1', pedidoId: 'o-7' });
    // Agentes 31/10: a service's link needs only the service; an order's client is checked by Portal.
    expect(service).toEqual({ row: expect.objectContaining({ key: 'crear_enlace_de_servicio' }), values: { servicioId: 'srv-3' } });
  });

  it('the buttons: which show, and a tap runs the action with its values', () => {
    // Arrange
    const run = vi.fn();
    const links = channelLinksOf(channelButtonRows([{ ...portal[0]!, shortcuts: [{ key: 'crear_enlace_cliente', name: 'Crear enlace' }] }]), run);
    // Act
    links.open({ kind: 'order', clientId: 'cli-1', orderId: 'o-7' });
    links.open({ kind: 'service', clientId: 'cli-1', serviceId: 'srv-3' });
    // Assert
    expect([links.can('client'), links.can('order'), links.can('service')]).toEqual([true, true, false]);
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(expect.objectContaining({ key: 'crear_enlace_cliente' }), { alcance: 'pedido', clienteId: 'cli-1', pedidoId: 'o-7' });
  });

  it('nothing to tap while that person may not use the action (the server leaves it out)', () => {
    // Act
    const onlyShare = channelButtonRows([{ ...portal[0]!, shortcuts: [{ key: 'crear_enlace_de_servicio', name: 'Enlace del servicio' }] }]);
    // Assert
    expect(linkActionOf(onlyShare, { kind: 'client', clientId: 'cli-1' })).toBeNull();
    expect(linkActionOf([], { kind: 'service', clientId: 'cli-1', serviceId: 'srv-3' })).toBeNull();
  });
});

describe('the service report and the payment (agentes 31/10: informe_de_servicio, registrar_pago)', () => {
  it('a payment or a service report opens with the service; from an order it is that order\'s service (no pedidoId in this version)', () => {
    expect(serviceValuesOf('srv-3')).toEqual({ servicioId: 'srv-3' });
  });

  it('answeredSince: the answers that came back since the last look, once each; a form or a failure is not a payment', () => {
    // Arrange
    const base = { appName: 'Portal', command: '' };
    const answers = [{ ...base, commandId: 'c1', state: 'answered' as const }, { ...base, commandId: 'c2', state: 'form' as const }, { ...base, commandId: 'c3', state: 'failed' as const }];
    // Act
    const first = answeredSince(answers, new Set());
    const again = answeredSince(answers, new Set(['c1']));
    // Assert
    expect(first).toEqual(['c1']);
    expect(again).toEqual([]);
  });
});

describe('shortcutValuesOf (what an action carries already filled in)', () => {
  it('absent or empty is nothing; short texts, numbers and yes/no pass', () => {
    expect(shortcutValuesOf(undefined)).toBeUndefined();
    expect(shortcutValuesOf({})).toBeUndefined();
    expect(shortcutValuesOf({ alcance: 'pedido', dias: 7, activo: true })).toEqual({ alcance: 'pedido', dias: 7, activo: true });
  });

  it('anything else is refused: a list, a nested object, a long text, a bad key, too many keys, NaN', () => {
    expect(shortcutValuesOf(['a'])).toBeNull();
    expect(shortcutValuesOf({ a: { b: 1 } })).toBeNull();
    expect(shortcutValuesOf({ a: 'x'.repeat(201) })).toBeNull();
    expect(shortcutValuesOf({ 'no válida': 'x' })).toBeNull();
    expect(shortcutValuesOf(Object.fromEntries(Array.from({ length: 11 }, (_, index) => [`k${index}`, index])))).toBeNull();
    expect(shortcutValuesOf({ n: Number.NaN })).toBeNull();
  });
});

describe('the client\'s channel buttons stay out of the ⚡ (José 01/11)', () => {
  const portal: CommandGroup[] = [{ appId: 'p1', appName: 'Portal', commands: [], shortcuts: [{ key: 'crear_enlace_cliente', name: 'Crear enlace' }, { key: 'registrar_pago', name: 'Registrar pago' }, { key: 'informe_de_servicio', name: 'Informe' }, { key: 'registrar_consumo', name: 'Registrar consumo' }] }];

  it('the ⚡ of the space and of a chat leave them out: each one has its button', () => {
    // Act / Assert
    expect(quickActionRows(portal).map((row) => row.key)).toEqual(['registrar_consumo']);
      });

  it('the buttons read them from their own list, and the payment still finds its row', () => {
    // Act
    const buttons = channelButtonRows(portal);
    // Assert
    expect(buttons.map((row) => row.key)).toEqual(['crear_enlace_cliente', 'registrar_pago', 'informe_de_servicio']);
    expect(channelLinksOf(buttons, vi.fn()).can('order')).toBe(true);
    expect(placedActionRow(portal, 'registrar_pago')).toMatchObject({ key: 'registrar_pago' });
    expect(placedActionRow(portal, 'informe_de_servicio')).toMatchObject({ key: 'informe_de_servicio' });
  });
});
