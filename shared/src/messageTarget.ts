/**
 * Where a message goes besides its chat (José 10/11): an answer to another
 * message (`replyToSeq`), a reply inside a thread (`hiloDe`) and, from the
 * thread, «También enviar al chat» (`enElChat`). Text already carried them;
 * photos, videos and GIFs go up as multipart, where every field is a string.
 */
export type MessageTarget = { replyToSeq?: number; hiloDe?: number; enElChat?: boolean };

const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {});

function positiveWhole(value: unknown): number | undefined {
  const number = typeof value === 'string' && value.trim() ? Number(value) : value;
  return typeof number === 'number' && Number.isInteger(number) && number > 0 ? number : undefined;
}

/** The target in a JSON or multipart body; whatever is not a positive whole number is left out. */
export function messageTargetOf(body: unknown): MessageTarget {
  const input = record(body);
  const replyToSeq = positiveWhole(input.replyToSeq);
  const hiloDe = positiveWhole(input.hiloDe);
  const alsoInChat = hiloDe !== undefined && (input.enElChat === true || input.enElChat === 'true');
  return { ...(replyToSeq ? { replyToSeq } : {}), ...(hiloDe ? { hiloDe } : {}), ...(alsoInChat ? { enElChat: true } : {}) };
}

/** The same target as multipart fields, to append to a FormData. */
export function messageTargetFields(target: MessageTarget): [string, string][] {
  const fields: [string, string][] = [];
  if (target.replyToSeq) fields.push(['replyToSeq', String(target.replyToSeq)]);
  if (target.hiloDe) fields.push(['hiloDe', String(target.hiloDe)]);
  if (target.hiloDe && target.enElChat) fields.push(['enElChat', 'true']);
  return fields;
}
