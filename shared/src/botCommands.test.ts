import { describe, expect, it } from 'vitest';
import { answerOfOutcome, COMMAND_LIMITS, matchCommands, parseSlashInput, slashQuery, validateBotCommands, validateCommandResponse, withAnswer, withNotice, type CommandGroup } from './botCommands.js';

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
