import { usesFlatLayout, type PresenceStatus } from '@lilachat/shared';
import { useGroupsAsList } from '../ui/groupsAsList';
import { subtituloDelChat } from './cabeceraDelChat';

/**
 * The header's second line for the open chat: nothing outside the group, «Solo tú lo ves» in a draft, and
 * otherwise `subtituloDelChat` — which counts members in the Slack format and names a few in WhatsApp's.
 * In a group anyone may be typing and not every name is loaded: it says that SOMEONE types, and «en línea»
 * is not shown (with several connected it would be permanent noise).
 */
export function useChatSubtitle(params: {
  fueraDelGrupo: boolean;
  esBorrador: boolean;
  esGrupo: boolean;
  workspaceId?: string;
  escriben: readonly string[];
  otroEnLinea: boolean;
  otroEstado?: PresenceStatus;
  ultimaVez?: string;
  nombres: ReadonlyMap<string, string>;
  /** Everyone the chat detail listed (the names may not all be loaded yet). */
  totalMembers: number;
  yo: string;
}): string {
  const groupsAsList = useGroupsAsList();
  if (params.fueraDelGrupo) return '';
  if (params.esBorrador) return 'Solo tú lo ves';
  return subtituloDelChat({
    esGrupo: params.esGrupo,
    escriben: params.escriben,
    otroEnLinea: params.otroEnLinea,
    otroEstado: params.otroEstado,
    ultimaVez: params.ultimaVez,
    nombres: params.nombres,
    yo: params.yo,
    listMode: usesFlatLayout({ kind: params.esGrupo ? 'group' : 'direct', workspaceId: params.workspaceId }, { groupsAsList }),
    totalMembers: params.totalMembers,
  });
}
