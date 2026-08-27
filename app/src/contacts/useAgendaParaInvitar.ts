import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { separarAgenda, type ContactoDeAgenda, type ContactoRegistrado } from '@lilachat/shared';
import {
  estadoDeAgenda,
  precargarAgenda,
  suscribirAgenda,
  type EstadoAgendaCruda,
} from './agendaEnMemoria';

/**
 * La gente de tu agenda que TODAVÍA no está en Lilachat.
 *
 * **El cruce se hace acá, en el teléfono.** La agenda no viaja: se compara
 * contra la lista de contactos registrados que el server ya nos dio —gente con
 * la que podemos hablar de todos modos—. Es lo mismo que ve WhatsApp, sin subir
 * la libreta de nadie.
 */
export type ResultadoAgenda =
  | { estado: 'cargando' }
  | { estado: 'denegado' }
  | { estado: 'error'; mensaje: string }
  | { estado: 'listo'; paraInvitar: ContactoDeAgenda[] };

/**
 * La agenda cruda del teléfono, para quien necesite los números (emparejar) y
 * no solo a quién falta invitar.
 */
export function useAgendaDelTelefono(): EstadoAgendaCruda {
  return useLecturaDeAgenda();
}

export type { EstadoAgendaCruda };

/**
 * La agenda del almacén compartido.
 *
 * Hasta el 27/08/2026 este hook LEÍA la agenda al montarse, y ahí estaba la
 * lentitud del lápiz: los 600 contactos se empezaban a leer en el instante en
 * que la persona abría la pantalla y se quedaba mirando esqueletos. Peor, cada
 * pantalla que usaba contactos repetía la lectura entera.
 *
 * Ahora la lectura la dispara `precargarAgenda()` al entrar a la app, y esto
 * solo se asoma al resultado. `precargarAgenda()` sigue acá por si alguna
 * pantalla se monta antes: es idempotente, así que no cuesta nada.
 */
function useLecturaDeAgenda(): EstadoAgendaCruda {
  /**
   * `estadoDeAgenda` devuelve SIEMPRE la misma referencia mientras nada cambie.
   * Es un requisito de `useSyncExternalStore`, no un detalle: si armara un
   * objeto nuevo en cada llamada, React lo leería como «cambió» sin fin y la
   * app entraría en bucle de render.
   */
  const estado = useSyncExternalStore(suscribirAgenda, estadoDeAgenda, estadoDeAgenda);

  // Red de seguridad por si una pantalla se monta antes de la precarga del
  // arranque. Es idempotente: si ya está en curso, se suma a la misma lectura.
  useEffect(() => {
    void precargarAgenda();
  }, []);

  return estado;
}

export function useAgendaParaInvitar(registrados: ContactoRegistrado[] | null): ResultadoAgenda {
  const estado = useLecturaDeAgenda();

  /**
   * El cruce va MEMOIZADO. Son 600+ contactos por normalizar y comparar, y sin
   * esto corría entero en cada render — incluida cada tecla del buscador.
   */
  return useMemo<ResultadoAgenda>(() => {
    if (estado.estado !== 'listo') return estado;
    if (registrados === null) return { estado: 'cargando' };
    return {
      estado: 'listo',
      paraInvitar: separarAgenda({ registrados, agenda: estado.agenda }).paraInvitar,
    };
  }, [estado, registrados]);
}
