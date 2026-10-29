/**
 * What the group call screen shows (pending 56). PURE: the hook keeps the
 * streams, this decides the order of the tiles and the words.
 */
export type GroupRing = { chatId: string; chatName?: string | null; from: string; fromName: string | null; video: boolean };

/** «Ana te invita a una videollamada» over «Obra km 12». */
export function ringText(ring: GroupRing, chatName: string): { title: string; subtitle: string } {
  const who = ring.fromName?.trim() || 'Alguien';
  return { title: chatName || 'Grupo', subtitle: `${who} inició una ${ring.video ? 'videollamada' : 'llamada'} grupal` };
}

export type Tile<S> = { key: string; name: string; stream: S | null; mine: boolean };

/** Me first, then the others in the order they joined; who has not sent media yet shows their name. */
export function tilesOf<S>(params: { me: string; myStream: S | null; participants: readonly string[]; streams: ReadonlyMap<string, S>; nameOf: (userId: string) => string }): Tile<S>[] {
  const others = params.participants.filter((userId) => userId !== params.me);
  return [
    { key: params.me, name: 'Tú', stream: params.myStream, mine: true },
    ...others.map((userId) => ({ key: userId, name: params.nameOf(userId), stream: params.streams.get(userId) ?? null, mine: false })),
  ];
}

/** «2 personas · 04:12» under the group's name. */
export function groupCallCaption(count: number, seconds: number | null): string {
  const people = `${count} ${count === 1 ? 'persona' : 'personas'}`;
  if (seconds === null) return `${people} · Conectando…`;
  const minutes = Math.floor(seconds / 60);
  return `${people} · ${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
