import { createContext, useContext } from 'react';
import type { AgendaReminder } from '../agenda/agendaApi';
import type { CallBackActions } from './useCallBack';

/**
 * Lo que se puede hacer al tocar una tarjeta del chat (José, 19/10: «no hay
 * cómo editar el recordatorio del grupo»). Viaja por contexto: la tarjeta
 * vive tres componentes abajo de la pantalla del chat. Sin permiso, `undefined`
 * y la tarjeta no responde al toque.
 */
/** `callBack`: «Llamar» and «Recordarme devolverla» on a missed call, only in a 1:1 (backlog 23). */
export type AccionesDeTarjeta = { editarRecordatorio?: (recordatorio: AgendaReminder) => void; callBack?: CallBackActions };

export const AccionesDeTarjetaContext = createContext<AccionesDeTarjeta>({});

export const useAccionesDeTarjeta = () => useContext(AccionesDeTarjetaContext);
