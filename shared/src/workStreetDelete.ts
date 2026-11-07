import { FORMS_LEVEL } from './appForms.js';
import { sendMapTool, type WorkProgressDeps, type WorkProgressResult } from './workProgressSend.js';

/**
 * «Borrar calle» of the map (José 07/11: anyone deletes, an admin restores). Portal's
 * `borrar_calle_de_obra` is logical: the street and its tramos come back with `restaurar_de_obra`.
 * Portal refuses a street with progress, so the metrado and the valuation keep adding up.
 * PURE: the APK and the web ask and send from here.
 */
export type WorkStreetDeleteRequest = { kind: 'work_street_delete'; street_id: string; forms: number };

export const STREET_DELETED = 'Calle borrada. Un admin puede restaurarla.';
export const STREET_DELETE_FAILED = 'No se pudo borrar la calle. Revisa tu señal y vuelve a intentarlo.';
export const STREET_DELETE_ACTION = 'Borrar calle';

export const workStreetDeleteRequest = (streetId: string): WorkStreetDeleteRequest => ({ kind: 'work_street_delete', street_id: streetId, forms: FORMS_LEVEL });

/** The confirmation names the street and what goes with it. */
export const streetDeleteAsk = (name: string): { title: string; hint: string } => ({
  title: `¿Borrar «${name}»?`,
  hint: 'Sus tramos se borran con ella. Un admin puede restaurarla. Una calle con avance no se borra.',
});

/** Nothing to fill: the street rides as context from the server's door. */
export const sendWorkStreetDelete = (deps: WorkProgressDeps): Promise<WorkProgressResult> => sendMapTool(deps, {}, { sent: STREET_DELETED, failed: STREET_DELETE_FAILED });

/** A deleted street leaves the map at once: the map is asked again after Portal answers. */
export const deleteThenReload = <Send extends (id: string) => Promise<WorkProgressResult>>(send: Send | undefined, reload: () => Promise<unknown>): ((id: string) => Promise<WorkProgressResult>) | undefined =>
  send ? async (id) => {
    const result = await send(id);
    if (result.ok) void reload();
    return result;
  } : undefined;
