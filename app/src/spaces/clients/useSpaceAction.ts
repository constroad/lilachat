import { useEffect, useMemo, useState } from 'react';
import { placedActionRow, type ShortcutRow } from '@lilachat/shared';
import { spaceCommands } from '../../chat/commands/commandsApi';
import { useAppAnswers } from '../../chat/commands/useAppAnswers';

/**
 * An action of the space run from a place of its own (José 30/10: «Crear un
 * cliente» in the clients' picker, not in the ⚡). Read each time that place
 * opens; `row` is null while it is off in the space or that person may not run it.
 */
export function useSpaceAction(jwt: string, spaceId: string, key: string, wanted: boolean) {
  const [row, setRow] = useState<ShortcutRow | null>(null);
  const scope = useMemo(() => ({ workspaceId: spaceId }), [spaceId]);
  const answers = useAppAnswers({ jwt, scope });
  useEffect(() => {
    if (!wanted) return;
    let alive = true;
    void spaceCommands(jwt, spaceId, 'space').then((result) => {
      if (alive) setRow(result.ok ? (placedActionRow(result.data.groups, key) ?? null) : null);
    });
    return () => {
      alive = false;
    };
  }, [jwt, spaceId, key, wanted]);
  return { row, answers };
}
