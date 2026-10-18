import { useCallback, useState } from 'react';
import type { Respondiendo } from './Composer';

/**
 * Responder y editar en la conversación (salió de `ChatScreen`). Los dos usan
 * la barra de escribir, así que empezar a editar cancela la respuesta.
 */
export function useRespuestaYEdicion(params: {
  editar: (seq: number, texto: string) => Promise<{ ok: boolean; motivo?: string }>;
  onError: (texto: string) => void;
}) {
  const { editar, onError } = params;
  const [respondiendoA, setRespondiendoA] = useState<Respondiendo | null>(null);
  const [editando, setEditando] = useState<{ seq: number; texto: string } | null>(null);

  const alResponder = useCallback((seq: number, texto: string, mio: boolean) => setRespondiendoA({ seq, texto, mio }), []);
  const cancelarRespuesta = useCallback(() => setRespondiendoA(null), []);
  const empezarEdicion = useCallback((seq: number, texto: string) => {
    setRespondiendoA(null);
    setEditando({ seq, texto });
  }, []);
  const cancelarEdicion = useCallback(() => setEditando(null), []);
  const guardarEdicion = useCallback(
    async (seq: number, texto: string) => {
      const resultado = await editar(seq, texto);
      if (!resultado.ok) {
        onError(resultado.motivo ?? 'No se pudo editar.');
        return false;
      }
      setEditando(null);
      return true;
    },
    [editar, onError]
  );

  return {
    respondiendoA,
    editando,
    alResponder,
    cancelarRespuesta,
    empezarEdicion,
    cancelarEdicion,
    guardarEdicion,
  };
}
