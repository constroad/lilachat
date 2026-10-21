import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, Share, Text, TextInput, ToastAndroid, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { ArrowLeft, Copy, Share2 } from 'lucide-react-native';
import { spaceInviteMessage, type ClientWorkspace } from '@lilachat/shared';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';
import { SpaceLogo } from './SpaceSwitcherSheet';
import { addToSpace } from './spacesApi';

/** A Peruvian mobile, as the server keeps it: nine digits. */
const PHONE_DIGITS = 9;

/**
 * «Invitar personas» (E1; design `e1-05-invitar`): the space's code to copy
 * or send by WhatsApp, and adding someone by number — in at once if they
 * already use Lilachat, otherwise invited until they sign up with it. Only
 * those who can invite see the code.
 */
export function InviteToSpaceScreen(props: { space: ClientWorkspace | null; jwt: string; onClose: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const { space } = props;
  const [phone, setPhone] = useState('');
  const [added, setAdded] = useState<{ phone: string; status: string }[]>([]);
  const [error, setError] = useState('');
  const digits = phone.replace(/\D/g, '');

  useEffect(() => {
    setPhone('');
    setAdded([]);
    setError('');
  }, [space?.id]);

  if (!space) return null;
  const message = space.joinCode ? spaceInviteMessage({ spaceName: space.name, code: space.joinCode }) : '';
  const copy = async () => {
    if (!space.joinCode) return;
    await Clipboard.setStringAsync(space.joinCode);
    ToastAndroid.show('Código copiado', ToastAndroid.SHORT);
  };
  const sendByWhatsApp = async () => {
    const opened = await Linking.openURL(`whatsapp://send?text=${encodeURIComponent(message)}`).then(() => true, () => false);
    if (!opened) await Share.share({ message, title: `Invitar a ${space.name}` });
  };
  const add = async () => {
    if (digits.length !== PHONE_DIGITS) return setError('Escribe los 9 dígitos del celular.');
    const response = await addToSpace(props.jwt, space.id, digits);
    if (!response.ok) return setError(response.message ?? 'No se pudo agregar.');
    setAdded((before) => [{ phone: digits, status: response.data.member.status }, ...before.filter((one) => one.phone !== digits)]);
    setPhone('');
    setError('');
  };

  return (
    <Modal visible animationType="slide" onRequestClose={props.onClose}>
      <View testID="pantalla-invitar-espacio" className="flex-1 bg-background" style={{ paddingTop: margins.cabecera }}>
        <View className="flex-row items-center gap-2 px-3 pb-2">
          <Pressable testID="invitar-volver" onPress={props.onClose} accessibilityLabel="Volver" className="h-11 w-11 items-center justify-center">
            <ArrowLeft size={22} color={colors.primary} />
          </Pressable>
          <SpaceLogo space={space} size={30} />
          <Text numberOfLines={1} className="flex-1 text-[20px] font-bold text-on-surface">{`Invitar a ${space.name}`}</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: margins.pie + 24 }} keyboardShouldPersistTaps="handled">
          <Text className="text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">{space.name}</Text>
          <Text className="mt-1 text-[26px] font-bold text-on-surface">Invitar personas</Text>
          <Text className="mt-1 text-[15px] text-on-surface-variant">Comparte el acceso al espacio para sumar a tu equipo.</Text>
          {space.joinCode ? (
            <View testID="tarjeta-codigo-espacio" className="mt-5 overflow-hidden rounded-2xl border border-outline/15 bg-surface">
              <View className="h-[3px] bg-primary" />
              <View className="p-4">
                <View className="flex-row items-center justify-between">
                  <Text className="text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">Código del espacio</Text>
                  <Text className="rounded-full border border-en-linea/40 bg-en-linea/10 px-2 py-0.5 text-[11px] font-bold text-en-linea">ACTIVO</Text>
                </View>
                <Text testID="codigo-espacio" selectable className="my-4 text-center font-mono text-[34px] font-bold tracking-[6px] text-on-surface">{space.joinCode}</Text>
                <View className="flex-row gap-3">
                  <Pressable testID="btn-copiar-codigo" onPress={() => void copy()} className="min-h-[48px] flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-outline/20">
                    <Copy size={18} color={colors.primary} />
                    <Text className="text-[15px] font-semibold text-on-surface">Copiar</Text>
                  </Pressable>
                  <Pressable testID="btn-whatsapp-codigo" onPress={() => void sendByWhatsApp()} className="min-h-[48px] flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-outline/20">
                    <Share2 size={18} color={colors['en-linea']} />
                    <Text className="text-[15px] font-semibold text-on-surface">WhatsApp</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : (
            <Text className="mt-5 rounded-2xl bg-surface-variant p-4 text-[14px] text-on-surface-variant">El código lo tienen los admins del espacio: pídeselo a uno de ellos.</Text>
          )}
          {space.joinCode ? (
            <View className="mt-4 rounded-2xl border border-outline/15 bg-surface p-4">
              <Text className="text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">Agregar por número</Text>
              <Text className="mt-1 text-[14px] text-on-surface-variant">Entra al toque si ya usa Lilachat; si no, cuando entre con ese número.</Text>
              <View className="mt-3 flex-row gap-3">
                <View className="min-h-[52px] flex-1 flex-row items-center rounded-xl border border-outline/25 px-3">
                  <Text className="mr-2 border-r border-outline/20 pr-2 text-[15px] text-on-surface-variant">+51</Text>
                  <TextInput testID="input-telefono-espacio" value={phone} onChangeText={(value) => { setPhone(value); setError(''); }} keyboardType="phone-pad" maxLength={11} placeholder="987 111 222" placeholderTextColor={colors['on-surface-variant']} className="flex-1 text-[17px] font-semibold text-on-surface" />
                </View>
                <Pressable testID="btn-agregar-telefono" onPress={() => void add()} className="min-h-[52px] items-center justify-center rounded-xl bg-primary px-5">
                  <Text className="text-[16px] font-bold text-on-primary">Agregar</Text>
                </Pressable>
              </View>
              {error ? <Text testID="error-agregar-telefono" className="mt-2 text-[13px] text-error">{error}</Text> : null}
              {added.length ? <Text className="mb-1 mt-4 text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">Agregados recientes</Text> : null}
              {added.map((one) => (
                <View key={one.phone} className="min-h-[56px] flex-row items-center gap-3 border-t border-outline/10">
                  <Avatar nombre={one.phone} tamano={40} />
                  <Text className="flex-1 text-[15px] text-on-surface">{one.phone.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')}</Text>
                  <Text className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${one.status === 'active' ? 'border-en-linea/40 bg-en-linea/10 text-en-linea' : 'border-primary/30 bg-primary/10 text-primary'}`}>{one.status === 'active' ? 'AGREGADO' : 'INVITADO'}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
