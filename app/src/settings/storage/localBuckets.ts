/**
 * What Lilachat keeps in the phone's cache folder, in the groups the
 * «Almacenamiento» screen shows (pending 13; measured on the emulator on
 * 22/10: downloaded updates and picked-photo copies weighed more than the
 * photos seen). The browser engine and the network cache are not ours to
 * clear. PURE.
 */
export type LocalBucket = 'seen' | 'voice' | 'documents' | 'temporary';

const FOLDERS: Record<string, LocalBucket> = {
  image_manager_disk_cache: 'seen',
  image_cache: 'seen',
  ExpoVideoCache: 'seen',
  'notice-thumbs': 'seen',
  voz: 'voice',
  'pdf-pages': 'documents',
  ImagePicker: 'temporary',
  ImageManipulator: 'temporary',
  Camera: 'temporary',
  Audio: 'temporary',
  apks: 'temporary',
};

export function localBucketOf(name: string, isDirectory: boolean): LocalBucket | null {
  if (isDirectory) return FOLDERS[name] ?? null;
  if (/^sticker-/.test(name) || /^captura-/.test(name)) return 'temporary';
  return 'documents';
}

export function sumBuckets(entries: readonly { bucket: LocalBucket | null; bytes: number }[]): Record<LocalBucket, number> {
  const totals: Record<LocalBucket, number> = { seen: 0, voice: 0, documents: 0, temporary: 0 };
  for (const entry of entries) if (entry.bucket) totals[entry.bucket] += entry.bytes;
  return totals;
}
