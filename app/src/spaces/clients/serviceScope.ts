import { createContext } from 'react';
import type { ServiceAskTarget } from './useServiceAsk';

/** The open service, for what deep in its tabs writes by the field queue (José 26/11) without threading props. */
export type ServiceScope = { target: ServiceAskTarget; chatId: string; serviceId: string };
export const ServiceScopeContext = createContext<ServiceScope | null>(null);
