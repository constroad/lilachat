import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { AppState } from 'react-native';
import { loadCredential } from '../auth/credentialStore';
import { hydrateFiles, pendingFilesCount } from '../chat/colaDeArchivos';
import { hydrateOutbox, pendingOutboxCount } from '../chat/outboxStore';
import { connectSocket, disconnectSocket, getSocket } from '../chat/socketClient';
import { pendingUploads } from '../chat/useUploadHold';
import { fieldQueueLoaded } from '../spaces/clients/fieldQueueStore';
import { reportSavesOnDisk } from '../spaces/clients/reports/reportQueueStore';
import { reportarError } from '../ui/reportarError';
import { BACKGROUND_DRAIN_CHECK_MS, drainStep, shouldWakeToDrain } from './backgroundDrainPlan';
// The field queue's senders register themselves on import: the same ones the app loads.
import '../spaces/clients/useDriveUpload';
import '../spaces/visits/visitJobs';
import '../chat/workPlan/evidenceUpload';
import '../spaces/clients/fieldWriteJobs';
import '../spaces/clients/workMap/manualProgressJobs';

/**
 * The queues leave with the app CLOSED (José 26/11, a site without signal: he closed the app on the way back). The
 * system wakes this task when there is network (WorkManager, at most every 15 min); it reads what is still on disk
 * and, only if something is, connects the socket — every queue drains on connect (`alConectar`) — waits until all
 * left or 8 min passed, and disconnects. A living app does not need it: its upload hold sends.
 */
export const QUEUE_DRAIN_TASK = 'lilachat-colas';
const MIN_INTERVAL_MIN = 15;

async function pendingOnDisk(): Promise<number> {
  const [field, reports] = await Promise.all([fieldQueueLoaded(), reportSavesOnDisk(), hydrateOutbox(), hydrateFiles()]);
  return field.filter((job) => !job.refusal).length + reports.filter((save) => !save.refusal).length + pendingOutboxCount() + pendingFilesCount();
}

const pause = (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); });

async function drainUntilDone(): Promise<void> {
  const started = Date.now();
  let quietChecks = 0;
  for (;;) {
    await pause(BACKGROUND_DRAIN_CHECK_MS);
    const step = drainStep({ pending: pendingUploads(), elapsedMs: Date.now() - started, quietChecks });
    if (step.next === 'stop') return;
    quietChecks = step.quietChecks;
  }
}

TaskManager.defineTask(QUEUE_DRAIN_TASK, async () => {
  try {
    const credential = await loadCredential();
    const pending = credential ? await pendingOnDisk() : 0;
    if (!credential || !shouldWakeToDrain({ pending, appAlive: getSocket() !== null, signedIn: true })) return BackgroundTask.BackgroundTaskResult.Success;
    connectSocket(credential.jwt);
    await drainUntilDone();
    // An app that came to the front meanwhile took this same socket: it stays.
    if (AppState.currentState !== 'active') disconnectSocket();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    reportarError('drainInBackground', error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** With a session: the system may wake the drain from now on (it ends in milliseconds when nothing is pending). */
export async function registerQueueDrain(): Promise<void> {
  try {
    if ((await BackgroundTask.getStatusAsync()) === BackgroundTask.BackgroundTaskStatus.Restricted) return;
    if (await TaskManager.isTaskRegisteredAsync(QUEUE_DRAIN_TASK)) return;
    await BackgroundTask.registerTaskAsync(QUEUE_DRAIN_TASK, { minimumInterval: MIN_INTERVAL_MIN });
  } catch (error) {
    reportarError('drainInBackground.register', error);
  }
}

export async function unregisterQueueDrain(): Promise<void> {
  try {
    if (await TaskManager.isTaskRegisteredAsync(QUEUE_DRAIN_TASK)) await BackgroundTask.unregisterTaskAsync(QUEUE_DRAIN_TASK);
  } catch {
    // A task left registered ends by itself: without a credential it does nothing.
  }
}
