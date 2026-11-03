import { useCallback, useMemo, useRef, type ComponentProps } from 'react';
import { replyOpensThread, usesFlatLayout, type MemberPill } from '@lilachat/shared';
import { MessageRow, type Row } from './MessageRow';
import type { ChatMessage } from './useChat';
import { useGroupsAsList } from '../ui/groupsAsList';
import { useKeptValues } from './keptValues';
import { measureWork } from '../diagnostico/frameMonitor';
import { buildMessageCells, keepCells, type MessageCell } from './messageCells';
import { drawMessageCell, type CellDrawContext } from './drawMessageCell';

export type { MessageCell };

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
  // One cell per row with all that changes its look: an equal cell keeps its object and FlashList skips it (F4, 03/11).
  const built = useMemo(
    () => buildMessageCells(rows, { myUserId: yo, flat, dividerSeq: divisorSeq, unreadAtOpen: noLeidosAlAbrir, otherReadSeq: leidoHasta, otherDeliveredSeq: entregadoHasta, quotes: citados, threadHasNew: hiloConNuevas }),
    [rows, yo, flat, divisorSeq, noLeidosAlAbrir, leidoHasta, entregadoHasta, citados, hiloConNuevas]
  );
  const lastCells = useRef<readonly MessageCell[] | undefined>(undefined);
  const cells = keepCells(lastCells.current, built.cells);
  lastCells.current = cells;
  const bySeqRef = useRef(built.bySeq);
  bySeqRef.current = built.bySeq;
  const { onResponderEnHilo } = p;
  /** «Responder» from the row, the swipe and the selection bar: ONE route (pending 110). */
  const reply = useCallback(
    (seq: number, preview: string, mine: boolean) => {
      // Read from the ref: with the messages as a dependency every message changed it, and every row redrew (F4, 02/11).
      const message = bySeqRef.current.get(seq);
      if (message && !encrypted && onResponderEnHilo && replyOpensThread({ flat, message })) return onResponderEnHilo(seq);
      onResponder?.(seq, preview, mine);
    },
    [encrypted, flat, onResponder, onResponderEnHilo]
  );
  const chat = useMemo<CellDrawContext>(
    () => ({ myUserId: yo, jwt, encrypted, isGroup: esGrupo, flat, names: nombres, photos: fotos, roles, chosen: elegidos, selecting: enSeleccion, highlighted: resaltado, searched: seqBuscado, starred: destacados, onOpenMedia: onVerImagen, onSelect: onSeleccionar, onReply: reply, onFailed: onFallido, onGoToQuote: onTocarCita, onOpenThread: onAbrirHilo, onReact: onReaccionar, onMoreEmojis: onMasEmojis, onShowReactions: onVerReacciones, onGreet, onShowPerson: p.onShowPerson }),
    [yo, jwt, encrypted, esGrupo, flat, nombres, fotos, roles, elegidos, enSeleccion, resaltado, seqBuscado, destacados, onVerImagen, onSeleccionar, reply, onFallido, onTocarCita, onAbrirHilo, onReaccionar, onMasEmojis, onVerReacciones, onGreet, p.onShowPerson]
  );
  const drawRow = useCallback(
    ({ item }: { item: MessageCell }) => {
      // How many cells FlashList draws in a send: its own re-renders are not in «Chat» (§5.8).
      measureWork('celda', 0);
      return drawMessageCell(item, chat);
    },
    [chat]
  );
  return { dibujarFila: drawRow, cells, reply };
}
