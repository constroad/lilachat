import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Ban } from 'lucide-react-native';
import { blockActionLabel, blockConfirmText } from '@lilachat/shared';
import { blockPerson, unblockPerson } from '../settings/blockedApi';
import { useColores } from '../ui/tema';

/**
 * «Bloquear a …» in a 1:1's info (pending 9), like WhatsApp: blocking asks
 * first; unblocking does not. The server closes the chat both ways.
 */
export function BlockContactCard(props: { jwt: string; personId: string; name: string; blockedByMe: boolean }) {
  const colores = useColores();
  const [blocked, setBlocked] = useState(props.blockedByMe);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setBlocked(props.blockedByMe);
  }, [props.blockedByMe]);

  const apply = async (next: boolean) => {
    setBusy(true);
    setError('');
    const outcome = next ? await blockPerson(props.jwt, props.personId) : await unblockPerson(props.jwt, props.personId);
    setBusy(false);
    if (outcome.ok) setBlocked(next);
    else setError(outcome.message);
  };
  const onPress = () => {
    if (blocked) return void apply(false);
    Alert.alert(blockActionLabel(false, props.name), blockConfirmText(props.name), [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Bloquear', style: 'destructive', onPress: () => void apply(true) },
    ]);
  };

  return (
    <View className="mx-4 mt-4 overflow-hidden rounded-xl border border-outline/15 bg-surface">
      <Pressable testID="btn-bloquear-contacto" accessibilityRole="button" disabled={busy} onPress={onPress} className="min-h-[52px] flex-row items-center gap-3 px-4 py-3">
        <Ban size={20} color={blocked ? colores.primary : colores.error} />
        <Text className={`flex-1 text-[15px] font-semibold ${blocked ? 'text-primary' : 'text-error'}`}>{blockActionLabel(blocked, props.name)}</Text>
      </Pressable>
      {error ? <Text className="px-4 pb-3 text-[13px] text-error">{error}</Text> : null}
    </View>
  );
}
