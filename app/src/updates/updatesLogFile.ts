import { File, Paths } from 'expo-file-system';

/**
 * expo-updates' own log (`PersistentFileLog`, files dir). It purges it at every
 * launch by READING every line into memory, and `clearLogEntriesAsync` does the
 * same purge. Once the file grew past what fits, the purge always failed, so
 * the file never shrank and every OTA added hundreds of lines. The heap filled
 * at startup and the next allocation (an Intl.Collator, a list) crashed the
 * app, in any mode (José, 30/10). Nobody reads that log.
 */
export const UPDATES_LOG_FILE = 'dev.expo.modules.core.logging.dev.expo.updates';

/** Writes the log blank, without reading it; run before the app mounts. False when there was nothing to do or it failed. */
export function emptyUpdatesLog(): boolean {
  try {
    const log = new File(Paths.document, UPDATES_LOG_FILE);
    if (!log.exists) return false;
    log.write('');
    return true;
  } catch (error) {
    console.warn('[ota] could not empty the updates log:', error instanceof Error ? error.message : String(error));
    return false;
  }
}
