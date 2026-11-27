import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ConfirmDialog } from './ConfirmDialog';

export type ConfirmRequest = { title: string; text: string; confirmLabel: string };

type Pending = { request: ConfirmRequest; answer: (yes: boolean) => void };

/**
 * `window.confirm` with the app's own dialog (José 27/11: the browser's froze the tab): `ask` resolves true once the
 * person confirms, false when they cancel or the screen goes away. Render `dialog` anywhere in the component.
 */
export function useConfirm(): { ask: (request: ConfirmRequest) => Promise<boolean>; dialog: ReactNode } {
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  pendingRef.current = pending;
  useEffect(() => () => pendingRef.current?.answer(false), []);

  const ask = useCallback(
    (request: ConfirmRequest) =>
      new Promise<boolean>((resolve) => {
        pendingRef.current?.answer(false);
        setPending({ request, answer: resolve });
      }),
    []
  );
  const settle = (yes: boolean) => {
    pending?.answer(yes);
    setPending(null);
  };
  const dialog = pending ? <ConfirmDialog {...pending.request} onConfirm={() => settle(true)} onCancel={() => settle(false)} /> : null;
  return { ask, dialog };
}
