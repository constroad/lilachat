import { describe, expect, it } from 'vitest';
import { mentionOptions } from './menciones.js';
import { mentionCandidates, outsideMentionPrompt, outsideMentioned, type SpaceMemberForMention } from './mentionCandidates.js';
import { rangosDeMenciones } from './textoDelComposer.js';

const ME = 'u-me';
const ANA = { id: 'u-ana', nombre: 'Ana' };
const BETO = { id: 'u-beto', nombre: 'Beto' };

const spaceMember = (userId: string, name: string, extra: Partial<SpaceMemberForMention> = {}): SpaceMemberForMention => ({ userId, name, status: 'active', ...extra });

/**
 * José 25/10: typing @ in a channel did not list every member of the channel; it should list the whole space
 * and, for someone who is not in the channel, suggest adding them, like Slack.
 */
describe('mentionCandidates', () => {
  it('the people of the chat come first, in the order given', () => {
    const list = mentionCandidates({ chatMembers: [BETO, ANA], spaceMembers: [], myUserId: ME });
    expect(list.map((one) => one.id)).toEqual(['u-beto', 'u-ana']);
    expect(list.some((one) => one.outsideChat)).toBe(false);
  });

  it('adds the active members of the space who are not in the chat, marked as outside', () => {
    const list = mentionCandidates({ chatMembers: [ANA], spaceMembers: [spaceMember('u-ana', 'Ana'), spaceMember('u-carla', 'Carla'), spaceMember('u-beto', 'Beto')], myUserId: ME });
    expect(list).toEqual([ANA, { id: 'u-beto', nombre: 'Beto', outsideChat: true }, { id: 'u-carla', nombre: 'Carla', outsideChat: true }]);
  });

  it('the outside people are sorted by name, without tildes getting in the way', () => {
    const list = mentionCandidates({ chatMembers: [], spaceMembers: [spaceMember('u-3', 'Zoe'), spaceMember('u-1', 'Álvaro'), spaceMember('u-2', 'Beto')], myUserId: ME });
    expect(list.map((one) => one.nombre)).toEqual(['Álvaro', 'Beto', 'Zoe']);
  });

  it('never offers me, even from the space list', () => {
    const list = mentionCandidates({ chatMembers: [], spaceMembers: [spaceMember(ME, 'Yo'), spaceMember('u-ana', 'Ana')], myUserId: ME });
    expect(list.map((one) => one.id)).toEqual(['u-ana']);
  });

  it.each([
    ['pending', { status: 'pending' as const }],
    ['invited', { status: 'invited' as const }],
    ['deactivated', { status: 'deactivated' as const }],
    ['no user yet (an email invitation)', { userId: undefined }],
    ['no name', { name: '   ' }],
  ])('skips a space member who is %s', (_label, change) => {
    const list = mentionCandidates({ chatMembers: [], spaceMembers: [{ ...spaceMember('u-x', 'Xavier'), ...change }], myUserId: ME });
    expect(list).toEqual([]);
  });

  it('a person listed twice in the space appears once', () => {
    const list = mentionCandidates({ chatMembers: [], spaceMembers: [spaceMember('u-ana', 'Ana'), spaceMember('u-ana', 'Ana')], myUserId: ME });
    expect(list).toHaveLength(1);
  });

  it('keeps the photo of an outside person', () => {
    const list = mentionCandidates({ chatMembers: [], spaceMembers: [spaceMember('u-ana', 'Ana', { avatarUrl: 'https://x/a.png' })], myUserId: ME });
    expect(list[0]).toMatchObject({ foto: 'https://x/a.png' });
  });

  it('without the space list (loading, or a chat outside a space) it is just the chat', () => {
    expect(mentionCandidates({ chatMembers: [ANA], spaceMembers: undefined, myUserId: ME })).toEqual([ANA]);
  });
});

describe('mention options with people outside the chat', () => {
  it('@todos counts only whoever is in the chat, not the rest of the space', () => {
    const candidates = mentionCandidates({ chatMembers: [ANA, BETO], spaceMembers: [spaceMember('u-carla', 'Carla')], myUserId: ME });
    expect(mentionOptions(candidates)?.[0]).toMatchObject({ hint: 'Avisa a los 3 del grupo' });
  });

  it('a channel where I am alone still offers the space people', () => {
    const candidates = mentionCandidates({ chatMembers: [], spaceMembers: [spaceMember('u-carla', 'Carla')], myUserId: ME });
    expect(mentionOptions(candidates)?.map((one) => one.nombre)).toEqual(['todos', 'aquí', 'Carla']);
  });
});

describe('mentions of people outside the chat', () => {
  const chosen = [{ userId: 'u-ana', nombre: 'Ana' }, { userId: 'u-carla', nombre: 'Carla', outsideChat: true }];

  it('they do not travel as mentions: the server would drop them, and nobody there is notified', () => {
    expect(rangosDeMenciones('Hola @Ana y @Carla', chosen)).toEqual([{ userId: 'u-ana', desde: 5, largo: 4 }]);
  });

  it('whoever is still in the final text is reported, to offer adding them', () => {
    expect(outsideMentioned('Hola @Ana y @Carla', chosen)).toEqual([{ userId: 'u-carla', nombre: 'Carla', outsideChat: true }]);
  });

  it('a person whose mention was erased before sending is not reported', () => {
    expect(outsideMentioned('Hola @Ana', chosen)).toEqual([]);
  });

  it('«@Carlata» is not «@Carla»', () => {
    expect(outsideMentioned('Hola @Carlata', chosen)).toEqual([]);
  });

  it('chosen twice is reported once', () => {
    const twice = [...chosen, chosen[1]!];
    expect(outsideMentioned('@Carla @Carla', twice)).toHaveLength(1);
  });
});

describe('outsideMentionPrompt', () => {
  it('names one person', () => {
    expect(outsideMentionPrompt(['Carla'])).toEqual({ message: 'Carla no está en este canal, así que no recibió tu mención.', action: 'Agregar al canal' });
  });

  it('names two and says «los»', () => {
    expect(outsideMentionPrompt(['Carla', 'Beto'])).toEqual({ message: 'Carla y Beto no están en este canal, así que no recibieron tu mención.', action: 'Agregarlos al canal' });
  });

  it('three or more are summarized by count', () => {
    expect(outsideMentionPrompt(['Carla', 'Beto', 'Zoe'])).toEqual({ message: 'Carla, Beto y 1 más no están en este canal, así que no recibieron tu mención.', action: 'Agregarlos al canal' });
  });

  it('nobody, no prompt', () => {
    expect(outsideMentionPrompt([])).toBeNull();
  });
});
