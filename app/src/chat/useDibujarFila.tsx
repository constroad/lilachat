import { useCallback, type ComponentProps } from 'react';
import { formatDayLabel, miReaccion, puedeAbrirHilo, puedeReaccionar, resolveDeliveryState, startsNewDay } from '@lilachat/shared';
import { DivisorNoLeidos } from './useDivisorNoLeidos';
import { DaySeparator, isPending, MessageRow, type Row } from './MessageRow';
import { ChipDeHilo } from './ChipDeHilo';
import { BarraDeReacciones } from './reacciones/BarraDeReacciones';
import { PastillaDeReacciones } from './reacciones/PastillaDeReacciones';
import type { ChatMessage } from './useChat';

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
}) {
  const { rows, yo, jwt, encrypted, esGrupo, nombres, fotos, leidoHasta, entregadoHasta, divisorSeq, noLeidosAlAbrir } = p;
  const { citados, elegidos, enSeleccion, resaltado, seqBuscado, onVerImagen, onSeleccionar, onResponder, onFallido, onTocarCita, onAbrirHilo, hiloConNuevas } = p;
  const { onReaccionar, onMasEmojis, onVerReacciones, destacados } = p;
  return useCallback(
    ({ item, index }: { item: Row; index: number }) => {
      const previous = rows[index - 1];
      const next = rows[index + 1];
      const at = isPending(item) ? item.queuedAt : item.at;
      const previousAt = previous ? (isPending(previous) ? previous.queuedAt : previous.at) : undefined;
      const mia = isPending(item) || item.senderId === yo;
      const conAvatar = esGrupo && !mia;
      const conBarra = !isPending(item) && elegidos.size === 1 && elegidos.has(item.seq) && puedeReaccionar({ seq: item.seq, deletedAt: item.deletedAt, kind: item.kind, cifrado: encrypted });
      // «Responder en hilo» bajo los emojis: suelta la selección y abre el hilo.
      const conHilo = conBarra && !isPending(item) && puedeAbrirHilo({ seq: item.seq, kind: item.kind, hiloDe: item.hiloDe, deletedAt: item.deletedAt, cifrado: encrypted });
      return (
        <>
          {startsNewDay(at, previousAt) ? <DaySeparator label={formatDayLabel(at)} /> : null}
          {!isPending(item) && item.seq === divisorSeq ? <DivisorNoLeidos cantidad={noLeidosAlAbrir} /> : null}
          {conBarra ? <BarraDeReacciones seq={item.seq} mia={mia} conAvatar={false} miEmoji={miReaccion(item.reacciones, yo)} onElegir={onReaccionar} onMas={onMasEmojis} onHilo={conHilo ? (seq) => { onSeleccionar?.(seq); onAbrirHilo(seq); } : undefined} /> : null}
          <MessageRow
            item={item}
            previous={previous}
            next={next}
            myUserId={yo}
            jwt={jwt}
            conVistaPrevia={!encrypted}
            nombres={esGrupo ? nombres : undefined}
            entrega={mia ? resolveDeliveryState({ seq: isPending(item) ? null : item.seq, otherReadSeq: leidoHasta, otherDeliveredSeq: entregadoHasta }) : undefined}
            esGrupo={esGrupo}
            nombreAutor={isPending(item) ? undefined : nombres.get(String(item.senderId))}
            fotoAutor={isPending(item) ? undefined : fotos.get(String(item.senderId))}
            onVerImagen={onVerImagen}
            onSeleccionar={onSeleccionar}
            enSeleccion={enSeleccion}
            onResponder={onResponder}
            citado={isPending(item) ? null : (citados.get(item.seq) ?? null)}
            seleccionado={!isPending(item) && (elegidos.has(item.seq) || item.seq === resaltado || item.seq === seqBuscado)}
            onFallido={onFallido}
            onTocarCita={onTocarCita}
            destacado={!isPending(item) && destacados.has(item.seq)}
          />
          {!isPending(item) && item.reacciones?.length && !item.deletedAt ? (
            <PastillaDeReacciones id={String(item.seq)} reacciones={item.reacciones} yo={yo} mia={mia} conAvatar={conAvatar} onTocar={() => onVerReacciones(item.seq)} />
          ) : null}
          {!isPending(item) && item.hilo && item.hilo.respuestas > 0 && !item.deletedAt ? (
            <ChipDeHilo
              seq={item.seq}
              hilo={item.hilo}
              mia={mia}
              conAvatar={conAvatar}
              nombres={nombres}
              fotos={fotos}
              nuevas={hiloConNuevas(item.seq, item.hilo)}
              onAbrir={onAbrirHilo}
            />
          ) : null}
        </>
      );
    },
    [rows, yo, jwt, encrypted, esGrupo, nombres, fotos, leidoHasta, entregadoHasta, divisorSeq, noLeidosAlAbrir, citados, elegidos, enSeleccion, resaltado, seqBuscado, onVerImagen, onSeleccionar, onResponder, onFallido, onTocarCita, onAbrirHilo, hiloConNuevas, onReaccionar, onMasEmojis, onVerReacciones, destacados]
  );
}
