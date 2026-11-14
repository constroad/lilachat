import { createContext } from 'react';
import type { VisitCardAction } from '@lilachat/shared';

/** A button of the visit card lv01 (agentes 14/11): Lilachat opens its screen, the app never gets the tap. */
export type OpenVisitAction = (visitId: string, action: VisitCardAction) => void;
export const VisitActionContext = createContext<OpenVisitAction | null>(null);
