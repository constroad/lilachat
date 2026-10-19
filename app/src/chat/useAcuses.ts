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
type Parametros = { acuseDe?: readonly string[]; baseLeido: number; baseEntregado: number };

const calcular = (mapa: Map<string, number>, base: number, acuseDe?: readonly string[]) =>
  acuseDe ? acuseDelGrupo({ otros: acuseDe, porMiembro: mapa, base }) : Math.max(base, 0, ...mapa.values());

export function useAcuses(params: Parametros) {
  const leidos = useRef(new Map<string, number>());
  const entregados = useRef(new Map<string, number>());
  const [version, setVersion] = useState(0);
  const parametros = useRef(params);
  parametros.current = params;
  /** Lo último que se dibujó: un acuse que no lo cambia no redibuja nada. */
  const dibujado = useRef({ leido: -1, entregado: -1 });

  /**
   * Un acuse que llegó por el socket. Nunca retrocede (dos dispositivos del
   * otro). Solo redibuja si cambia el check que se ve (FL12, §49 #3): en un
   * grupo llegan muchos acuses que no mueven el mínimo, y cada uno redibujaba
   * la pantalla entera.
   */
  const registrarAcuse = useCallback((userId: string, readSeq?: number, deliveredSeq?: number) => {
    if (typeof readSeq === 'number') leidos.current.set(userId, Math.max(leidos.current.get(userId) ?? 0, readSeq));
    if (typeof deliveredSeq === 'number') {
      entregados.current.set(userId, Math.max(entregados.current.get(userId) ?? 0, deliveredSeq));
    }
    const { acuseDe, baseLeido, baseEntregado } = parametros.current;
    const leido = calcular(leidos.current, baseLeido, acuseDe);
    const entregado = calcular(entregados.current, baseEntregado, acuseDe);
    if (leido === dibujado.current.leido && entregado === dibujado.current.entregado) return;
    setVersion((v) => v + 1);
  }, []);

  const { acuseDe, baseLeido, baseEntregado } = params;
  return useMemo(() => {
    const othersRead = calcular(leidos.current, baseLeido, acuseDe);
    const othersDelivered = calcular(entregados.current, baseEntregado, acuseDe);
    dibujado.current = { leido: othersRead, entregado: othersDelivered };
    return { othersRead, othersDelivered, registrarAcuse };
    // `version` re-calcula al llegar un acuse (los mapas son refs).
  }, [acuseDe, baseLeido, baseEntregado, registrarAcuse, version]);
}
