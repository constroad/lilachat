import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { createReportScreen, type ReportRef } from '@lilachat/shared';
import { loadPerfil } from '../../../api';
import { devicePlaceNow } from './devicePlace';
import { dropReportPhoto, keepReportPhoto, reportQueue, useReportQueueStart } from './reportQueueStore';

/**
 * The report's page in the browser (`shared/reportScreen`): the document with
 * the queue over it and the section's form. When the network comes back it
 * asks Portal again, so «sin señal» goes away by itself.
 */
export function useFieldDocument(jwt: string, { spaceId, clientId, chatId, serviceId, type, reportId }: ReportRef & { reportId?: string }) {
  useReportQueueStart(jwt, loadPerfil()?.userId ?? null);
  const actions = useMemo(
    () => createReportScreen<File>({ queue: reportQueue, keepPhoto: keepReportPhoto, dropPhoto: dropReportPhoto, placeNow: devicePlaceNow, personName: () => loadPerfil()?.name, newKey: () => crypto.randomUUID(), now: () => new Date().toISOString() }, { spaceId, clientId, chatId, serviceId, type }, reportId),
    [spaceId, clientId, chatId, serviceId, type, reportId]
  );
  const state = useSyncExternalStore(actions.subscribe, actions.snapshot);
  useEffect(() => {
    const refresh = () => actions.refresh();
    window.addEventListener('online', refresh);
    return () => window.removeEventListener('online', refresh);
  }, [actions]);
  return { ...state, actions };
}
