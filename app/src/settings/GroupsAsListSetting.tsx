import { Rows3 } from 'lucide-react-native';
import { FilaDeAjuste } from '../ui/FilaDeAjuste';
import { Interruptor } from '../ui/Interruptor';
import { setGroupsAsList, useGroupsAsList } from '../ui/groupsAsList';

/**
 * Personal groups as a list, like Slack (José, 21/10; design `s-01`): the
 * name, the role and the time above each message, without bubbles. The chats
 * of a company space always look like that; a 1:1 keeps its bubbles.
 */
export function GroupsAsListSetting() {
  const on = useGroupsAsList();
  return (
    <FilaDeAjuste
      icono={Rows3}
      titulo="Grupos como lista"
      detalle={on ? 'Nombre, cargo y hora sobre cada mensaje, como Slack' : 'Burbujas, como WhatsApp'}
      derecha={<Interruptor testID="sw-grupos-como-lista" value={on} onValueChange={setGroupsAsList} />}
    />
  );
}
