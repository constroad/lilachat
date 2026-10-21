import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown } from 'lucide-react';
import { formatDayLabel } from '@lilachat/shared';
import { BurbujaDeMensaje } from './BurbujaDeMensaje';
import { seqParaAcusar } from './acuseDeLeido';
import { estaCercaDelFinal, filasDeLaConversacion, sigueEnElFinal } from './filasDeLaConversacion';
import type { ChatSummary, MensajeEnPantalla } from './types';

type Props = {
  chat: ChatSummary;
  mensajes: MensajeEnPantalla[];
  yo: string;
  escribiendo: boolean;
  hayAnteriores: boolean;
  onCargarAnteriores: () => void;
  onReintentar: (clientKey: string) => void;
  onDescartar: (clientKey: string) => void;
  /** El último del otro que se vio con la pestaña al frente y abajo. */
  onLeido: (seq: number) => void;
  /** Ir a un mensaje (el fijado, 19/10): `vez` cambia en cada pedido. */
  salto?: { seq: number; vez: number } | null;
  /** El mensaje pedido no está cargado. */
  onNoEsta?: () => void;
};

/** Cuánto queda resaltado el mensaje al que se saltó. */
const RESALTADO_MS = 1500;

/** Cerca del borde de arriba se piden los anteriores, antes de tocarlo. */
const UMBRAL_DE_ANTERIORES_PX = 400;

/**
 * La conversación, VIRTUALIZADA (W1): 10 000 mensajes cuestan lo mismo que 30.
 * Pegada al final como WhatsApp: abre abajo, sigue lo que llega o crece, y
 * deja de seguir solo cuando la persona sube a leer.
 */
export function ListaDeMensajes(props: Props) {
  const { mensajes, yo, chat } = props;
  const contenedor = useRef<HTMLDivElement>(null);
  const pegado = useRef(true);
  /** Cuándo fue el último gesto de la persona sobre la lista (rueda, toque, tecla). */
  const ultimoGesto = useRef(0);
  const anotarGesto = () => {
    ultimoGesto.current = Date.now();
  };
  const [lejos, setLejos] = useState(false);
  const filas = useMemo(() => filasDeLaConversacion(mensajes), [mensajes]);

  const virtualizador = useVirtualizer({
    count: filas.length,
    getScrollElement: () => contenedor.current,
    estimateSize: () => 64,
    overscan: 10,
    getItemKey: (indice) => filas[indice]?.mensaje.clientKey || `seq-${filas[indice]?.mensaje.seq}`,
  });

  const bajar = useCallback(() => {
    const elemento = contenedor.current;
    if (elemento) elemento.scrollTop = elemento.scrollHeight;
  }, []);

  useConservarAlCargarAnteriores(contenedor, filas[0]?.mensaje.clientKey, virtualizador.getTotalSize());
  useSeguirElFinal({ pegado, bajar, alto: virtualizador.getTotalSize(), cantidad: filas.length, chatId: chat.id });
  useSeguirAlAchicarse(contenedor, pegado, bajar);
  useAcuseDeLeido({ mensajes, pegado, lejos, onLeido: props.onLeido });
  const resaltado = useSaltoAMensaje({ salto: props.salto, filas, pegado, setLejos, scrollToIndex: (indice) => virtualizador.scrollToIndex(indice, { align: 'center' }), onNoEsta: props.onNoEsta });

  const alScrollear = () => {
    const elemento = contenedor.current;
    if (!elemento) return;
    pegado.current = sigueEnElFinal({ cerca: estaCercaDelFinal(elemento), pegadoAntes: pegado.current, msDesdeElGesto: Date.now() - ultimoGesto.current });
    setLejos(!pegado.current);
    if (elemento.scrollTop < UMBRAL_DE_ANTERIORES_PX && props.hayAnteriores) props.onCargarAnteriores();
  };

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={contenedor}
        onScroll={alScrollear}
        onWheel={anotarGesto}
        onTouchMove={anotarGesto}
        onKeyDown={anotarGesto}
        onPointerDown={anotarGesto}
        data-testid="lista-mensajes"
        className="chat-fondo h-full overflow-y-auto px-4 py-4"
      >
        {!props.hayAnteriores && filas.length > 0 ? (
          <p className="pb-2 text-center text-[11px] text-on-surface-variant">Este es el principio de la conversación</p>
        ) : null}
        <div className="relative w-full" style={{ height: virtualizador.getTotalSize() }}>
          {virtualizador.getVirtualItems().map((item) => {
            const fila = filas[item.index]!;
            return (
              <div
                key={item.key}
                data-index={item.index}
                ref={virtualizador.measureElement}
                data-resaltado={fila.mensaje.seq === resaltado || undefined}
                className="absolute left-0 top-0 w-full rounded-lg transition-colors duration-500 data-[resaltado]:bg-primary/10"
                style={{ transform: `translateY(${item.start}px)` }}
              >
                {fila.nuevoDia ? <ChipDeDia at={fila.mensaje.at} /> : null}
                <BurbujaDeMensaje
                  mensaje={fila.mensaje}
                  mio={fila.mensaje.senderId === yo}
                  agrupado={fila.agrupado}
                  ultimoDelGrupo={fila.ultimoDelGrupo}
                  conAutor={chat.kind === 'group' && !fila.agrupado && fila.mensaje.senderId !== yo}
                  chat={chat}
                  onReintentar={props.onReintentar}
                  onDescartar={props.onDescartar}
                />
              </div>
            );
          })}
        </div>
        {props.escribiendo ? <Escribiendo /> : null}
      </div>
      {lejos ? (
        <button type="button" data-testid="btn-bajar" aria-label="Ir al último mensaje" onClick={bajar} className="absolute bottom-3 right-4 grid h-10 w-10 place-items-center rounded-full border border-outline/15 bg-surface text-on-surface-variant shadow-md hover:bg-background">
          <ChevronDown size={20} />
        </button>
      ) : null}
    </div>
  );
}

function ChipDeDia({ at }: { at: string }) {
  return (
    <div className="my-4 flex justify-center">
      <span className="rounded-full bg-surface px-3 py-1 text-[11px] text-on-surface-variant">{formatDayLabel(at)}</span>
    </div>
  );
}

function Escribiendo() {
  return (
    <div data-testid="escribiendo" className="mt-3 inline-flex rounded-xl border border-outline/15 bg-surface px-4 py-3">
      <span className="flex gap-1">
        {[0, 1, 2].map((punto) => (
          <span key={punto} className="h-1.5 w-1.5 animate-bounce rounded-full bg-outline" style={{ animationDelay: `${punto * 120}ms` }} />
        ))}
      </span>
    </div>
  );
}

/** Pegada: bajar cuando llega algo o el contenido crece (fotos, tarjetas). Al cambiar de chat, abre abajo. */
function useSeguirElFinal(p: { pegado: React.MutableRefObject<boolean>; bajar: () => void; alto: number; cantidad: number; chatId: string }) {
  const { pegado, bajar, alto, cantidad, chatId } = p;
  useLayoutEffect(() => {
    pegado.current = true;
    bajar();
  }, [chatId, pegado, bajar]);
  useLayoutEffect(() => {
    if (pegado.current) bajar();
  }, [alto, cantidad, pegado, bajar]);
}

/**
 * Pegada y la lista se achica (se abre el panel de emojis, la franja de
 * responder, la vista previa de un enlace): sigue mostrando el último mensaje,
 * como WhatsApp. Sin esto el último quedaba tapado (E2E, 19/10).
 */
function useSeguirAlAchicarse(contenedor: React.RefObject<HTMLDivElement>, pegado: React.MutableRefObject<boolean>, bajar: () => void) {
  useEffect(() => {
    const elemento = contenedor.current;
    if (!elemento || typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(() => {
      if (pegado.current) bajar();
    });
    observador.observe(elemento);
    return () => observador.disconnect();
  }, [contenedor, pegado, bajar]);
}

/** Al sumar mensajes ARRIBA (los anteriores), la vista no salta: se corre lo que creció. */
function useConservarAlCargarAnteriores(contenedor: React.RefObject<HTMLDivElement>, primeraClave: string | undefined, alto: number) {
  const previo = useRef({ primeraClave, alto });
  useLayoutEffect(() => {
    const antes = previo.current;
    previo.current = { primeraClave, alto };
    const elemento = contenedor.current;
    if (!elemento || !antes.primeraClave || antes.primeraClave === primeraClave) return;
    elemento.scrollTop += alto - antes.alto;
  }, [contenedor, primeraClave, alto]);
}

/**
 * El acuse sale cuando se VIO: pestaña al frente y abajo (`seqParaAcusar`).
 * Volver a la pestaña también cuenta (auditoría 19/10: lo que llegaba con la
 * pestaña oculta quedaba sin leer hasta el próximo mensaje).
 */
function useAcuseDeLeido(p: { mensajes: MensajeEnPantalla[]; pegado: React.MutableRefObject<boolean>; lejos: boolean; onLeido: (seq: number) => void }) {
  const { mensajes, pegado, lejos, onLeido } = p;
  const ultimoAvisado = useRef(0);
  const [vuelta, setVuelta] = useState(0);
  useEffect(() => {
    const alVolver = () => document.visibilityState === 'visible' && setVuelta((antes) => antes + 1);
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, []);
  useEffect(() => {
    const seq = seqParaAcusar({ mensajes, ultimoAvisado: ultimoAvisado.current, visible: document.visibilityState === 'visible', pegado: pegado.current });
    if (seq === null) return;
    ultimoAvisado.current = seq;
    onLeido(seq);
  }, [mensajes, pegado, lejos, onLeido, vuelta]);
}

/**
 * Ir a un mensaje (el fijado, 19/10): la lista deja de seguir el final, lo
 * centra y lo resalta un momento. Si no está cargado, se dice.
 */
function useSaltoAMensaje(p: {
  salto?: { seq: number; vez: number } | null;
  filas: { mensaje: MensajeEnPantalla }[];
  pegado: React.MutableRefObject<boolean>;
  setLejos: (lejos: boolean) => void;
  scrollToIndex: (indice: number) => void;
  onNoEsta?: () => void;
}): number | null {
  const [resaltado, setResaltado] = useState<number | null>(null);
  // Lo demás en una ref: el efecto corre por cada pedido (`vez`), no por cada render.
  const datos = useRef(p);
  datos.current = p;
  const vez = p.salto?.vez;
  useEffect(() => {
    const { salto, filas, pegado, setLejos, scrollToIndex, onNoEsta } = datos.current;
    if (!salto) return;
    const indice = filas.findIndex((fila) => fila.mensaje.seq === salto.seq && !fila.mensaje.estado);
    if (indice < 0) return onNoEsta?.();
    pegado.current = false;
    setLejos(true);
    scrollToIndex(indice);
    setResaltado(salto.seq);
    const reloj = setTimeout(() => setResaltado(null), RESALTADO_MS);
    return () => clearTimeout(reloj);
  }, [vez]);
  return resaltado;
}
