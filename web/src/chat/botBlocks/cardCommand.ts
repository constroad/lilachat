import { createContext, useContext } from 'react';

/** Runs a line as if it was typed; `null` where its answer could not be shown (a secret or read-only chat). */
export type CardCommand = (line: string) => void;

export const CardCommandContext = createContext<CardCommand | null>(null);

export const useCardCommand = () => useContext(CardCommandContext);
