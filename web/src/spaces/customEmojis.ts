import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { CustomEmoji } from '@lilachat/shared';
import { api } from '../api';

/** A space's own emojis (pending 19, designs c-06/c-07): one list per space for the tab, nothing polls. */
const path = (spaceId: string, rest = '') => `/workspaces/${spaceId}/emojis${rest}`;

export const removeCustomEmoji = (jwt: string, spaceId: string, emojiId: string) => api<Record<string, never>>(path(spaceId, `/${emojiId}`), { jwt, method: 'DELETE' });

export async function addCustomEmoji(jwt: string, spaceId: string, input: { name: string; file: File }): Promise<{ ok: true; emoji: CustomEmoji } | { ok: false; message: string }> {
  const form = new FormData();
  form.append('name', input.name);
  // The original bytes: shrinking would flatten a GIF's animation.
  form.append('file', input.file, input.file.name);
  try {
    const response = await fetch(`/api${path(spaceId)}`, { method: 'POST', headers: { Authorization: `Bearer ${jwt}` }, body: form });
    const payload = (await response.json().catch(() => ({}))) as { emoji?: CustomEmoji; message?: string };
    return response.ok && payload.emoji ? { ok: true, emoji: payload.emoji } : { ok: false, message: payload.message ?? 'No se pudo guardar el emoji.' };
  } catch {
    return { ok: false, message: 'Sin conexión. Revisa tu internet.' };
  }
}

const lists = new Map<string, CustomEmoji[]>();
const asked = new Set<string>();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const EMPTY: CustomEmoji[] = [];

export function useSpaceEmojis(jwt: string, spaceId: string | undefined): { emojis: CustomEmoji[]; byName: ReadonlyMap<string, CustomEmoji>; reload: () => Promise<void> } {
  const emojis = useSyncExternalStore(subscribe, () => (spaceId ? (lists.get(spaceId) ?? EMPTY) : EMPTY));
  const reload = useCallback(async () => {
    if (!spaceId || !jwt) return;
    asked.add(spaceId);
    const listed = await api<{ emojis: CustomEmoji[] }>(path(spaceId), { jwt });
    if (!listed.ok) return;
    lists.set(spaceId, listed.data.emojis);
    listeners.forEach((listener) => listener());
  }, [jwt, spaceId]);
  useEffect(() => {
    if (spaceId && !asked.has(spaceId)) void reload();
  }, [spaceId, reload]);
  const byName = useMemo(() => new Map(emojis.map((emoji) => [emoji.name, emoji])), [emojis]);
  return { emojis, byName, reload };
}
