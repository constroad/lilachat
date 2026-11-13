import { createContext, useContext } from 'react';
import type { CardContext } from '@lilachat/shared';

/**
 * Runs a row's line, with the `seq` of its card when it is stored and what a form shows of that card (design gst-02);
 * `null` where its answer could not be shown (a secret or read-only chat).
 */
export type CardCommand = (line: string, seq?: number, context?: CardContext) => void;

export const CardCommandContext = createContext<CardCommand | null>(null);

export const useCardCommand = () => useContext(CardCommandContext);

/** Opens the order of a card's message in «Servicios»; `null` outside a client's channel. */
export const OrderCardContext = createContext<((seq: number) => void) | null>(null);
