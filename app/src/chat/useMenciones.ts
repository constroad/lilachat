import { useCallback, useRef, useState } from 'react';
import type { MencionEnMensaje } from '@lilachat/shared';
import { completarMencion, consultaDeMencion, rangosDeMenciones, type ConsultaDeMencion, type MencionElegida } from './textoDelComposer';

export type MiembroMencionable = { id: string; nombre: string; foto?: string };

/** Cuántas sugerencias se muestran a la vez: más tapan la conversación. */
const MAX_SUGERENCIAS = 5;

const sinTildes = (texto: string) => texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * Las @menciones del composer (José, 18/10: «en un grupo no puedo taggear»).
 * Mira el «@algo» que se está escribiendo, sugiere miembros, recuerda a quién
 * se eligió y al enviar arma los rangos sobre el texto final.
 */
export function useMenciones(miembros: readonly MiembroMencionable[] | undefined) {
  const [consulta, setConsulta] = useState<ConsultaDeMencion | null>(null);
  const elegidas = useRef<MencionElegida[]>([]);

  const alCambiar = useCallback(
    (texto: string, cursor: number) => {
      if (!miembros?.length) return;
      const nueva = consultaDeMencion(texto, cursor);
      setConsulta((antes) => (antes?.inicio === nueva?.inicio && antes?.consulta === nueva?.consulta ? antes : nueva));
    },
    [miembros]
  );

  const buscada = consulta ? sinTildes(consulta.consulta) : '';
  const sugerencias = consulta && miembros ? miembros.filter((m) => sinTildes(m.nombre).includes(buscada)).slice(0, MAX_SUGERENCIAS) : [];

  /** Cambia el «@an» por «@Ana » y devuelve el texto y el cursor nuevos. */
  const elegir = (texto: string, miembro: MiembroMencionable) => {
    if (!consulta) return null;
    elegidas.current = [...elegidas.current.filter((m) => m.userId !== miembro.id), { userId: miembro.id, nombre: miembro.nombre }];
    setConsulta(null);
    return completarMencion(texto, consulta, miembro.nombre);
  };

  /** Para `buildOutboxItem`: los rangos sobre el texto ya recortado. Sin elegidas, nada. */
  const rangos = (): ((texto: string) => MencionEnMensaje[]) | undefined => {
    const lista = elegidas.current;
    return lista.length > 0 ? (texto) => rangosDeMenciones(texto, lista) : undefined;
  };

  const limpiar = () => {
    elegidas.current = [];
    setConsulta(null);
  };

  return { sugerencias, alCambiar, elegir, rangos, limpiar };
}
