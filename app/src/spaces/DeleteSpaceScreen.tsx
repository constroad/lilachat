import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ArrowLeft, Trash2 } from 'lucide-react-native';
import { confirmsSpaceName, type ClientWorkspace } from '@lilachat/shared';
import { Modal } from '../ui/Modal';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';
import { deleteSpace } from './spacesApi';

const CONSEQUENCES = [
  'Nadie podrá entrar al espacio ni ver sus canales, chats y archivos.',
  'Las apps conectadas se desinstalan y el código para unirse deja de funcionar.',
  'Los chats personales de cada persona siguen igual.',
];

/**
 * «Eliminar espacio» (José 10/11), for its owner: what goes away is said
 * plainly and the name is typed to confirm. Personal chats stay.
 */
export function DeleteSpaceScreen(props: { space: ClientWorkspace; jwt: string; onDeleted: () => void; onClose: () => void }) {
  const { space } = props;
  const colors = useColores();
  const margins = useMargenes();
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = confirmsSpaceName(typed, space.name) && !busy;
  const remove = async () => {
    setBusy(true);
    const response = await deleteSpace(props.jwt, space.id, typed);
    setBusy(false);
    if (!response.ok) return setError(response.message ?? 'No se pudo eliminar el espacio. Prueba de nuevo.');
    props.onDeleted();
  };
  return (
    <Modal visible animationType="slide" onRequestClose={props.onClose}>
      <View testID="pantalla-eliminar-espacio" className="flex-1 bg-background" style={{ paddingTop: margins.cabecera }}>
        <View className="flex-row items-center gap-2 border-b border-outline/10 px-3 pb-2">
          <Pressable testID="eliminar-espacio-volver" onPress={props.onClose} accessibilityLabel="Volver" className="h-11 w-11 items-center justify-center">
            <ArrowLeft size={22} color={colors['on-surface']} />
          </Pressable>
          <Text className="flex-1 text-[18px] font-bold text-on-surface">Eliminar espacio</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <Text className="text-[11px] font-bold uppercase tracking-widest text-error">No se puede deshacer desde la app</Text>
          <Text className="mt-1 text-[20px] font-bold text-on-surface">{`¿Eliminar ${space.name}?`}</Text>
          {CONSEQUENCES.map((line) => <Text key={line} className="mt-2 text-[15px] leading-5 text-on-surface-variant">{`• ${line}`}</Text>)}
          <Text className="mb-1.5 mt-5 text-[14px] font-semibold text-on-surface">{`Escribe «${space.name}» para confirmar`}</Text>
          <TextInput testID="eliminar-espacio-nombre" value={typed} onChangeText={setTyped} autoCorrect={false} autoCapitalize="none" className="min-h-[48px] rounded-xl border border-outline/25 bg-background px-3 text-[16px] text-on-surface" />
          {error ? <Text testID="error-eliminar-espacio" className="mt-2 text-[13px] text-error">{error}</Text> : null}
        </ScrollView>
        <View className="border-t border-outline/10 px-4 pt-3" style={{ paddingBottom: margins.pie + 12 }}>
          <Pressable testID="eliminar-espacio-confirmar" disabled={!ready} onPress={() => void remove()} className={`min-h-[52px] flex-row items-center justify-center gap-2 rounded-xl bg-error ${ready ? '' : 'opacity-40'}`}>
            <Trash2 size={18} color="#ffffff" />
            <Text className="text-[16px] font-bold text-white">Eliminar espacio</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
