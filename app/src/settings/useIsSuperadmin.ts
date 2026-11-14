import { useEffect, useState } from 'react';
import { adminAccess } from '../spaces/spacesApi';

/**
 * Is this account the superadmin? The server decides (200 for him, 403 for anyone else):
 * without an answer, nothing of his shows (José 13/11, Ajustes → Superadmin).
 */
export function useIsSuperadmin(jwt: string): boolean {
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  useEffect(() => {
    let alive = true;
    void adminAccess(jwt).then((response) => {
      if (alive) setIsSuperadmin(response.ok && response.data.superadmin === true);
    });
    return () => {
      alive = false;
    };
  }, [jwt]);
  return isSuperadmin;
}
