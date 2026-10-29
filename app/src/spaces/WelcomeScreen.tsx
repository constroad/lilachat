import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Building2, ChevronRight, Info, Link2, User } from 'lucide-react-native';
import { membersLabel, type WorkspacePreview } from '@lilachat/shared';
import { Modal } from '../ui/Modal';
import { Logo } from '../ui/Logo';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';
import { SpaceLogo } from './SpaceSwitcherSheet';
import { previewSpace } from './spacesApi';

type Props = {
  jwt: string;
  /** A join link opened the app: its space shows under «Unirme a mi empresa», marked «Detectado». */
  detectedCode: string | null;
  onPersonal: () => void;
  onJoin: () => void;
  onCreate: () => void;
};

/**
 * «¿Cómo vas a usar Lilachat?» (design `e-01-bienvenida`, pending 5): the
 * first screen of a new account. Personal chats, joining a company with a
 * code or link, or creating a space; either way both stay one tap apart.
 */
export function WelcomeScreen(props: Props) {
  const margins = useMargenes();
  const [detected, setDetected] = useState<WorkspacePreview | null>(null);
  useEffect(() => {
    setDetected(null);
    if (!props.detectedCode) return;
    let alive = true;
    void previewSpace(props.jwt, props.detectedCode).then((response) => alive && response.ok && setDetected(response.data));
    return () => {
      alive = false;
    };
  }, [props.jwt, props.detectedCode]);
  return (
    <Modal visible animationType="fade" onRequestClose={props.onPersonal}>
      <View testID="pantalla-bienvenida" className="flex-1 bg-background px-5" style={{ paddingTop: margins.cabecera + 8, paddingBottom: margins.pie + 12 }}>
        <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: 16 }}>
          <View className="flex-row items-center gap-2"><Logo tamano={32} /><Text className="text-[22px] font-bold text-on-surface">Lilachat</Text></View>
          <Text className="mt-5 text-center text-[26px] font-bold leading-[32px] text-on-surface">¿Cómo vas a usar Lilachat?</Text>
          <Text className="mt-2 text-center text-[15px] leading-[22px] text-on-surface-variant">Elige por dónde quieres empezar. Podrás alternar entre tus chats personales y los canales de tu trabajo con un solo toque.</Text>
          <View className="mt-6 w-full gap-3">
            <Choice testID="bienvenida-personal" title="Para mí" text="Chats con tus contactos, familia y amigos, con la misma fluidez y privacidad de siempre." Icon={User} onPress={props.onPersonal} />
            <Choice testID="bienvenida-unirme" title="Unirme a mi empresa" text="Con un código o enlace que te mandaron por WhatsApp o correo corporativo." Icon={Link2} highlighted={Boolean(props.detectedCode)} onPress={props.onJoin}>
              {props.detectedCode ? <DetectedSpace code={props.detectedCode} space={detected} /> : null}
            </Choice>
            <Choice testID="bienvenida-crear" title="Crear un espacio para mi empresa" text="Organiza canales por área, roles y tareas. Invita a tu equipo y contratistas en segundos." Icon={Building2} onPress={props.onCreate} />
          </View>
          <InfoNote />
        </ScrollView>
      </View>
    </Modal>
  );
}

function Choice(props: { testID: string; title: string; text: string; Icon: typeof User; highlighted?: boolean; onPress: () => void; children?: ReactNode }) {
  const colors = useColores();
  return (
    <Pressable testID={props.testID} accessibilityRole="button" onPress={props.onPress} className={`rounded-2xl bg-surface p-4 ${props.highlighted ? 'border-2 border-primary' : 'border border-outline/15'}`}>
      {props.highlighted ? <Text className="absolute -top-3 right-4 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-on-primary">Detectado</Text> : null}
      <View className="flex-row items-center gap-4">
        <View className={`h-14 w-14 items-center justify-center rounded-2xl ${props.highlighted ? 'bg-primary' : 'bg-primary/10'}`}>
          <props.Icon size={24} color={props.highlighted ? colors['on-primary'] : colors.primary} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[17px] font-bold text-on-surface">{props.title}</Text>
          <Text className="mt-1 text-[14px] leading-[20px] text-on-surface-variant">{props.text}</Text>
        </View>
        <ChevronRight size={20} color={props.highlighted ? colors.primary : colors.outline} />
      </View>
      {props.children}
    </Pressable>
  );
}

/** The space of the link that opened the app, with its code. */
function DetectedSpace(props: { code: string; space: WorkspacePreview | null }) {
  return (
    <View testID="bienvenida-espacio-detectado" className="mt-4 flex-row items-center gap-2 border-t border-outline/15 pt-3">
      {props.space ? <SpaceLogo space={{ name: props.space.name, logoUrl: props.space.logoUrl }} size={28} /> : null}
      <Text numberOfLines={1} className="min-w-0 flex-shrink text-[14px] font-semibold text-on-surface">{props.space?.name ?? 'Espacio de tu empresa'}</Text>
      {props.space ? <Text className="text-[13px] text-on-surface-variant">{`· ${membersLabel(props.space.members)}`}</Text> : null}
      <View className="flex-1" />
      <Text className="rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1 font-mono text-[13px] text-primary">{props.code}</Text>
    </View>
  );
}

function InfoNote() {
  const colors = useColores();
  return (
    <View className="mt-6 w-full flex-row items-start gap-3 rounded-2xl border border-outline/15 bg-surface p-4">
      <Info size={20} color={colors.primary} />
      <Text className="flex-1 text-[14px] leading-[20px] text-on-surface-variant">
        <Text className="font-bold text-on-surface">Puedes hacer las dos cosas: </Text>lo personal y la empresa quedan separados en pestañas independientes.
      </Text>
    </View>
  );
}
