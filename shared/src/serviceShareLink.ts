import type { FormValues } from './appForms.js';
import { runServiceLinkAction, type ServiceMapDeps, type ServiceMapResult } from './serviceMap.js';

/**
 * «Enlace del servicio» made in place (José 20/11: the button only took him to the chat and
 * nothing happened). The same door as the map's link (`service_link` → `crear_enlace_de_servicio`):
 * its form asks `dias` (1 to 60, 7 by default) and `noExpira`. PURE: the app and the web draw with it.
 */
export const SERVICE_LINK_DAY_OPTIONS = [7, 30, 60] as const;
export const SERVICE_LINK_DAYS_MIN = 1;
export const SERVICE_LINK_DAYS_MAX = 60;
export const SERVICE_LINK_FAILED = 'No se pudo crear el enlace del servicio. Prueba de nuevo.';

/** What the person picked in the sheet: a term in days, or «No expira». */
export type ServiceLinkChoice = { days: number; never: boolean };

/** The form's answers; «No expira» ignores the days, as Portal does. */
export function serviceLinkValues(choice: ServiceLinkChoice): FormValues {
  if (choice.never) return { noExpira: true };
  const days = Math.min(SERVICE_LINK_DAYS_MAX, Math.max(SERVICE_LINK_DAYS_MIN, Math.round(choice.days)));
  return { dias: days, noExpira: false };
}

/** Makes the service's public link with the choice; its address, or why not. */
export const createServiceLink = (deps: ServiceMapDeps, choice: ServiceLinkChoice): Promise<ServiceMapResult> =>
  runServiceLinkAction(deps, serviceLinkValues(choice), SERVICE_LINK_FAILED);
