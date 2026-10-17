import { useEffect, useMemo, useRef, useState } from 'react';
import { coincidenciasEnChat, moverCoincidencia } from '@lilachat/shared';

/** Tras la última tecla, cuánto se espera para saltar a la coincidencia. */
const ESPERA_PARA_SALTAR_MS = 250;

/**
 * Buscar dentro del chat (FL9), como WhatsApp: se escribe, salta a la
 * coincidencia más nueva, y ↑/↓ recorren el resto. El estado vive acá para que
 * `ChatScreen` no crezca; saltar lo hace la pantalla (`irA`), que conoce la lista.
 */
export function useBuscarEnChat(params: {
  mensajes: readonly { seq: number; body?: string; kind?: string; deletedAt?: string | null }[];
  irA: (seq: number) => void;
}) {
  const [activo, setActivo] = useState(false);
  const [consulta, setConsulta] = useState('');
  const [indice, setIndice] = useState(-1);
  const irARef = useRef(params.irA);
  irARef.current = params.irA;

  const coincidencias = useMemo(
    () => (activo ? coincidenciasEnChat(params.mensajes, consulta) : []),
    [activo, params.mensajes, consulta]
  );

  // Al cambiar lo escrito, a la más nueva (la de más abajo), sin saltar en
  // cada tecla. Que lleguen mensajes nuevos no mueve a nadie de donde está.
  const total = coincidencias.length;
  const totalRef = useRef(total);
  totalRef.current = total;
  useEffect(() => {
    setIndice(-1);
    if (!activo) return;
    const espera = setTimeout(() => setIndice(totalRef.current - 1), ESPERA_PARA_SALTAR_MS);
    return () => clearTimeout(espera);
  }, [consulta, activo]);

  const seqActual = indice >= 0 ? coincidencias[indice] : undefined;
  useEffect(() => {
    if (seqActual !== undefined) irARef.current(seqActual);
  }, [seqActual]);

  const mover = (hacia: 'anterior' | 'siguiente') =>
    setIndice((actual) => moverCoincidencia({ total, actual: actual < 0 ? total : actual, hacia }));

  return {
    activo,
    consulta,
    setConsulta,
    total,
    /** 1 = la más vieja; 0 = ninguna elegida todavía. */
    posicion: indice + 1,
    seqActual,
    abrir: () => setActivo(true),
    cerrar: () => {
      setActivo(false);
      setConsulta('');
    },
    anterior: () => mover('anterior'),
    siguiente: () => mover('siguiente'),
  };
}
