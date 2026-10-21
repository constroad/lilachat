import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ArrowRight, ChevronRight, X } from 'lucide-react-native';
import { SPACE_RUBROS, type ClientWorkspace } from '@lilachat/shared';
import { Modal } from '../ui/Modal';
import { Interruptor } from '../ui/Interruptor';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';
import { SpaceLogo } from './SpaceSwitcherSheet';
import { createSpace } from './spacesApi';

const NAME_MAX = 60;

/**
 * «Crea el espacio de tu empresa» (E1; design `e1-04-crear-espacio`): the
 * name, what it does and whether an admin approves who comes in with the
 * code. Whoever creates it is the owner; the logo is the initials until
 * there is a picture. The design's logo upload and «¿cuántas personas?» wait
 * for a place to keep them on the server.
 */
export function CreateSpaceScreen(props: { visible: boolean; jwt: string; onCreated: (space: ClientWorkspace) => void; onJoinInstead: () => void; onClose: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const [name, setName] = useState('');
  const [rubro, setRubro] = useState<string>(SPACE_RUBROS[0]);
  const [approval, setApproval] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const clean = name.trim();

  useEffect(() => {
    if (!props.visible) return;
    setName('');
    setRubro(SPACE_RUBROS[0]);
    setApproval(true);
    setError('');
  }, [props.visible]);

  const create = async () => {
    if (!clean || busy) return;
    setBusy(true);
    const response = await createSpace(props.jwt, { name: clean, rubro, joinPolicy: approval ? 'approval' : 'open' });
    setBusy(false);
    if (!response.ok) return setError(response.message ?? 'No se pudo crear el espacio.');
    props.onCreated(response.data.workspace);
  };

  return (
    <Modal visible={props.visible} animationType="slide" onRequestClose={() => !clean && props.onClose()}>
      <View testID="pantalla-crear-espacio" className="flex-1 bg-background" style={{ paddingTop: margins.cabecera }}>
        <View className="flex-row items-center border-b border-outline/10 px-3 pb-2">
          <Pressable testID="crear-espacio-cerrar" onPress={props.onClose} accessibilityLabel="Cerrar" className="h-11 w-11 items-center justify-center">
            <X size={22} color={colors['on-surface']} />
          </Pressable>
          <View className="flex-1" />
          <Pressable testID="crear-espacio-unirme" onPress={props.onJoinInstead} className="min-h-[44px] flex-row items-center gap-1 px-2">
            <Text className="text-[15px] font-semibold text-primary">Unirme con código</Text>
            <ChevronRight size={18} color={colors.primary} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          <Text className="text-[12px] font-bold uppercase tracking-widest text-primary">Nuevo espacio</Text>
          <Text className="mt-1 text-[26px] font-bold leading-[32px] text-on-surface">Crea el espacio de tu empresa</Text>
          <Text className="mt-1 text-[15px] text-on-surface-variant">Serás el dueño. Lo personal de cada miembro no se ve aquí.</Text>
          <View className="mt-5 rounded-2xl border border-outline/15 bg-surface p-4">
            <View className="flex-row items-center gap-3 border-b border-outline/10 pb-4">
              <SpaceLogo space={{ name: clean || 'Tu empresa' }} size={56} />
              <Text className="min-w-0 flex-1 text-[13px] leading-[19px] text-on-surface-variant">El logo del espacio son sus iniciales, en el color de Lilachat.</Text>
            </View>
            <Text className="mb-2 mt-4 text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">Nombre de la empresa</Text>
            <View className={`min-h-[56px] flex-row items-center rounded-xl border px-4 ${clean ? 'border-primary' : 'border-outline/25'}`}>
              <TextInput testID="input-nombre-espacio" value={name} onChangeText={(value) => { setName(value); setError(''); }} maxLength={NAME_MAX} placeholder="CONSTROAD" placeholderTextColor={colors['on-surface-variant']} className="flex-1 text-[18px] font-semibold text-on-surface" />
            </View>
            <Text className="mb-2 mt-4 text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">Rubro</Text>
            <View className="flex-row flex-wrap gap-2">
              {SPACE_RUBROS.map((option) => (
                <Pressable key={option} testID={`rubro-${option}`} onPress={() => setRubro(option)} accessibilityState={{ selected: rubro === option }} className={`min-h-[44px] justify-center rounded-xl border px-3.5 ${rubro === option ? 'border-primary bg-primary/[0.06]' : 'border-outline/20'}`}>
                  <Text className={`text-[14px] ${rubro === option ? 'font-semibold text-primary' : 'text-on-surface'}`}>{option}</Text>
                </Pressable>
              ))}
            </View>
            <View className="mt-4 flex-row items-center gap-3 border-t border-outline/10 pt-4">
              <View className="min-w-0 flex-1">
                <Text className="text-[15px] font-semibold text-on-surface">Aprobar a quien entre con el código</Text>
                <Text className="text-[13px] text-on-surface-variant">Recibirás una solicitud cada vez que alguien nuevo use el código, antes de ver los canales.</Text>
              </View>
              <Interruptor testID="sw-aprobar-ingreso" value={approval} onValueChange={setApproval} />
            </View>
          </View>
          {error ? <Text testID="error-crear-espacio" className="mt-3 text-[13px] text-error">{error}</Text> : null}
        </ScrollView>
        <View className="px-5 pt-2" style={{ paddingBottom: margins.pie + 8 }}>
          <Pressable testID="btn-crear-espacio" disabled={!clean || busy} onPress={() => void create()} className={`min-h-[56px] flex-row items-center justify-center gap-2 rounded-2xl bg-primary ${!clean || busy ? 'opacity-50' : ''}`}>
            <Text className="text-[17px] font-bold text-on-primary">{busy ? 'Creando…' : 'Crear espacio'}</Text>
            <ArrowRight size={18} color={colors['on-primary']} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
