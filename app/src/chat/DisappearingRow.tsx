import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { Timer } from 'lucide-react-native';
import { DISAPPEAR_OPTIONS, disappearDetail, disappearKeyOf, type DisappearKey } from '@lilachat/shared';
import { saveDisappearing } from '../api/client';
import { FilaDeAjuste } from '../ui/FilaDeAjuste';
import type { DisappearSetting } from './disappearSetting';

/**
 * «Mensajes temporales» in the chat settings (R31/10-B6, like WhatsApp): the
 * timer is for everyone in the chat, so the server writes the notice and checks
 * who may move it. A refusal goes back and says why.
 */
export function DisappearingRow(props: DisappearSetting) {
  const [key, setKey] = useState<DisappearKey>(disappearKeyOf(props.seconds));
  useEffect(() => {
    setKey(disappearKeyOf(props.seconds));
  }, [props.seconds]);
  const choose = (next: DisappearKey) => {
    if (next === key) return;
    const before = key;
    setKey(next);
    void saveDisappearing(props.chatId, props.jwt, next).then((result) => {
      if (result.ok) return;
      setKey(before);
      props.onNotice(result.message);
    });
  };
  const ask = () =>
    Alert.alert('Mensajes temporales', 'Los mensajes nuevos desaparecen del chat para todos después del tiempo que elijas.', [...DISAPPEAR_OPTIONS.map((option) => ({ text: option.label, onPress: () => choose(option.key) })), { text: 'Cancelar', style: 'cancel' as const }], { cancelable: true });
  return <FilaDeAjuste testID="btn-temporales" icono={Timer} titulo="Mensajes temporales" detalle={disappearDetail(key, props.canChange)} deshabilitada={!props.canChange} onPress={ask} />;
}
