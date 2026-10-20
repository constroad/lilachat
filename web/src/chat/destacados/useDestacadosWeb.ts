import { useCallback, useEffect, useMemo, useState } from 'react';
import { alternarDestacado } from '@lilachat/shared';
import { api } from '../../api';

/**
 * La estrella personal en un chat de la web (20/10), como la app: qué destaqué,
 * optimista y con vuelta atrás si el server dice que no. No en los secretos.
 */
export function useDestacadosWeb(params: { chatId: string; jwt: string; secreto: boolean }) {
  const { chatId, jwt, secreto } = params;
  const [seqs, setSeqs] = useState<number[]>([]);

  useEffect(() => {
    setSeqs([]);
    if (secreto) return;
    let vigente = true;
    void api<{ seqs: number[] }>(`/chats/${chatId}/destacados`, { jwt }).then((respuesta) => {
      if (vigente && respuesta.ok) setSeqs(respuesta.data.seqs);
    });
    return () => {
      vigente = false;
    };
  }, [chatId, jwt, secreto]);

  const alternar = useCallback(
    async (seq: number) => {
      const quitar = seqs.includes(seq);
      const antes = seqs;
      setSeqs(alternarDestacado(seqs, seq));
      const respuesta = await api(`/chats/${chatId}/destacados/${seq}`, { method: quitar ? 'DELETE' : 'PUT', jwt });
      if (respuesta.ok) return { ok: true };
      setSeqs(antes);
      return { ok: false };
    },
    [seqs, chatId, jwt]
  );

  const conjunto = useMemo(() => new Set(seqs), [seqs]);
  return { seqs: conjunto, alternar };
}
