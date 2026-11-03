import { useCallback, useMemo, useRef, type ComponentProps } from 'react';
import { albumLayout, alreadyGreeted, isHiddenNotice, stickerRowLayout, type AlbumRole } from '@lilachat/shared';
import { formatDayLabel, isAnimatedImage, memberBadge, miReaccion, canOpenThread, puedeReaccionar, replyOpensThread, resolveDeliveryState, startsNewDay, usesFlatLayout, type MemberPill } from '@lilachat/shared';
import { DivisorNoLeidos } from './useDivisorNoLeidos';
import { neighboursForGrouping } from './divisorNoLeidos';
import { DaySeparator, isPending, MessageRow, type Row } from './MessageRow';
import { ChipDeHilo } from './ChipDeHilo';
import { BarraDeReacciones } from './reacciones/BarraDeReacciones';
import { PastillaDeReacciones } from './reacciones/PastillaDeReacciones';
import type { ChatMessage } from './useChat';
import { FLAT_INDENT, FlatMessageRow } from './FlatMessageRow';
import { drawsAsFlatRow } from './rowKinds';
import { useGroupsAsList } from '../ui/groupsAsList';
import { convertGifToSticker } from './gifs/gifOptions';
import { StickerPair } from './stickers/StickerMessage';
import { useKeptValues } from './keptValues';

type PropsDeFila = ComponentProps<typeof MessageRow>;

/**
 * Cómo se dibuja cada fila de la conversación (salió de `ChatScreen`, que
 * pasaba de 600 líneas): el separador de día, el divisor de no leídos y la
 * burbuja con todo lo que necesita.
 */
export function useDibujarFila(p: {
  rows: Row[];
  yo: string;
  jwt: string;
  encrypted: boolean;
  esGrupo: boolean;
  nombres: ReadonlyMap<string, string>;
  fotos: ReadonlyMap<string, string>;
  /** Each member's role: the pill next to the name in the Slack format. */
  roles: ReadonlyMap<string, MemberPill>;
  /** A chat of a company space: always the Slack format. */
  workspaceId?: string;
  leidoHasta: number;
  entregadoHasta: number;
  divisorSeq: number | null;
  noLeidosAlAbrir: number;
  citados: ReadonlyMap<number, NonNullable<PropsDeFila['citado']>>;
  elegidos: ReadonlySet<number>;
  enSeleccion: boolean;
  resaltado: number | null;
  seqBuscado: number | null | undefined;
  onVerImagen: PropsDeFila['onVerImagen'];
  onSeleccionar: PropsDeFila['onSeleccionar'];
  onResponder: PropsDeFila['onResponder'];
  onFallido: PropsDeFila['onFallido'];
  onTocarCita: PropsDeFila['onTocarCita'];
  /** E3: abrir el hilo de una raíz, y si tiene respuestas que no vi. */
  onAbrirHilo: (seq: number) => void;
  /** In the Slack layout «Responder» answers in the thread, keyboard up (pending 110). */
  onResponderEnHilo?: (seq: number) => void;
  hiloConNuevas: (seq: number, hilo: NonNullable<ChatMessage['hilo']>) => boolean;
  /** Reacciones (20/10): la barra sobre el único elegido, «+» y quién reaccionó. */
  onReaccionar: (seq: number, emoji: string | null) => void;
  onMasEmojis: (seq: number) => void;
  onVerReacciones: (seq: number) => void;
  /** Los que destaqué (20/10), para la estrella de cada burbuja. */
  destacados: ReadonlySet<number>;
  /** «Saludar 👋» on «X se unió a Lilachat» (José, 21/10). */
  onGreet?: () => void;
  /** Someone's photo or name was tapped: their card (José, 25/10/2026). */
  onShowPerson?: (userId: string) => void;
}) {
  const { rows, yo, jwt, encrypted, esGrupo, nombres, fotos, roles, leidoHasta, entregadoHasta, divisorSeq, noLeidosAlAbrir } = p;
  // Groups as flat rows, like Slack (design `s-01`): always in a company space, on request in a personal group.
  const flat = usesFlatLayout({ kind: esGrupo ? 'group' : 'direct', workspaceId: p.workspaceId }, { groupsAsList: useGroupsAsList() });
  const { elegidos, enSeleccion, resaltado, seqBuscado, onVerImagen, onSeleccionar, onResponder, onFallido, onTocarCita, onAbrirHilo, hiloConNuevas } = p;
  // A new message rebuilt every quote: the unchanged ones keep their object and their row bails out (F4, 02/11).
  const citados = useKeptValues(p.citados);
  const { onReaccionar, onMasEmojis, onVerReacciones, destacados } = p;
  const { onGreet } = p;
  // Photos sent together (pending 12): the first draws the album, the others nothing.
  const albums = useMemo(() => {
    const confirmed = rows.filter((row): row is ChatMessage => !isPending(row));
    const bySeq = new Map(confirmed.map((row) => [row.seq, row]));
    const layout = albumLayout(confirmed);
    const heads = new Map<number, ChatMessage[]>();
    for (const [seq, role] of layout) if (role.role === 'head') heads.set(seq, role.seqs.map((one) => bySeq.get(one)).filter((one): one is ChatMessage => Boolean(one)));
    return { roles: layout, bySeq, heads };
  }, [rows]);
  // The same for the photos of each album.
  const albumHeads = useKeptValues(albums.heads);
  const albumsRef = useRef(albums);
  albumsRef.current = albums;
  // Stickers sent in a row (José, 02/11): two side by side; the flat rows keep each apart.
  const stickerPairs = useMemo(() => (flat ? new Map<number, AlbumRole>() : stickerRowLayout(rows.map((row) => (isPending(row) ? {} : row)), { dividerSeq: divisorSeq ?? undefined })), [rows, flat, divisorSeq]);
  const { onResponderEnHilo } = p;
  /** «Responder» from the row, the swipe and the selection bar: ONE route (pending 110). */
  const reply = useCallback(
    (seq: number, preview: string, mine: boolean) => {
      // Read from the ref: with `albums` as a dependency every message changed it, and every row redrew (F4, 02/11).
      const message = albumsRef.current.bySeq.get(seq);
      if (message && !encrypted && onResponderEnHilo && replyOpensThread({ flat, message })) return onResponderEnHilo(seq);
      onResponder?.(seq, preview, mine);
    },
    [encrypted, flat, onResponder, onResponderEnHilo]
  );
  const drawRow = useCallback(
    ({ item, index }: { item: Row; index: number }) => {
      // The flat (Slack) rows keep each photo apart.
      const albumRole = isPending(item) || flat ? undefined : albums.roles.get(item.seq);
      // The rest of an album is in its first card; a notice deleted for everyone is not drawn.
      if (albumRole?.role === 'member' || (!isPending(item) && isHiddenNotice(item))) return <></>;
      const album = albumRole?.role === 'head' && !isPending(item) ? albumHeads.get(item.seq) : undefined;
      const stickerRole = isPending(item) ? undefined : stickerPairs.get(item.seq);
      if (stickerRole?.role === 'member') return <></>;
      const pair = pairOf(stickerRole, albums.bySeq);
      // The reaction bar goes over whichever of the pair is selected.
      const target: Row = pair?.find((one) => elegidos.size === 1 && elegidos.has(one.seq)) ?? item;
      // The day chip reads the real previous row; grouping reads it through the unread divider, which cuts the block.
      const realPrevious = rows[index - 1];
      const { previous, next } = neighboursForGrouping(rows, index, divisorSeq);
      const at = isPending(item) ? item.queuedAt : item.at;
      const previousAt = realPrevious ? (isPending(realPrevious) ? realPrevious.queuedAt : realPrevious.at) : undefined;
      const mia = isPending(item) || item.senderId === yo;
      const conAvatar = esGrupo && !mia;
      const withBar = !isPending(target) && elegidos.size === 1 && elegidos.has(target.seq) && puedeReaccionar({ seq: target.seq, deletedAt: target.deletedAt, kind: target.kind, system: target.system, cifrado: encrypted });
      // «Responder en hilo» bajo los emojis: suelta la selección y abre el hilo.
      const withThread = withBar && !isPending(target) && canOpenThread({ seq: target.seq, kind: target.kind, system: target.system, hiloDe: target.hiloDe, deletedAt: target.deletedAt, cifrado: encrypted });
      // A GIF (José, 22/10): «Convertir en sticker animado» under the emojis; not in a secret chat, where it is encrypted.
      const withGifSticker = withBar && !encrypted && !isPending(target) && !target.deletedAt && isAnimatedImage(target.media?.mime);
      // A highlighted notice sits in the middle: so do its bar, reactions and thread chip (21/10).
      const centered = !isPending(item) && item.kind === 'system';
      const flatRow = flat && drawsAsFlatRow(item);
      const indent = flatRow ? FLAT_INDENT : undefined;
      const senderId = isPending(item) ? yo : String(item.senderId);
      return (
        <>
          {startsNewDay(at, previousAt) ? <DaySeparator label={formatDayLabel(at)} /> : null}
          {!isPending(item) && item.seq === divisorSeq ? <DivisorNoLeidos cantidad={noLeidosAlAbrir} /> : null}
          {withBar && !isPending(target) ? <BarraDeReacciones seq={target.seq} mia={mia} conAvatar={false} centered={centered} indent={indent} miEmoji={miReaccion(target.reacciones, yo)} onElegir={onReaccionar} onMas={onMasEmojis} onHilo={withThread ? (seq) => { onSeleccionar?.(seq); onAbrirHilo(seq); } : undefined} onGifSticker={withGifSticker ? (seq) => { onSeleccionar?.(seq); void convertGifToSticker(jwt, target.chatId, seq); } : undefined} /> : null}
          {pair ? (
            <StickerPair
              items={pair}
              mine={mia}
              jwt={jwt}
              delivery={(seq) => (mia ? resolveDeliveryState({ seq, otherReadSeq: leidoHasta, otherDeliveredSeq: entregadoHasta }) : 'sent')}
              starred={(seq) => destacados.has(seq)}
              selected={(seq) => elegidos.has(seq) || seq === resaltado || seq === seqBuscado}
              author={esGrupo && !mia ? { name: nombres.get(senderId) ?? '', photo: fotos.get(senderId) } : undefined}
              onSelect={onSeleccionar}
              selecting={enSeleccion}
            />
          ) : flatRow ? (
            <FlatMessageRow
              item={item}
              previous={previous}
              myUserId={yo}
              jwt={jwt}
              linkPreview={!encrypted}
              names={nombres}
              everyName={nombres}
              delivery={mia ? resolveDeliveryState({ seq: isPending(item) ? null : item.seq, otherReadSeq: leidoHasta, otherDeliveredSeq: entregadoHasta }) : undefined}
              authorName={nombres.get(senderId)}
              authorPhoto={fotos.get(senderId)}
              badge={memberBadge({ ...roles.get(senderId), isMe: mia })}
              authorIsApp={roles.get(senderId)?.role === 'app'}
              quoted={isPending(item) ? null : (citados.get(item.seq) ?? null)}
              selected={!isPending(item) && (elegidos.has(item.seq) || item.seq === resaltado || item.seq === seqBuscado)}
              selecting={enSeleccion}
              starred={!isPending(item) && destacados.has(item.seq)}
              onOpenMedia={onVerImagen}
              onSelect={onSeleccionar}
              onReply={reply}
              onFailed={onFallido}
              onGoToQuote={onTocarCita}
              onOpenThread={onAbrirHilo}
              onShowPerson={p.onShowPerson}
            />
          ) : (
          <MessageRow
            item={item}
            previous={previous}
            next={next}
            myUserId={yo}
            jwt={jwt}
            conVistaPrevia={!encrypted}
            nombres={esGrupo ? nombres : undefined}
            everyName={nombres}
            entrega={mia ? resolveDeliveryState({ seq: isPending(item) ? null : item.seq, otherReadSeq: leidoHasta, otherDeliveredSeq: entregadoHasta }) : undefined}
            esGrupo={esGrupo}
            nombreAutor={isPending(item) ? undefined : nombres.get(String(item.senderId))}
            fotoAutor={isPending(item) ? undefined : fotos.get(String(item.senderId))}
            onGreet={!isPending(item) && item.system?.evento === 'se-unio' && !alreadyGreeted(rows.map((row) => (isPending(row) ? { senderId: yo, pending: true } : row)), item.seq, yo) ? onGreet : undefined}
            onVerImagen={onVerImagen}
            onSeleccionar={onSeleccionar}
            enSeleccion={enSeleccion}
            onResponder={reply}
            citado={isPending(item) ? null : (citados.get(item.seq) ?? null)}
            seleccionado={!isPending(item) && (elegidos.has(item.seq) || item.seq === resaltado || item.seq === seqBuscado)}
            onFallido={onFallido}
            onTocarCita={onTocarCita}
            onAbrirHilo={onAbrirHilo}
            destacado={!isPending(item) && destacados.has(item.seq)}
            album={album}
            onShowPerson={p.onShowPerson}
          />
          )}
          {!isPending(item) && item.reacciones?.length && !item.deletedAt ? (
            <PastillaDeReacciones id={String(item.seq)} reacciones={item.reacciones} yo={yo} mia={mia} conAvatar={conAvatar} centered={centered} indent={indent} seq={item.seq} onTocar={onVerReacciones} />
          ) : null}
          {!isPending(item) && item.hilo && item.hilo.respuestas > 0 && !item.deletedAt ? (
            <ChipDeHilo
              seq={item.seq}
              bubbleKey={`${item.chatId}:${item.seq}`}
              hilo={item.hilo}
              mia={mia}
              conAvatar={conAvatar}
              centered={centered}
              indent={indent}
              nombres={nombres}
              fotos={fotos}
              nuevas={hiloConNuevas(item.seq, item.hilo)}
              onAbrir={onAbrirHilo}
            />
          ) : null}
        </>
      );
    },
    [rows, albums, albumHeads, stickerPairs, yo, jwt, encrypted, esGrupo, nombres, fotos, roles, flat, leidoHasta, entregadoHasta, divisorSeq, noLeidosAlAbrir, citados, elegidos, enSeleccion, resaltado, seqBuscado, onVerImagen, onSeleccionar, reply, onFallido, onTocarCita, onAbrirHilo, hiloConNuevas, onReaccionar, onMasEmojis, onVerReacciones, destacados, onGreet, p.onShowPerson]
  );
  return { dibujarFila: drawRow, reply };
}

/** The two stickers of a pair's first row, when both are loaded. */
function pairOf(role: AlbumRole | undefined, bySeq: ReadonlyMap<number, ChatMessage>): readonly [ChatMessage, ChatMessage] | undefined {
  if (role?.role !== 'head') return undefined;
  const [first, second] = role.seqs.map((seq) => bySeq.get(seq));
  return first && second ? [first, second] : undefined;
}
