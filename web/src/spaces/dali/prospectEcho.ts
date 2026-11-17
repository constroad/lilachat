import { useEffect } from 'react';
import type { ProspectView } from '@lilachat/shared';

/**
 * A seller's change shows at once everywhere it is on screen (the strip, the ficha, the inbox), not two seconds later
 * when the socket's notice reads the list again.
 */
const echoes = new Set<(prospect: ProspectView) => void>();

export const echoProspect = (prospect: ProspectView): void => echoes.forEach((listener) => listener(prospect));

export function useProspectEcho(listener: (prospect: ProspectView) => void): void {
  useEffect(() => {
    echoes.add(listener);
    return () => {
      echoes.delete(listener);
    };
  }, [listener]);
}
