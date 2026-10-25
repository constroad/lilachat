/**
 * Una mención en un mensaje de grupo (José, 18/10: «taggear con @»). Viaja el
 * texto que eligió quien escribe («@Ana») MÁS el rango y el id: cada teléfono
 * la dibuja con SU nombre para esa persona, y una app vieja igual lee «@Ana».
 */
export type MencionEnMensaje = { userId: string; desde: number; largo: number };

export type TramoConMenciones = { tipo: 'texto'; texto: string } | { tipo: 'mencion'; userId: string; texto: string };

/** Más que esto en un mensaje es ruido (o abuso del aviso que dispara cada una). */
export const MAX_MENCIONES = 20;

/** E3b (20/10): group mentions travel as a mention with these ids instead of a person. */
export const MENTION_ALL = 'todos';
export const MENTION_HERE = 'aqui';
const GROUP_MENTION_TEXTS: Record<string, readonly string[]> = { [MENTION_ALL]: ['@todos'], [MENTION_HERE]: ['@aquí', '@aqui'] };

/** What the composer offers first in a group, like Slack's @channel and @here. */
export const GROUP_MENTION_OPTIONS = [
  { id: MENTION_ALL, nombre: 'todos', hint: 'Avisa a todos del grupo' },
  { id: MENTION_HERE, nombre: 'aquí', hint: 'Avisa a los que están en línea' },
] as const;

export const isGroupMentionId = (userId: string): boolean => userId === MENTION_ALL || userId === MENTION_HERE;

export type GroupMentionOption = { id: string; nombre: string; hint: string };

/** A group's mention list: the two group mentions first, then the people. Without members (a 1:1) there is nothing to mention. */
export function mentionOptions<T extends { id: string; nombre: string; outsideChat?: boolean }>(members: readonly T[] | undefined): (T | GroupMentionOption)[] | undefined {
  if (!members?.length) return undefined;
  // Like the design (`e-17`): the group mention for all says how many it reaches (the others in the chat plus me).
  const inChat = members.filter((member) => !member.outsideChat).length;
  const all = { ...GROUP_MENTION_OPTIONS[0], hint: `Avisa a los ${inChat + 1} del grupo` };
  return [all, GROUP_MENTION_OPTIONS[1], ...members];
}

/** The people a message's mentions reach: the person named, everyone (MENTION_ALL) or whoever is online (MENTION_HERE). */
export function mentionedUserIds(mentions: readonly MencionEnMensaje[] | undefined, members: readonly string[], isOnline: (userId: string) => boolean): Set<string> {
  const reached = new Set<string>();
  for (const mention of mentions ?? []) {
    if (mention.userId === MENTION_ALL) for (const member of members) reached.add(member);
    else if (mention.userId === MENTION_HERE) for (const member of members.filter(isOnline)) reached.add(member);
    else reached.add(mention.userId);
  }
  return reached;
}

/**
 * Per-chat notifications (E3b), like Slack: everything, only mentions, or
 * nothing. Stored as the old `muted` (silenced = only mentions, as WhatsApp
 * does) plus `avisos: 'nada'` when not even mentions should ring, so older
 * clients still read a silenced chat as silenced.
 */
export type NotificationLevel = 'todo' | 'menciones' | 'nada';
export const NOTIFICATION_LEVELS: readonly NotificationLevel[] = ['todo', 'menciones', 'nada'];

/** How each level is told to the person, the same in the app and the web. */
export const NOTIFICATION_LEVEL_TEXT: Record<NotificationLevel, { title: string; detail: string }> = {
  todo: { title: 'Todos los mensajes', detail: 'Te avisamos de cada mensaje' },
  menciones: { title: 'Solo menciones', detail: 'Cuando te nombran, @todos o @aquí' },
  nada: { title: 'Nada', detail: 'Ni siquiera cuando te nombran' },
};

export function notificationLevel(member: { muted?: boolean; avisos?: string | null }): NotificationLevel {
  if (member.muted !== true) return 'todo';
  return member.avisos === 'nada' ? 'nada' : 'menciones';
}

export function settingsForLevel(level: NotificationLevel): { muted: boolean; avisos: 'nada' | null } {
  return { muted: level !== 'todo', avisos: level === 'nada' ? 'nada' : null };
}

/** Whether a message makes a sound for someone at this level. */
export const ringsFor = (level: NotificationLevel, mentioned: boolean): boolean => level === 'todo' || (level === 'menciones' && mentioned);

const esEntero = (valor: unknown): valor is number => typeof valor === 'number' && Number.isInteger(valor);

/**
 * Las menciones que valen: de miembros del chat, dentro del texto, empezando
 * con «@», sin superponerse, ordenadas y con tope. Lo demás se descarta en
 * silencio: una mención inválida no justifica rechazar el mensaje.
 */
export function validarMenciones(texto: string, crudas: unknown, miembros: readonly string[]): MencionEnMensaje[] {
  if (!Array.isArray(crudas)) return [];
  const validos = new Set(miembros);
  const candidatas = crudas
    .filter((m): m is MencionEnMensaje => typeof m?.userId === 'string' && esEntero(m?.desde) && esEntero(m?.largo))
    .map(({ userId, desde, largo }) => ({ userId, desde, largo }))
    .filter((m) => validos.has(m.userId) && m.desde >= 0 && m.largo > 1 && m.desde + m.largo <= texto.length && texto[m.desde] === '@')
    .sort((a, b) => a.desde - b.desde);
  const aceptadas: MencionEnMensaje[] = [];
  for (const mencion of candidatas) {
    const anterior = aceptadas[aceptadas.length - 1];
    if (anterior && mencion.desde < anterior.desde + anterior.largo) continue;
    aceptadas.push(mencion);
    if (aceptadas.length === MAX_MENCIONES) break;
  }
  return aceptadas;
}

/** Like `validarMenciones`, plus the group mentions in a group, only over their exact text (E3b). */
export function validateMentions(text: string, raw: unknown, members: readonly string[], options: { groupMentions?: boolean } = {}): MencionEnMensaje[] {
  const allowed = options.groupMentions === true ? [...members, MENTION_ALL, MENTION_HERE] : members;
  const exactText = (mention: MencionEnMensaje) => GROUP_MENTION_TEXTS[mention.userId]?.includes(text.slice(mention.desde, mention.desde + mention.largo).toLowerCase()) === true;
  return validarMenciones(text, raw, allowed).filter((mention) => !isGroupMentionId(mention.userId) || exactText(mention));
}

/**
 * El texto partido en tramos y menciones, para dibujarlo. Un rango que ya no
 * calza (no cae sobre un «@») se ignora: el texto se ve igual, sin resaltar.
 */
export function partirEnMenciones(texto: string, menciones: readonly MencionEnMensaje[] | undefined): TramoConMenciones[] {
  const tramos: TramoConMenciones[] = [];
  let desde = 0;
  for (const mencion of [...(menciones ?? [])].sort((a, b) => a.desde - b.desde)) {
    if (mencion.desde < desde || texto[mencion.desde] !== '@' || mencion.desde + mencion.largo > texto.length) continue;
    if (mencion.desde > desde) tramos.push({ tipo: 'texto', texto: texto.slice(desde, mencion.desde) });
    tramos.push({ tipo: 'mencion', userId: mencion.userId, texto: texto.slice(mencion.desde, mencion.desde + mencion.largo) });
    desde = mencion.desde + mencion.largo;
  }
  if (desde < texto.length || tramos.length === 0) tramos.push({ tipo: 'texto', texto: texto.slice(desde) });
  return tramos;
}
