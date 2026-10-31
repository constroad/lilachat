import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ArrowLeft, Check, KeyRound } from 'lucide-react-native';
import { membersLabel, SPACE_RUBROS, type ClientWorkspace } from '@lilachat/shared';
import { Modal } from '../ui/Modal';
import { Interruptor } from '../ui/Interruptor';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';
import { SpaceLogo } from './SpaceSwitcherSheet';
import { removeSpaceLogo, updateSpace, uploadSpaceLogo } from './spacesApi';
import { elegirFotoRedonda } from '../chat/fotoDeGrupo';
import { IntegrationsSection } from './IntegrationsSection';

const NAME_MAX = 60;

/**
 * «Ajustes del espacio» (design `e1-12-ajustes-espacio`), for admins: the
 * name, the trade, whether an admin approves who comes in, and a new code
 * (the old one stops working), and its logo: an image, or its initials.
 */
export function SpaceSettingsScreen(props: { space: ClientWorkspace; jwt: string; onSaved: (space: ClientWorkspace) => void; onClose: () => void; onOpenApp?: (appId: string) => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const { space } = props;
  const [name, setName] = useState(space.name);
  const [rubro, setRubro] = useState(space.rubro ?? '');
  const [approval, setApproval] = useState(space.joinPolicy === 'approval');
  const [code, setCode] = useState(space.joinCode);
  const [logoUrl, setLogoUrl] = useState(space.logoUrl);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const clean = name.trim();
  const changed = clean !== space.name || rubro !== (space.rubro ?? '') || approval !== (space.joinPolicy === 'approval');

  const save = async (change: Parameters<typeof updateSpace>[2]) => {
    setBusy(true);
    const response = await updateSpace(props.jwt, space.id, change);
    setBusy(false);
    if (!response.ok) return setError(response.message ?? 'No se pudo guardar.');
    setError('');
    setCode(response.data.workspace.joinCode);
    props.onSaved(response.data.workspace);
  };
  const changeLogo = async () => {
    const picked = await elegirFotoRedonda({ titulo: 'Logo del espacio', mensaje: 'Lo ven todos los del espacio.', nombrePorDefecto: 'logo.jpg' });
    if (picked.tipo !== 'foto') return;
    setBusy(true);
    const sent = await uploadSpaceLogo(props.jwt, space.id, picked.foto);
    setBusy(false);
    if (!sent.ok) return setError(sent.message);
    setError('');
    setLogoUrl(sent.workspace.logoUrl);
    props.onSaved(sent.workspace);
  };
  const removeLogo = async () => {
    setBusy(true);
    const response = await removeSpaceLogo(props.jwt, space.id);
    setBusy(false);
    if (!response.ok) return setError(response.message ?? 'No se pudo quitar el logo.');
    setLogoUrl(undefined);
    props.onSaved(response.data.workspace);
  };
  const newCode = () =>
    Alert.alert('¿Cambiar el código?', 'El código actual deja de funcionar. Quienes ya están en el espacio siguen igual.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cambiar', onPress: () => void save({ newCode: true }) },
    ]);

  return (
    <Modal visible animationType="slide" onRequestClose={props.onClose}>
      <View testID="pantalla-ajustes-espacio" className="flex-1 bg-background" style={{ paddingTop: margins.cabecera }}>
        <View className="flex-row items-center gap-2 border-b border-outline/10 px-3 pb-2">
          <Pressable testID="ajustes-espacio-volver" onPress={props.onClose} accessibilityLabel="Volver" className="h-11 w-11 items-center justify-center">
            <ArrowLeft size={22} color={colors['on-surface']} />
          </Pressable>
          <View className="min-w-0 flex-1">
            <Text numberOfLines={1} className="text-[11px] font-bold uppercase tracking-widest text-primary">{space.name}</Text>
            <Text className="text-[18px] font-bold text-on-surface">Ajustes del espacio</Text>
          </View>
          <Pressable testID="ajustes-espacio-guardar" disabled={!clean || !changed || busy} onPress={() => void save({ name: clean, rubro: rubro || undefined, joinPolicy: approval ? 'approval' : 'open' })} className={`min-h-[44px] flex-row items-center gap-1.5 rounded-xl bg-primary px-3 ${!clean || !changed || busy ? 'opacity-40' : ''}`}>
            <Check size={16} color={colors['on-primary']} />
            <Text className="text-[14px] font-bold text-on-primary">Guardar</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: margins.pie + 24 }} keyboardShouldPersistTaps="handled">
          <View className="flex-row items-center gap-2">
            <Text className="rounded-md border border-en-linea/40 bg-en-linea/10 px-2 py-0.5 text-[11px] font-bold text-en-linea">ACTIVO</Text>
            <Text className="flex-1 text-[14px] text-on-surface-variant">{`${membersLabel(space.members)} activos`}</Text>
          </View>
          {error ? <Text testID="error-ajustes-espacio" className="mt-3 text-[13px] text-error">{error}</Text> : null}
          <View className="mt-3 rounded-2xl border border-outline/15 bg-surface p-4">
            <Text className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Espacio</Text>
            <View className="mt-3 flex-row items-center gap-3">
              <SpaceLogo space={{ name: clean || space.name, logoUrl }} size={56} />
              <View className="min-w-0 flex-1">
                <Text className="text-[14px] font-semibold text-on-surface">Logo del espacio</Text>
                <Text className="text-[12px] text-on-surface-variant">Una imagen cuadrada, o las iniciales del nombre.</Text>
                <View className="mt-2 flex-row gap-2">
                  <Pressable testID="ajustes-cambiar-logo" disabled={busy} onPress={() => void changeLogo()} className="min-h-[40px] justify-center rounded-xl border border-outline/25 px-3"><Text className="text-[14px] font-semibold text-on-surface">Cambiar logo</Text></Pressable>
                  {logoUrl ? <Pressable testID="ajustes-quitar-logo" disabled={busy} onPress={() => void removeLogo()} className="min-h-[40px] justify-center px-2"><Text className="text-[14px] font-semibold text-on-surface-variant">Restablecer</Text></Pressable> : null}
                </View>
              </View>
            </View>
            <Text className="mb-1.5 mt-4 text-[14px] font-semibold text-on-surface">Nombre del espacio</Text>
            <TextInput testID="input-nombre-ajustes" value={name} onChangeText={setName} maxLength={NAME_MAX} className="min-h-[48px] rounded-xl border border-outline/25 bg-background px-3 text-[16px] text-on-surface" />
            <Text className="mb-1.5 mt-4 text-[14px] font-semibold text-on-surface">Rubro</Text>
            <View className="flex-row flex-wrap gap-2">
              {SPACE_RUBROS.map((option) => (
                <Pressable key={option} testID={`ajustes-rubro-${option}`} onPress={() => setRubro(option)} className={`min-h-[40px] justify-center rounded-xl border px-3 ${rubro === option ? 'border-primary bg-primary/10' : 'border-outline/20'}`}>
                  <Text className={`text-[14px] font-semibold ${rubro === option ? 'text-primary' : 'text-on-surface'}`}>{option}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View className="mt-4 rounded-2xl border border-outline/15 bg-surface p-4">
            <Text className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Ingreso</Text>
            <Text className="mb-2 mt-3 text-[14px] font-semibold text-on-surface">Código de ingreso</Text>
            <View className="flex-row items-center gap-3 rounded-xl bg-background p-3">
              <KeyRound size={18} color={colors.primary} />
              <Text testID="codigo-ajustes" selectable className="flex-1 font-mono text-[20px] font-bold tracking-widest text-on-surface">{code}</Text>
              <Pressable testID="ajustes-cambiar-codigo" disabled={busy} onPress={newCode} className="min-h-[40px] justify-center rounded-xl border border-outline/25 bg-surface px-3">
                <Text className="text-[14px] font-semibold text-primary">Cambiar código</Text>
              </Pressable>
            </View>
            <View className="mt-4 flex-row items-center gap-3 border-t border-outline/10 pt-4">
              <View className="min-w-0 flex-1">
                <Text className="text-[15px] font-semibold text-on-surface">Aprobar a quien entre con el código</Text>
                <Text className="mt-0.5 text-[13px] text-on-surface-variant">Recibirás una solicitud cada vez que alguien nuevo use el código, antes de ver los canales.</Text>
              </View>
              <Interruptor testID="ajustes-aprobar" value={approval} onValueChange={setApproval} />
            </View>
          </View>
          <IntegrationsSection jwt={props.jwt} spaceId={space.id} onOpenApp={props.onOpenApp} />
        </ScrollView>
      </View>
    </Modal>
  );
}
