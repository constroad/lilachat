import { describe, expect, it } from 'vitest';
import { answerOfOutcome, COMMAND_LIMITS, formKeyOf, giveUpPending, commandOf, matchCommands, replaceAnswer, sharedByLine, validateFormReply, parseSlashInput, slashQuery, validateBotCommands, validateCommandResponse, withAnswer, withNotice, type CommandGroup } from './botCommands.js';

/** The slash commands contract, `specs/BOTS-API.spec.md` §c. */
describe('command registry', () => {
  it('keeps name, description and usage hint, trimmed', () => {
    const result = validateBotCommands({ commands: [{ command: 'clima', description: '  Clima de hoy en la planta ', usage_hint: '[distrito]' }] });
    expect(result).toEqual({ ok: true, commands: [{ command: 'clima', description: 'Clima de hoy en la planta', usageHint: '[distrito]' }] });
  });

  it('an empty list unregisters every command', () => {
    expect(validateBotCommands({ commands: [] })).toEqual({ ok: true, commands: [] });
  });

  it('refuses a body without the list', () => {
    expect(validateBotCommands({})).toEqual({ ok: false, message: 'Falta «commands»: la lista de comandos de la app.' });
  });

  it('refuses names with uppercase, a slash, spaces or too short', () => {
    for (const command of ['Clima', '/clima', 'mi clima', 'c', '1clima', `a${'b'.repeat(COMMAND_LIMITS.name)}`]) {
      const result = validateBotCommands({ commands: [{ command, description: 'x' }] });
      expect(result.ok, command).toBe(false);
    }
  });

  it('refuses a repeated command and a missing description', () => {
    expect(validateBotCommands({ commands: [{ command: 'clima', description: 'a' }, { command: 'clima', description: 'b' }] })).toEqual({ ok: false, message: 'El comando «/clima» está repetido.' });
    expect(validateBotCommands({ commands: [{ command: 'clima' }] })).toEqual({ ok: false, message: '«/clima» necesita una descripción.' });
  });

  it('caps the list and cuts long texts', () => {
    const many = Array.from({ length: COMMAND_LIMITS.commands + 1 }, (_, index) => ({ command: `c${index}x`, description: 'x' }));
    expect(validateBotCommands({ commands: many })).toEqual({ ok: false, message: `Una app registra hasta ${COMMAND_LIMITS.commands} comandos.` });
    const long = validateBotCommands({ commands: [{ command: 'clima', description: 'd'.repeat(300), usage_hint: 'u'.repeat(300) }] });
    expect(long.ok && long.commands[0].description.length).toBe(COMMAND_LIMITS.description);
    expect(long.ok && long.commands[0].usageHint?.length).toBe(COMMAND_LIMITS.usageHint);
  });
});

describe('command response', () => {
  it('ephemeral by default, with text or a card', () => {
    expect(validateCommandResponse({ text: 'Lurín: 24 °C' })).toEqual({ ok: true, response: { responseType: 'ephemeral', text: 'Lurín: 24 °C' } });
    const withCard = validateCommandResponse({ response_type: 'in_channel', card: { title: 'Clima de hoy' } });
    expect(withCard.ok && withCard.response.responseType).toBe('in_channel');
    expect(withCard.ok && withCard.response.card?.title).toBe('Clima de hoy');
  });

  it('refuses an empty answer and a broken card', () => {
    expect(validateCommandResponse({})).toEqual({ ok: false, message: 'La respuesta lleva «text» o «card».' });
    expect(validateCommandResponse({ card: { title: '' } }).ok).toBe(false);
  });

  it('an unknown response type falls back to ephemeral (only the asker sees it)', () => {
    const result = validateCommandResponse({ response_type: 'broadcast', text: 'hola' });
    expect(result.ok && result.response.responseType).toBe('ephemeral');
  });
});

describe('composer', () => {
  it('reads the command and the rest of the line', () => {
    expect(parseSlashInput('/clima lurin norte')).toEqual({ command: 'clima', text: 'lurin norte' });
    expect(parseSlashInput('/clima')).toEqual({ command: 'clima', text: '' });
    expect(parseSlashInput('  /Clima  ')).toEqual({ command: 'clima', text: '' });
  });

  it('a normal message, a path or a lone slash is not a command', () => {
    for (const text of ['hola', 'ver /clima', '/', '/ clima', '//clima', 'https://x.com/a']) expect(parseSlashInput(text), text).toBeNull();
  });

  it('suggests only while the name is being typed', () => {
    expect(slashQuery('/')).toBe('');
    expect(slashQuery('/cl')).toBe('cl');
    expect(slashQuery('/clima ')).toBeNull();
    expect(slashQuery('hola /cl')).toBeNull();
  });

  const groups: CommandGroup[] = [
    { appId: 'inframaq', appName: 'Inframaq', commands: [{ command: 'tanques', description: 'Nivel de los tanques' }, { command: 'clima', description: 'Clima de la planta' }] },
    { appId: 'portal', appName: 'Portal', commands: [{ command: 'asistencia', description: 'Quién marcó hoy' }, { command: 'pedido-clima', description: 'Pedido con clima' }] },
  ];

  it('an empty query lists every app with its commands', () => {
    expect(matchCommands(groups, '')).toEqual(groups);
  });

  it('prefix matches first, then the ones that contain it; empty apps drop out', () => {
    const result = matchCommands(groups, 'cl');
    expect(result.map((group) => [group.appName, group.commands.map((command) => command.command)])).toEqual([
      ['Inframaq', ['clima']],
      ['Portal', ['pedido-clima']],
    ]);
    expect(matchCommands(groups, 'asis').map((group) => group.appName)).toEqual(['Portal']);
    expect(matchCommands(groups, 'zzz')).toEqual([]);
  });
});

describe('ephemeral answers', () => {
  const base = { commandId: 'c1', appId: 'a1', appName: 'Inframaq' };

  it('an outcome becomes what the asker sees; a posted answer is already in the chat', () => {
    expect(answerOfOutcome({ ...base, outcome: 'ephemeral', response: { responseType: 'ephemeral', text: '24 °C' } }, 'clima')).toEqual({ commandId: 'c1', appName: 'Inframaq', command: 'clima', state: 'answered', response: { responseType: 'ephemeral', text: '24 °C' } });
    expect(answerOfOutcome({ ...base, outcome: 'pending' }, 'clima')?.state).toBe('pending');
    expect(answerOfOutcome({ ...base, outcome: 'failed' }, 'clima')?.message).toBe('Inframaq no pudo responder.');
    expect(answerOfOutcome({ ...base, outcome: 'posted' }, 'clima')).toBeNull();
  });

  it('the late answer replaces its pending one, keeps the command, and only the last three stay', () => {
    let list = withAnswer([], answerOfOutcome({ ...base, outcome: 'pending' }, 'clima')!);
    list = withNotice(list, { chatId: 'x', commandId: 'c1', appId: 'a1', appName: 'Inframaq', response: { responseType: 'ephemeral', text: 'listo' } });
    expect(list).toEqual([{ commandId: 'c1', appName: 'Inframaq', command: 'clima', state: 'answered', response: { responseType: 'ephemeral', text: 'listo' } }]);
    for (const id of ['c2', 'c3', 'c4']) list = withAnswer(list, { commandId: id, appName: 'Portal', command: 'asistencia', state: 'pending' });
    expect(list.map((entry) => entry.commandId)).toEqual(['c2', 'c3', 'c4']);
  });

  it('a notice for a dismissed command still shows up, without its name', () => {
    expect(withNotice([], { chatId: 'x', commandId: 'c9', appId: 'a1', appName: 'Inframaq', response: { responseType: 'ephemeral', text: 'tarde' } })[0]).toMatchObject({ commandId: 'c9', command: '', state: 'answered' });
  });
});

describe('commandOf', () => {
  const groups: CommandGroup[] = [{ appId: 'a1', appName: 'Inframaq', commands: [{ command: 'clima', description: 'Clima' }] }];
  it('the app whose command the line is, with its text; a slash nobody has, or plain text, is not a command', () => {
    expect(commandOf(groups, '/Clima lurín')).toEqual({ appId: 'a1', command: 'clima', text: 'lurín' });
    expect(commandOf(groups, '/otra cosa')).toBeNull();
    expect(commandOf(groups, 'hola /clima')).toBeNull();
    expect(commandOf([], '/clima')).toBeNull();
  });
});

describe('sharedByLine', () => {
  it('who sent the answer and with which command', () => {
    expect(sharedByLine({ name: 'José Zamora', command: 'clima' })).toBe('José Zamora usó /clima');
  });
});

describe('a «working…» card always ends (José, 23/10: «se queda congelado Inframaq está trabajando»)', () => {
  const pending = { commandId: 'c9', appName: 'Inframaq', command: 'clima', state: 'pending' as const };
  it('a late answer posted in the channel removes the card instead of leaving it', () => {
    const notice = { chatId: 'g1', commandId: 'c9', appId: 'a1', appName: 'Inframaq', response: { responseType: 'in_channel' as const, text: 'Ate: 24 °C' }, posted: true as const };
    expect(withNotice([pending], notice)).toEqual([]);
  });
  it('after the wait it says the app did not answer; an answer already there is not touched', () => {
    expect(giveUpPending([pending], 'c9')).toEqual([{ ...pending, state: 'failed', message: 'Inframaq no respondió a tiempo. Vuelve a intentarlo.' }]);
    const answered = { ...pending, state: 'answered' as const, response: { responseType: 'ephemeral' as const, text: 'ok' } };
    expect(giveUpPending([answered], 'c9')).toEqual([answered]);
  });
});

describe('replaceAnswer (the «working…» card while the command leaves)', () => {
  const sending = { commandId: 'sending-1', appName: 'Inframaq', command: 'clima', state: 'pending' as const };
  const other = { commandId: 'c0', appName: 'Portal', command: 'asistencia', state: 'answered' as const, response: { responseType: 'ephemeral' as const, text: 'ok' } };
  it('the server\'s answer takes the placeholder\'s place; a post in the channel just removes it', () => {
    const answered = { commandId: 'c9', appName: 'Inframaq', command: 'clima', state: 'answered' as const, response: { responseType: 'ephemeral' as const, text: '24 °C' } };
    expect(replaceAnswer([sending, other], 'sending-1', answered).map((one) => one.commandId)).toEqual(['c9', 'c0']);
    expect(replaceAnswer([sending, other], 'sending-1', null).map((one) => one.commandId)).toEqual(['c0']);
  });
  it('a placeholder already dismissed: the answer still arrives at the end', () => {
    expect(replaceAnswer([other], 'sending-1', { ...sending, commandId: 'c9' }).map((one) => one.commandId)).toEqual(['c0', 'c9']);
  });
  it('a late «failed» or «pending» from the request never hides the answer the socket already brought (José, 23/10: red under /asistencia)', () => {
    // Arrange: the app answered by /respond before its webhook call came back.
    const viaSocket = { commandId: 'c9', appName: 'Inframaq', command: 'mantenimiento', state: 'answered' as const, response: { responseType: 'ephemeral' as const, text: 'Inframaq no lo permitió' } };
    const failed = { commandId: 'c9', appName: 'Inframaq', command: 'mantenimiento', state: 'failed' as const, message: 'Inframaq no pudo responder.' };
    // Act
    const afterFailed = replaceAnswer([sending, viaSocket], 'sending-1', failed);
    const afterPending = replaceAnswer([sending, viaSocket], 'sending-1', { ...failed, state: 'pending' as const });
    // Assert
    expect(afterFailed).toEqual([viaSocket]);
    // The socket did not know the command's name: the request's outcome gives it.
    expect(replaceAnswer([sending, { ...viaSocket, command: '' }], 'sending-1', failed)).toEqual([viaSocket]);
    expect(afterPending).toEqual([viaSocket]);
  });
});

describe('answers that open a form or must not be shared (R160)', () => {
  const form = { id: 'registrar_marca', title: 'Marcar asistencia', schema: { type: 'object', properties: { accion: { type: 'string', enum: ['ingreso', 'salida'] } }, required: ['accion'] } };
  it('response_type form carries the checked form; a broken one is refused', () => {
    const valid = validateCommandResponse({ response_type: 'form', form });
    expect(valid.ok && valid.response).toMatchObject({ responseType: 'form', form: { id: 'registrar_marca', title: 'Marcar asistencia' } });
    expect(validateCommandResponse({ response_type: 'form', form: { ...form, title: '' } }).ok).toBe(false);
    expect(answerOfOutcome({ commandId: 'c1', appId: 'a1', appName: 'Inframaq', outcome: 'form', response: valid.ok ? valid.response : undefined }, 'asistencia')).toMatchObject({ state: 'form' });
  });

  it('a form keeps the text that comes with it and the schema\'s description as its intro (agentes, «Conecta tu cuenta»)', () => {
    // Arrange
    const body = { response_type: 'form', text: 'Inframaq no te reconoce todavía.', form: { ...form, schema: { ...form.schema, description: 'Una sola vez, con tu correo o tu WhatsApp.' } } };
    // Act
    const valid = validateCommandResponse(body);
    // Assert
    expect(valid.ok && valid.response).toMatchObject({ responseType: 'form', text: 'Inframaq no te reconoce todavía.', form: { intro: 'Una sola vez, con tu correo o tu WhatsApp.' } });
  });

  it('the next form of the same command gets its own key, so its sheet starts clean', () => {
    const first = { commandId: 'c1', response: { responseType: 'form' as const, form: { id: 'cuenta_destino', title: 'A', schema: {} } } };
    const second = { commandId: 'c1', response: { responseType: 'form' as const, form: { id: 'cuenta_codigo', title: 'B', schema: {} } } };
    expect(formKeyOf(first)).not.toBe(formKeyOf(second));
    expect(formKeyOf({ commandId: 'c1' })).toBe('c1:');
  });

  it('shareable false is kept, and only false', () => {
    const hidden = validateCommandResponse({ text: 'Deuda: S/ 12 400', shareable: false });
    expect(hidden.ok && hidden.response.shareable).toBe(false);
    const normal = validateCommandResponse({ text: 'ok', shareable: true });
    expect(normal.ok && 'shareable' in normal.response).toBe(false);
  });

  it('a form reply is either errors per field or a normal answer', () => {
    expect(validateFormReply({ errors: { accion: 'Ya marcaste ingreso hoy. Lo que sigue es: refrigerio.', _: '  ' } })).toEqual({ ok: true, errors: { accion: 'Ya marcaste ingreso hoy. Lo que sigue es: refrigerio.' } });
    expect(validateFormReply({ text: 'Ingreso marcado 07:12' })).toMatchObject({ ok: true, response: { responseType: 'ephemeral', text: 'Ingreso marcado 07:12' } });
    expect(validateFormReply({}).ok).toBe(false);
  });
});
