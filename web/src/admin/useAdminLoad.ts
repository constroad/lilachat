import { useEffect, useState } from 'react';
import type { ApiResult } from '../api';

export type AdminLoad<T> = { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; forbidden: boolean; message: string };
export type AdminRequest<T> = (signal: AbortSignal) => Promise<ApiResult<T>>;

/**
 * One read of the superadmin's panel: asked again when `request` changes
 * (memoize it on its query) or on «Reintentar» (`attempt`); the previous one
 * is cancelled. `null` asks nothing (the other view is open).
 */
export function useAdminLoad<T>(request: AdminRequest<T> | null, attempt: number): AdminLoad<T> {
  const [load, setLoad] = useState<AdminLoad<T>>({ status: 'loading' });
  useEffect(() => {
    if (!request) return;
    const controller = new AbortController();
    setLoad({ status: 'loading' });
    void request(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setLoad(result.ok ? { status: 'ready', data: result.data } : { status: 'error', forbidden: result.status === 403, message: result.message });
    });
    return () => controller.abort();
  }, [request, attempt]);
  return load;
}
