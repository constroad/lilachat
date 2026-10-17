import { useCallback, useMemo, useRef, useState } from 'react';
import { acuseDelGrupo } from '@lilachat/shared';

/**
 * Los acuses de los OTROS, en vivo, por miembro (FL8). Antes se guardaba el
 * mayor de cualquiera: en un grupo el check se ponía azul con el primero que
 * leía. Ahora manda la misma regla que el server (`acuseDelGrupo`): el menor
 * entre los que cuentan (`acuseDe`, sin mí ni Lila), y quien no mandó acuse en
 * vivo vale lo último que dijo el server (la base).
 *
 * Sin `acuseDe` (un server viejo) se cae al comportamiento anterior.
 */
export function useAcuses(params: { acuseDe?: readonly string[]; baseLeido: number; baseEntregado: number }) {
  const leidos = useRef(new Map<string, number>());
  const entregados = useRef(new Map<string, number>());
  const [version, setVersion] = useState(0);

  /** Un acuse que llegó por el socket. Nunca retrocede (dos dispositivos del otro). */
  const registrarAcuse = useCallback((userId: string, readSeq?: number, deliveredSeq?: number) => {
    if (typeof readSeq === 'number') leidos.current.set(userId, Math.max(leidos.current.get(userId) ?? 0, readSeq));
    if (typeof deliveredSeq === 'number') {
      entregados.current.set(userId, Math.max(entregados.current.get(userId) ?? 0, deliveredSeq));
    }
    setVersion((v) => v + 1);
  }, []);

  const { acuseDe, baseLeido, baseEntregado } = params;
  return useMemo(() => {
    const calcular = (mapa: Map<string, number>, base: number) =>
      acuseDe ? acuseDelGrupo({ otros: acuseDe, porMiembro: mapa, base }) : Math.max(base, 0, ...mapa.values());
    return {
      othersRead: calcular(leidos.current, baseLeido),
      othersDelivered: calcular(entregados.current, baseEntregado),
      registrarAcuse,
    };
    // `version` re-calcula al llegar un acuse (los mapas son refs).
  }, [acuseDe, baseLeido, baseEntregado, registrarAcuse, version]);
}
