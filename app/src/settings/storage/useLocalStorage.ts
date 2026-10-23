import { useCallback, useEffect, useState } from 'react';
import { Directory, File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import { clearVideoCacheAsync } from 'expo-video';
import { forgetDownloadedVoiceNotes } from '../../chat/voiceNoteCache';
import { localBucketOf, sumBuckets, type LocalBucket } from './localBuckets';

/** The folder expo-sqlite keeps the messages in. */
const DATABASE_FOLDER = 'SQLite';

export type LocalStorage = { buckets: Record<LocalBucket, number>; messages: number; total: number; free: number; disk: number };

function bytesOf(entry: Directory | File): number {
  if (entry instanceof File) return entry.size ?? 0;
  const native = entry.info().size;
  if (typeof native === 'number') return native;
  return entry.list().reduce((sum, child) => sum + bytesOf(child), 0);
}

const cacheEntries = () => new Directory(Paths.cache).list().map((entry) => ({ entry, bucket: localBucketOf(entry.name, entry instanceof Directory) }));

async function measure(): Promise<LocalStorage> {
  const entries = cacheEntries().map(({ entry, bucket }) => ({ bucket, bytes: bucket ? bytesOf(entry) : 0 }));
  const database = new Directory(Paths.document, DATABASE_FOLDER);
  const messages = database.exists ? bytesOf(database) : 0;
  const buckets = sumBuckets(entries);
  const total = Object.values(buckets).reduce((sum, bytes) => sum + bytes, 0) + messages;
  return { buckets, messages, total, free: Paths.availableDiskSpace, disk: Paths.totalDiskSpace };
}

/** Deletes one group; the photos and videos also go through their libraries, which keep their own index. */
async function free(bucket: LocalBucket): Promise<void> {
  if (bucket === 'seen') await Promise.all([Image.clearDiskCache(), clearVideoCacheAsync().catch(() => undefined)]);
  for (const { entry } of cacheEntries().filter((candidate) => candidate.bucket === bucket)) {
    try {
      entry.delete();
    } catch (error) {
      console.warn('[almacenamiento] no se pudo borrar:', entry.name, error instanceof Error ? error.message : error);
    }
  }
  if (bucket === 'voice') forgetDownloadedVoiceNotes();
}

/**
 * What Lilachat keeps on this phone (pending 13), measured when the screen
 * opens and again after each «Liberar».
 */
export function useLocalStorage(active: boolean) {
  const [storage, setStorage] = useState<LocalStorage | null>(null);
  const refresh = useCallback(async () => setStorage(await measure()), []);
  useEffect(() => {
    if (active) void refresh();
  }, [active, refresh]);
  const release = useCallback(async (bucket: LocalBucket) => {
    await free(bucket);
    await refresh();
  }, [refresh]);
  return { storage, release };
}
