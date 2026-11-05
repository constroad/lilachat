import { createContext, useContext } from 'react';

/** Runs a row's line, with the `seq` of its card when it is stored; `null` where its answer could not be shown (a secret or read-only chat). */
export type CardCommand = (line: string, seq?: number) => void;

export const CardCommandContext = createContext<CardCommand | null>(null);

export const useCardCommand = () => useContext(CardCommandContext);
