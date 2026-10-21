import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { CircleCheck, Hash, Lock, Plus } from 'lucide-react-native';
import { normalizeChannelName, type ChannelVisibility, type ClientChannel, type ClientWorkspace } from '@lilachat/shared';
import { Modal } from '../ui/Modal';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';
import { createChannel } from './spacesApi';

const DESCRIPTION_MAX = 200;

/**
 * «Crear canal» (E2; design `e2-16-crear-canal`): its name as it will read
 * («Obra Surco» becomes #obra-surco), what it is for, and whether anyone in
 * the space can join or only by invitation. The design's «canal de obra» and
 * people picker wait for the server to keep them.
 */
export function CreateChannelSheet(props: { visible: boolean; jwt: string; space: ClientWorkspace; onCreated: (channel: ClientChannel) => void; onClose: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<ChannelVisibility>('public');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const slug = normalizeChannelName(name);

  useEffect(() => {
    if (!props.visible) return;
    setName('');
    setDescription('');
    setVisibility('public');
    setError('');
  }, [props.visible]);

  const create = async () => {
    if (!slug || busy) return;
    setBusy(true);
    const response = await createChannel(props.jwt, props.space.id, { name: slug, descripcion: description.trim() || undefined, visibility });
    setBusy(false);
    if (!response.ok) return setError(response.message ?? 'No se pudo crear el canal.');
    props.onCreated(response.data.channel);
  };
  const choice = (key: ChannelVisibility, title: string, hint: string, Icon: typeof Hash) => (
    <Pressable key={key} testID={`privacidad-${key}`} onPress={() => setVisibility(key)} accessibilityState={{ selected: visibility === key }} className={`min-h-[96px] flex-1 rounded-2xl border p-3 ${visibility === key ? 'border-primary bg-primary/[0.05]' : 'border-outline/20'}`}>
      <View className="flex-row items-center gap-1.5">
        <Icon size={16} color={visibility === key ? colors.primary : colors['on-surface-variant']} />
        <Text className="flex-1 text-[15px] font-bold text-on-surface">{title}</Text>
        {visibility === key ? <CircleCheck size={18} color={colors.primary} /> : null}
      </View>
      <Text className="mt-1.5 text-[13px] text-on-surface-variant">{hint}</Text>
    </Pressable>
  );

  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={() => !name && props.onClose()}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <Pressable className="flex-1 bg-black/40" onPress={props.onClose} accessibilityLabel="Cerrar" />
        <View testID="hoja-crear-canal" className="max-h-[90%] rounded-t-3xl bg-surface" style={{ paddingBottom: margins.pie + 8 }}>
          <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <View className="flex-row items-start">
              <View className="flex-1">
                <Text className="text-[12px] font-bold uppercase tracking-widest text-primary">Nuevo canal</Text>
                <Text className="text-[24px] font-bold text-on-surface">Crear canal</Text>
              </View>
              <Pressable testID="crear-canal-descartar" onPress={props.onClose} className="min-h-[44px] justify-center px-2">
                <Text className="text-[15px] font-semibold text-primary">Descartar</Text>
              </Pressable>
            </View>
            <Text className="mt-1 text-[14px] text-on-surface-variant">{`Los canales ordenan los temas de obra, cuadrillas y despachos de ${props.space.name}.`}</Text>
            <Text className="mb-2 mt-5 text-[12px] font-bold uppercase tracking-widest text-on-surface">Nombre del canal</Text>
            <View className={`min-h-[52px] flex-row items-center rounded-xl border bg-background px-3 ${slug ? 'border-primary' : 'border-outline/25'}`}>
              <Text className="mr-1 text-[18px] text-primary">#</Text>
              <TextInput testID="input-nombre-canal" value={name} onChangeText={(value) => { setName(value); setError(''); }} autoCapitalize="none" autoCorrect={false} placeholder="obra-surco" placeholderTextColor={colors['on-surface-variant']} className="flex-1 text-[17px] text-on-surface" />
              {slug ? <CircleCheck size={20} color={colors['en-linea']} /> : null}
            </View>
            <Text className="mt-1.5 text-[12px] text-on-surface-variant">{slug && slug !== name.trim() ? `Quedará como #${slug}` : 'Minúsculas, números o guiones, sin espacios.'}</Text>
            <Text className="mb-2 mt-4 text-[12px] font-bold uppercase tracking-widest text-on-surface">Descripción</Text>
            <TextInput testID="input-descripcion-canal" value={description} onChangeText={setDescription} maxLength={DESCRIPTION_MAX} multiline placeholder="Coordinación diaria de la obra Surco" placeholderTextColor={colors['on-surface-variant']} className="min-h-[72px] rounded-xl border border-outline/25 bg-background px-3 py-2.5 text-[15px] text-on-surface" />
            <Text className="mb-2 mt-4 text-[12px] font-bold uppercase tracking-widest text-on-surface">Privacidad del canal</Text>
            <View className="flex-row gap-3">
              {choice('public', 'Público', 'Cualquiera del espacio puede unirse.', Hash)}
              {choice('private', 'Privado', 'Solo por invitación.', Lock)}
            </View>
            {error ? <Text testID="error-crear-canal" className="mt-3 text-[13px] text-error">{error}</Text> : null}
            <Pressable testID="btn-confirmar-canal" disabled={!slug || busy} onPress={() => void create()} className={`mt-5 min-h-[54px] flex-row items-center justify-center gap-2 rounded-2xl bg-primary ${!slug || busy ? 'opacity-50' : ''}`}>
              <Plus size={20} color={colors['on-primary']} />
              <Text className="text-[17px] font-bold text-on-primary">{busy ? 'Creando…' : 'Crear canal'}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
