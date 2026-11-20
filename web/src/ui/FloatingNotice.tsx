import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

/** How long a floating notice stays (José 19/11: «Enlace copiado» as in design cc-05). */
export const FLOATING_NOTICE_MS = 2000;

/** A notice that leaves by itself; setting it again restarts its time. */
export function useFloatingNotice(): [string, (text: string) => void] {
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), FLOATING_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);
  return [notice, setNotice];
}

/** The floating notice at the bottom of the screen; `done` puts the check of a finished action. */
export function FloatingNotice(props: { text: string; done?: boolean; testId?: string }) {
  if (!props.text) return null;
  return (
    <p role="status" data-testid={props.testId ?? 'aviso-flotante'} className="pointer-events-none fixed bottom-24 left-1/2 z-50 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-full text-center bg-on-surface px-4 py-2 text-sm font-semibold text-surface shadow-lg">
      {props.done ? <CheckCircle2 size={16} className="shrink-0 text-en-linea" aria-hidden /> : null}
      {props.text}
    </p>
  );
}
