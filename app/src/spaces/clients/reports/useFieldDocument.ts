import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import * as Crypto from 'expo-crypto';
import { createReportScreen, type ReportRef } from '@lilachat/shared';
import { loadCredential } from '../../../auth/credentialStore';
import { alConectar } from '../../../chat/socketClient';
import { devicePlaceNow } from './devicePlace';
import { dropReportPhoto, keepReportPhoto, reportQueue } from './reportQueueStore';

/**
 * The report's screen on the phone (`shared/reportScreen`): the document with
 * the queue over it and the section's form. When the signal comes back it
 * asks Portal again, so «sin señal» goes away by itself.
 */
export function useFieldDocument({ spaceId, clientId, chatId, serviceId, type, reportId }: ReportRef & { reportId?: string }) {
  const personName = useRef<string | null>(null);
  useEffect(() => {
    void loadCredential().then((credential) => {
      personName.current = credential?.name ?? null;
    });
  }, []);
  const actions = useMemo(
    () => createReportScreen({ queue: reportQueue, keepPhoto: keepReportPhoto, dropPhoto: dropReportPhoto, placeNow: devicePlaceNow, personName: () => personName.current, newKey: Crypto.randomUUID, now: () => new Date().toISOString() }, { spaceId, clientId, chatId, serviceId, type }, reportId),
    [spaceId, clientId, chatId, serviceId, type, reportId]
  );
  const state = useSyncExternalStore(actions.subscribe, actions.snapshot);
  useEffect(() => {
    const stop = alConectar(() => actions.refresh());
    return () => {
      stop();
    };
  }, [actions]);
  return { ...state, actions };
}
