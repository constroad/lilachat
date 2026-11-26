import { useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import { detenerServicio, iniciarServicio } from '../../modules/servicio-socket/src';
import { fieldQueueNow, subscribeFieldQueue } from '../spaces/clients/fieldQueueStore';
import { reportQueue } from '../spaces/clients/reports/reportQueueStore';
import { pendingFilesCount, suscribirArchivos } from './colaDeArchivos';
import { pendingOutboxCount, subscribeOutbox } from './outboxStore';
import { pauseSocket } from './socketClient';
import { uploadHoldStep } from './uploadHold';

/** What still has to leave the phone: field jobs, report saves, chat files and texts (refused ones wait for the person). */
export function pendingUploads(): number {
  const field = fieldQueueNow().filter((job) => !job.refusal).length;
  const reports = reportQueue.snapshot().saves.filter((save) => !save.refusal).length;
  return field + reports + pendingFilesCount() + pendingOutboxCount();
}

function subscribeUploads(listener: () => void): () => void {
  const stops = [subscribeFieldQueue(listener), reportQueue.subscribe(listener), suscribirArchivos(listener), subscribeOutbox(listener)];
  return () => stops.forEach((stop) => void stop());
}

/**
 * Holds the socket in the back while uploads are pending (`uploadHold.ts`). `shouldPause` replaces the
 * app's plain «pause in the back»: it answers false (and holds) when something is still to go.
 */
export function useUploadHold(active: boolean, permanent: boolean): { shouldPause: () => boolean } {
  const holding = useRef(false);
  const apply = useRef(() => undefined as void);
  apply.current = () => {
    const step = uploadHoldStep({ permanent, pending: pendingUploads(), holding: holding.current });
    if (step === 'hold') {
      // Only in front: from the back Android refuses the service; the next time in front starts it.
      if (AppState.currentState !== 'active') return;
      holding.current = true;
      iniciarServicio();
    } else if (step === 'release') {
      holding.current = false;
      if (!permanent) detenerServicio();
      if (AppState.currentState !== 'active' && !permanent) pauseSocket();
    }
  };
  useEffect(() => {
    if (!active) return undefined;
    const stop = subscribeUploads(() => apply.current());
    const appState = AppState.addEventListener('change', () => apply.current());
    return () => {
      stop();
      appState.remove();
    };
  }, [active]);
  // Stable: the app's AppState effect lists it as a dependency.
  return useMemo(() => ({
    shouldPause: () => {
      apply.current();
      return !holding.current;
    },
  }), []);
}
