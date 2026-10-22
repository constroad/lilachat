import { useCallback, type ComponentProps } from 'react';
import { alreadyGreeted } from '@lilachat/shared';
import { formatDayLabel, memberBadge, miReaccion, canOpenThread, puedeReaccionar, resolveDeliveryState, startsNewDay, usesFlatLayout, type MemberPill } from '@lilachat/shared';
import { DivisorNoLeidos } from './useDivisorNoLeidos';
import { DaySeparator, isPending, MessageRow, type Row } from './MessageRow';
import { ChipDeHilo } from './ChipDeHilo';
import { BarraDeReacciones } from './reacciones/BarraDeReacciones';
import { PastillaDeReacciones } from './reacciones/PastillaDeReacciones';
import type { ChatMessage } from './useChat';
import { FLAT_INDENT, FlatMessageRow } from './FlatMessageRow';
import { drawsAsFlatRow } from './rowKinds';
import { useGroupsAsList } from '../ui/groupsAsList';

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
  hiloConNuevas: (seq: number, hilo: NonNullable<ChatMessage['hilo']>) => boolean;
  /** Reacciones (20/10): la barra sobre el único elegido, «+» y quién reaccionó. */
  onReaccionar: (seq: number, emoji: string | null) => void;
  onMasEmojis: (seq: number) => void;
  onVerReacciones: (seq: number) => void;
  /** Los que destaqué (20/10), para la estrella de cada burbuja. */
  destacados: ReadonlySet<number>;
  /** «Saludar 👋» on «X se unió a Lilachat» (José, 21/10). */
  onGreet?: () => void;
}) {
  const { rows, yo, jwt, encrypted, esGrupo, nombres, fotos, roles, leidoHasta, entregadoHasta, divisorSeq, noLeidosAlAbrir } = p;
  // Groups as flat rows, like Slack (design `s-01`): always in a company space, on request in a personal group.
  const flat = usesFlatLayout({ kind: esGrupo ? 'group' : 'direct', workspaceId: p.workspaceId }, { groupsAsList: useGroupsAsList() });
  const { citados, elegidos, enSeleccion, resaltado, seqBuscado, onVerImagen, onSeleccionar, onResponder, onFallido, onTocarCita, onAbrirHilo, hiloConNuevas } = p;
  const { onReaccionar, onMasEmojis, onVerReacciones, destacados } = p;
  const { onGreet } = p;
  return useCallback(
    ({ item, index }: { item: Row; index: number }) => {
      const previous = rows[index - 1];
      const next = rows[index + 1];
      const at = isPending(item) ? item.queuedAt : item.at;
      const previousAt = previous ? (isPending(previous) ? previous.queuedAt : previous.at) : undefined;
      const mia = isPending(item) || item.senderId === yo;
      const conAvatar = esGrupo && !mia;
      const withBar = !isPending(item) && elegidos.size === 1 && elegidos.has(item.seq) && puedeReaccionar({ seq: item.seq, deletedAt: item.deletedAt, kind: item.kind, system: item.system, cifrado: encrypted });
      // «Responder en hilo» bajo los emojis: suelta la selección y abre el hilo.
      const withThread = withBar && !isPending(item) && canOpenThread({ seq: item.seq, kind: item.kind, system: item.system, hiloDe: item.hiloDe, deletedAt: item.deletedAt, cifrado: encrypted });
      // A highlighted notice sits in the middle: so do its bar, reactions and thread chip (21/10).
      const centered = !isPending(item) && item.kind === 'system';
      const flatRow = flat && drawsAsFlatRow(item);
      const indent = flatRow ? FLAT_INDENT : undefined;
      const senderId = isPending(item) ? yo : String(item.senderId);
      return (
        <>
          {startsNewDay(at, previousAt) ? <DaySeparator label={formatDayLabel(at)} /> : null}
          {!isPending(item) && item.seq === divisorSeq ? <DivisorNoLeidos cantidad={noLeidosAlAbrir} /> : null}
          {withBar ? <BarraDeReacciones seq={item.seq} mia={mia} conAvatar={false} centered={centered} indent={indent} miEmoji={miReaccion(item.reacciones, yo)} onElegir={onReaccionar} onMas={onMasEmojis} onHilo={withThread ? (seq) => { onSeleccionar?.(seq); onAbrirHilo(seq); } : undefined} /> : null}
          {flatRow ? (
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
              quoted={isPending(item) ? null : (citados.get(item.seq) ?? null)}
              selected={!isPending(item) && (elegidos.has(item.seq) || item.seq === resaltado || item.seq === seqBuscado)}
              selecting={enSeleccion}
              starred={!isPending(item) && destacados.has(item.seq)}
              onOpenMedia={onVerImagen}
              onSelect={onSeleccionar}
              onReply={onResponder}
              onFailed={onFallido}
              onGoToQuote={onTocarCita}
              onOpenThread={onAbrirHilo}
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
            onResponder={onResponder}
            citado={isPending(item) ? null : (citados.get(item.seq) ?? null)}
            seleccionado={!isPending(item) && (elegidos.has(item.seq) || item.seq === resaltado || item.seq === seqBuscado)}
            onFallido={onFallido}
            onTocarCita={onTocarCita}
            onAbrirHilo={onAbrirHilo}
            destacado={!isPending(item) && destacados.has(item.seq)}
          />
          )}
          {!isPending(item) && item.reacciones?.length && !item.deletedAt ? (
            <PastillaDeReacciones id={String(item.seq)} reacciones={item.reacciones} yo={yo} mia={mia} conAvatar={conAvatar} centered={centered} indent={indent} onTocar={() => onVerReacciones(item.seq)} />
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
    [rows, yo, jwt, encrypted, esGrupo, nombres, fotos, roles, flat, leidoHasta, entregadoHasta, divisorSeq, noLeidosAlAbrir, citados, elegidos, enSeleccion, resaltado, seqBuscado, onVerImagen, onSeleccionar, onResponder, onFallido, onTocarCita, onAbrirHilo, hiloConNuevas, onReaccionar, onMasEmojis, onVerReacciones, destacados, onGreet]
  );
}
