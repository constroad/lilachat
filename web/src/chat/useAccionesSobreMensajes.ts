import { useCallback, useEffect, useState } from 'react';
import type { MencionEnMensaje } from '@lilachat/shared';
import type { ResultadoDeAccion } from '../sync/envioPorSocket';
import type { AccionSobreMensaje } from './contextoDeLaConversacion';
import type { ContextoDelComposer } from './Composer';
import type { MensajeEnPantalla } from './types';
import { copiarTexto } from './copiarTexto';

export type AccionesDeSync = {
  enviarTexto: (chatId: string, body: string, extra?: { replyToSeq?: number; menciones?: MencionEnMensaje[]; hiloDe?: number; enElChat?: boolean }) => Promise<void>;
  editar: (chatId: string, seq: number, body: string) => Promise<ResultadoDeAccion>;
  reaccionar: (chatId: string, seq: number, emoji: string | null) => Promise<ResultadoDeAccion>;
  eliminarParaTodos: (chatId: string, seq: number) => Promise<ResultadoDeAccion>;
  eliminarParaMi: (chatId: string, seq: number) => Promise<void>;
  reenviar: (chatIds: string[], body: string) => Promise<void>;
  avisarEscribiendo: (chatId: string) => void;
  /** The MSN nudge (backlog 3). */
  sendNudge: (chatId: string) => Promise<ResultadoDeAccion>;
};

/**
 * Qué se está haciendo con un mensaje del chat abierto (W2): respondiendo,
 * editando, eliminando, reenviando o viendo su «Info». Uno a la vez; cambiar
 * de chat lo suelta todo.
 */
export function useAccionesSobreMensajes(params: {
  chatId: string | null;
  sync: AccionesDeSync;
  nombres: ReadonlyMap<string, string>;
  onAviso: (texto: string) => void;
}) {
  const { chatId, sync, nombres, onAviso } = params;
  const [respondiendo, setRespondiendo] = useState<MensajeEnPantalla | null>(null);
  const [editando, setEditando] = useState<MensajeEnPantalla | null>(null);
  const [eliminando, setEliminando] = useState<MensajeEnPantalla | null>(null);
  const [reenviando, setReenviando] = useState<MensajeEnPantalla | null>(null);
  const [viendoInfo, setViendoInfo] = useState<MensajeEnPantalla | null>(null);

  useEffect(() => {
    setRespondiendo(null);
    setEditando(null);
    setEliminando(null);
    setReenviando(null);
    setViendoInfo(null);
  }, [chatId]);

  const onAccion = useCallback(
    (mensaje: MensajeEnPantalla, accion: AccionSobreMensaje) => {
      if (accion === 'copiar') {
        void copiarTexto(mensaje.body ?? '').then((copiado) => onAviso(copiado ? 'Copiado' : 'No se pudo copiar.'));
      } else if (accion === 'responder') {
        setEditando(null);
        setRespondiendo(mensaje);
      } else if (accion === 'editar') {
        setRespondiendo(null);
        setEditando(mensaje);
      } else if (accion === 'reenviar') setReenviando(mensaje);
      else if (accion === 'info') setViendoInfo(mensaje);
      else setEliminando(mensaje);
    },
    [onAviso]
  );

  const contexto: ContextoDelComposer | null = editando
    ? { tipo: 'edicion', titulo: 'Editando', texto: editando.body ?? '', clave: editando.clientKey }
    : respondiendo
      ? { tipo: 'respuesta', titulo: `Respondiendo a ${nombres.get(respondiendo.senderId) ?? 'Alguien'}`, texto: respondiendo.body ?? 'Archivo', clave: respondiendo.clientKey }
      : null;

  /** Lo que sale del campo: una edición, una respuesta o un mensaje nuevo. */
  const enviar = async (texto: string, menciones?: MencionEnMensaje[]) => {
    if (!chatId) return;
    if (editando) {
      const original = editando;
      setEditando(null);
      if (texto === original.body) return;
      const resultado = await sync.editar(chatId, original.seq, texto);
      if (!resultado.ok) onAviso(resultado.motivo);
      return;
    }
    const replyToSeq = respondiendo?.seq;
    setRespondiendo(null);
    await sync.enviarTexto(chatId, texto, { ...(replyToSeq ? { replyToSeq } : {}), ...(menciones?.length ? { menciones } : {}) });
  };

  return {
    onAccion,
    contexto,
    /** The message being replied to: a sticker sent now quotes it too. */
    replyingTo: editando ? undefined : respondiendo?.seq,
    cancelarContexto: () => {
      setRespondiendo(null);
      setEditando(null);
    },
    enviar,
    eliminando,
    cerrarEliminar: () => setEliminando(null),
    reenviando,
    cerrarReenviar: () => setReenviando(null),
    viendoInfo,
    cerrarInfo: () => setViendoInfo(null),
  };
}
