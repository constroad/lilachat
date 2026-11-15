import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { Camera, CameraOff, Settings, Smartphone } from 'lucide-react-native';
import { useColores } from '../../../ui/tema';
import { BottomAction, ObservationHeader } from '../observations/ObservationParts';

type Props = { state: string; kicker: string; zone: number; reportCode: string | null; onBack: () => void; onPhotoInstead: () => void };
type Copy = { title: string; body: string };

const PERMISSION: Copy = { title: 'Lilachat necesita la cámara para medir', body: 'Activa el permiso de cámara en los ajustes del teléfono y vuelve aquí.' };
const NO_AR: Record<string, Copy> = {
  declined: { title: 'Falta instalar Google Play Services para AR', body: 'Instálalo desde Play Store para medir con AR. Mientras tanto, mide la zona con una foto y la wincha.' },
  error: { title: 'El AR no pudo arrancar', body: 'Mide la zona con una foto y la wincha: el resultado va igual al informe.' },
};
const NO_AR_DEFAULT: Copy = { title: 'Este teléfono no tiene AR', body: 'Mide la zona con una foto y la wincha: el resultado va igual al informe.' };
const PHOTO_STEPS = ['Toma una foto de la zona desde arriba.', 'Toca sus esquinas sobre la foto.', 'Mide un lado con la wincha y escríbelo.'];

/**
 * Design la-07 (José 15/11): the camera is off or the phone cannot run the AR.
 * One state at a time (the mockup stacks both to show them); the photo and
 * the tape always measure. Stitch's «Del servicio», «Obra registrada» and the
 * zone summary are left out: the zone is not measured yet.
 */
export function ArUnavailable(props: Props) {
  const colors = useColores();
  const permission = props.state === 'no-permission';
  return (
    <View testID="ar-no-disponible" className="flex-1 bg-background">
      <ObservationHeader kicker={`${props.kicker} · Zona ${props.zone}`} title="Medir área" onBack={props.onBack} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">{permission ? 'Sin permiso de cámara' : 'Teléfono sin AR'}</Text>
        {permission ? <PermissionCard /> : <NoArCard copy={NO_AR[props.state] ?? NO_AR_DEFAULT} />}
      </ScrollView>
      <BottomAction testID="medir-con-foto" label="Medir con foto + wincha" icon={<Camera size={22} color={colors['on-primary']} />} busy={false} note={props.reportCode ? `Se sumará al informe ${props.reportCode}` : null} onPress={props.onPhotoInstead} />
    </View>
  );
}

function PermissionCard() {
  const colors = useColores();
  return (
    <View className="gap-3 rounded-2xl border border-outline/15 bg-surface p-4">
      <View className="flex-row items-start justify-between">
        <View className="h-16 w-16 items-center justify-center rounded-full border border-warning/40 bg-warning/15"><CameraOff size={28} color={colors.warning} /></View>
        <Text className="rounded-md border border-warning/40 bg-warning/10 px-2 py-0.5 text-[11px] font-bold uppercase text-warning">Pendiente</Text>
      </View>
      <Text className="text-[22px] font-bold text-on-surface">{PERMISSION.title}</Text>
      <Text className="text-[15px] text-on-surface-variant">{PERMISSION.body}</Text>
      <Pressable testID="abrir-ajustes" onPress={() => void Linking.openSettings()} className="h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-primary">
        <Settings size={20} color={colors['on-primary']} />
        <Text className="text-[16px] font-bold text-on-primary">Abrir ajustes</Text>
      </Pressable>
    </View>
  );
}

function NoArCard({ copy }: { copy: Copy }) {
  const colors = useColores();
  return (
    <View className="gap-3 rounded-2xl border border-outline/15 border-t-[3px] border-t-primary bg-surface p-4">
      <View className="flex-row items-start justify-between">
        <View className="h-16 w-16 items-center justify-center rounded-full border border-outline/30 bg-surface-variant"><Smartphone size={28} color={colors['on-surface-variant']} /></View>
        <Text className="rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-bold uppercase text-primary">Foto + wincha</Text>
      </View>
      <Text testID="ar-no-disponible-titulo" className="text-[22px] font-bold text-on-surface">{copy.title}</Text>
      <Text className="text-[15px] text-on-surface-variant">{copy.body}</Text>
      {PHOTO_STEPS.map((step, index) => (
        <View key={step} className="flex-row items-center gap-3">
          <View className="h-8 w-8 items-center justify-center rounded-full bg-primary/10"><Text className="text-[13px] font-bold text-primary">{index + 1}</Text></View>
          <Text className="flex-1 text-[15px] text-on-surface">{step}</Text>
        </View>
      ))}
    </View>
  );
}
