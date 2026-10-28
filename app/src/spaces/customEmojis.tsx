import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CustomEmoji } from '@lilachat/shared';
import { BASE_URL } from '../api/client';
import { jsonCall } from '../api/jsonCall';
import { subirPorXhr } from '../chat/subidaXhr';
import { useSpaceName } from './currentSpace';

/** A space's own emojis (pending 19, designs c-06/c-07): the list, adding and removing. */
const UPLOAD_TIMEOUT_MS = 60_000;
const url = (spaceId: string, path = '') => `${BASE_URL}/api/workspaces/${spaceId}/emojis${path}`;

export const listCustomEmojis = (jwt: string, spaceId: string) => jsonCall<{ emojis: CustomEmoji[] }>(url(spaceId), jwt);
export const removeCustomEmoji = (jwt: string, spaceId: string, emojiId: string) => jsonCall<Record<string, never>>(url(spaceId, `/${emojiId}`), jwt, { method: 'DELETE' });

export async function addCustomEmoji(jwt: string, spaceId: string, input: { name: string; uri: string; mimeType: string }): Promise<{ ok: true; emoji: CustomEmoji } | { ok: false; message: string }> {
  const form = new FormData();
  form.append('name', input.name);
  form.append('file', { uri: input.uri, name: `emoji.${input.mimeType.split('/')[1] ?? 'png'}`, type: input.mimeType } as unknown as Blob);
  const response = await subirPorXhr({ url: url(spaceId), token: jwt, form, timeoutMs: UPLOAD_TIMEOUT_MS });
  if (response.tipo === 'fallo') return { ok: false, message: response.motivo };
  if (response.status < 200 || response.status >= 300) {
    const message = response.payload.message;
    return { ok: false, message: typeof message === 'string' ? message : 'No se pudo guardar el emoji.' };
  }
  return { ok: true, emoji: response.payload.emoji as CustomEmoji };
}

/** One list per space for the session: every chat of the space reads it, nothing polls. */
const cache = new Map<string, CustomEmoji[]>();

export type SpaceEmojis = { jwt: string; spaceId: string; spaceName: string; emojis: CustomEmoji[]; byName: ReadonlyMap<string, CustomEmoji>; reload: () => Promise<void> };

const SpaceEmojisContext = createContext<SpaceEmojis | null>(null);
export const useSpaceEmojis = (): SpaceEmojis | null => useContext(SpaceEmojisContext);

/** Around a chat of a space; outside a space (personal chats) there is nothing to give. */
export function SpaceEmojisProvider(props: { jwt: string; spaceId?: string; children: ReactNode }) {
  const { jwt, spaceId } = props;
  const spaceName = useSpaceName(spaceId);
  const [emojis, setEmojis] = useState<CustomEmoji[]>(() => (spaceId ? (cache.get(spaceId) ?? []) : []));
  const reload = useCallback(async () => {
    if (!spaceId) return;
    const listed = await listCustomEmojis(jwt, spaceId);
    if (!listed.ok) return;
    cache.set(spaceId, listed.data.emojis);
    setEmojis(listed.data.emojis);
  }, [jwt, spaceId]);
  useEffect(() => {
    setEmojis(spaceId ? (cache.get(spaceId) ?? []) : []);
    void reload();
  }, [spaceId, reload]);
  const value = useMemo<SpaceEmojis | null>(
    () => (spaceId ? { jwt, spaceId, spaceName: spaceName || 'el espacio', emojis, byName: new Map(emojis.map((emoji) => [emoji.name, emoji])), reload } : null),
    [jwt, spaceId, spaceName, emojis, reload]
  );
  return <SpaceEmojisContext.Provider value={value}>{props.children}</SpaceEmojisContext.Provider>;
}
