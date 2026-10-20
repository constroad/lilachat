import { useCallback, useEffect, useMemo, useState } from 'react';
import { alternarDestacado } from '@lilachat/shared';
import { destacarMensaje, leerDestacadosDelChat, quitarDestacado } from '../../api/client';

export type DestacadosDelChat = {
  seqs: ReadonlySet<number>;
  /** Destaca los elegidos; si TODOS ya lo estaban, los quita (como WhatsApp). */
  alternar: (seqs: readonly number[]) => Promise<{ ok: boolean }>;
};

/**
 * La estrella personal en un chat (José aprobó el 20/10): qué mensajes destaqué,
 * optimista y con vuelta atrás si el server dice que no. No en los secretos.
 */
export function useDestacadosDelChat(params: { chatId: string; jwt: string; secreto: boolean }): DestacadosDelChat {
  const { chatId, jwt, secreto } = params;
  const [seqs, setSeqs] = useState<number[]>([]);

  useEffect(() => {
    setSeqs([]);
    if (secreto) return;
    let vigente = true;
    void leerDestacadosDelChat(jwt, chatId).then((respuesta) => {
      if (vigente && respuesta.ok) setSeqs(respuesta.data.seqs);
    });
    return () => {
      vigente = false;
    };
  }, [chatId, jwt, secreto]);

  const alternar = useCallback(
    async (elegidos: readonly number[]) => {
      const quitar = elegidos.every((seq) => seqs.includes(seq));
      const aCambiar = elegidos.filter((seq) => seqs.includes(seq) === quitar);
      const antes = seqs;
      setSeqs(aCambiar.reduce((lista, seq) => alternarDestacado(lista, seq), seqs));
      const resultados = await Promise.all(aCambiar.map((seq) => (quitar ? quitarDestacado(jwt, chatId, seq) : destacarMensaje(jwt, chatId, seq))));
      if (resultados.every((resultado) => resultado.ok)) return { ok: true };
      setSeqs(antes);
      return { ok: false };
    },
    [seqs, jwt, chatId]
  );

  // Estable mientras no cambie: la lista lo usa para redibujar solo las burbujas que cambian.
  const conjunto = useMemo(() => new Set(seqs), [seqs]);
  return { seqs: conjunto, alternar };
}
