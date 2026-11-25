import { createContext, useContext } from 'react';
import type { CardContext, VisitCardAction } from '@lilachat/shared';
import type { AgendaReminder } from '../agenda/agendaApi';
import type { CallBackActions } from './useCallBack';

/**
 * Lo que se puede hacer al tocar una tarjeta del chat (José, 19/10: «no hay
 * cómo editar el recordatorio del grupo»). Viaja por contexto: la tarjeta
 * vive tres componentes abajo de la pantalla del chat. Sin permiso, `undefined`
 * y la tarjeta no responde al toque.
 */
/**
 * `callBack`: «Llamar» and «Recordarme devolverla» on a missed call, only in a 1:1 (backlog 23).
 * `runLine`: a card's row runs its line, with the `seq` of a stored card; absent where its answer could not be shown.
 * `openOrderCard`: an order's card opens that order in «Servicios»; only in a client's channel whose tab this person has.
 * `openVisit`: a visit card's button (lv01) opens Lilachat's visit screen on that action (agentes 14/11).
 * `openService`: an action's `open: { route: 'service' }` (agentes, 20/11) opens that service in «Servicios», no round trip to the bot.
 */
export type AccionesDeTarjeta = { editarRecordatorio?: (recordatorio: AgendaReminder) => void; callBack?: CallBackActions; runLine?: (line: string, seq?: number, context?: CardContext) => void; openOrderCard?: (seq: number) => void; openVisit?: (visitId: string, action: VisitCardAction) => void; openService?: (serviceId: string, reportId?: string) => void; /** I see money in this client's channel: a money report's card opens only then (José 25/11). */ seesMoney?: boolean };

export const AccionesDeTarjetaContext = createContext<AccionesDeTarjeta>({});

export const useAccionesDeTarjeta = () => useContext(AccionesDeTarjetaContext);
