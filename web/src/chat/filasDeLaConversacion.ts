import { groupsWithPrevious, startsNewDay } from '@lilachat/shared';
import type { MensajeEnPantalla } from './types';

/** Cuánto (px) cuenta como «estar abajo»: lo mismo que la app. */
export const MARGEN_DEL_FINAL_PX = 160;

export type FilaDeLaConversacion = {
  mensaje: MensajeEnPantalla;
  /** Va el chip «Hoy / Ayer / fecha» arriba. */
  nuevoDia: boolean;
  /** Sigue al anterior del mismo autor: menos aire arriba. */
  agrupado: boolean;
  /** Cierra su bloque: lleva la hora y los checks. */
  ultimoDelGrupo: boolean;
};

const mismoBloque = (actual: MensajeEnPantalla, anterior?: MensajeEnPantalla): boolean =>
  Boolean(anterior) &&
  actual.kind !== 'system' &&
  anterior!.kind !== 'system' &&
  groupsWithPrevious({ senderId: actual.senderId, at: actual.at, previousSenderId: anterior!.senderId, previousAt: anterior!.at });

/** Las decisiones de dibujo de cada fila, fuera del componente (W1). */
export function filasDeLaConversacion(mensajes: MensajeEnPantalla[]): FilaDeLaConversacion[] {
  return mensajes.map((mensaje, indice) => {
    const anterior = mensajes[indice - 1];
    const siguiente = mensajes[indice + 1];
    const nuevoDia = startsNewDay(mensaje.at, anterior?.at);
    return {
      mensaje,
      nuevoDia,
      agrupado: !nuevoDia && mismoBloque(mensaje, anterior),
      ultimoDelGrupo: !siguiente || startsNewDay(siguiente.at, mensaje.at) || !mismoBloque(siguiente, mensaje),
    };
  });
}

export const estaCercaDelFinal = (medidas: { scrollTop: number; clientHeight: number; scrollHeight: number }): boolean =>
  medidas.scrollHeight - (medidas.scrollTop + medidas.clientHeight) < MARGEN_DEL_FINAL_PX;

/** Tras un gesto de la persona (rueda, toque, tecla), cuánto vale como «fue ella». */
export const VENTANA_DEL_GESTO_MS = 1000;

/**
 * ¿Sigue pegada al final después de este scroll? (W2, la misma regla que la
 * app). Llegar abajo siempre pega; alejarse solo despega si fue la persona.
 * El navegador mueve el scroll solo al crecer una fila (una foto que carga) y
 * eso no puede contar como «subió a leer».
 */
export function sigueEnElFinal(params: { cerca: boolean; pegadoAntes: boolean; msDesdeElGesto: number }): boolean {
  if (params.cerca) return true;
  return params.msDesdeElGesto < VENTANA_DEL_GESTO_MS ? false : params.pegadoAntes;
}
