import { useEffect, useState } from 'react';
import type { GifResult } from '@lilachat/shared';
import { BASE_URL } from '../../api/client';
import { jsonCall } from '../../api/jsonCall';

/** GIPHY through Lilachat's server (backlog 37; `server/src/gifRoutes.ts`): the key never reaches the phone. */
const url = (path: string) => `${BASE_URL}/api/gifs${path}`;

export const searchGifs = (jwt: string, q: string, offset: number) => jsonCall<{ gifs: GifResult[] }>(url(`/search?${new URLSearchParams({ q, offset: String(offset) })}`), jwt);

/** A new key per tap: the same tap retried by the network is one message on the server. */
export const sendGif = (jwt: string, chatId: string, gifId: string, clientKey: string) => jsonCall<{ message: unknown }>(url('/send'), jwt, { method: 'POST', body: JSON.stringify({ chatId, gifId, clientKey }) });

let known: boolean | null = null;

/** Whether the server has GIPHY's key: without it the panel has no «GIF» tab. Asked once per session. */
export function useGifsAvailable(jwt: string): boolean {
  const [available, setAvailable] = useState(known === true);
  useEffect(() => {
    if (known !== null) return;
    let alive = true;
    void jsonCall<{ available: boolean }>(url(''), jwt).then((result) => {
      if (!result.ok) return;
      known = result.data.available === true;
      if (alive) setAvailable(known);
    });
    return () => {
      alive = false;
    };
  }, [jwt]);
  return available;
}
