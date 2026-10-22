import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Check, Download } from 'lucide-react-native';
import { Logo } from '../ui/Logo';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';
import type { EstadoActualizacion } from './useActualizador';
import type { Novedad } from './novedades';
import { updateLockContent } from './updateLock';

/**
 * Under the minimum version the app cannot be used (backlog 32; design
 * `u-01-actualizacion-obligatoria`): this covers everything, also an open
 * chat, and the back button does not close it. Only «Actualizar», with the
 * newest notes, downloaded and installed inside the app; if that fails,
 * LilaStore.
 */
export function UpdateLockScreen(props: {
  visible: boolean;
  installed: string;
  latest: string;
  novedades: Novedad[];
  size: number;
  state: EstadoActualizacion;
  onUpdate: () => void;
  onOpenStore: () => void;
}) {
  const colors = useColores();
  const margins = useMargenes();
  const content = updateLockContent({ installed: props.installed, latest: props.latest, novedades: props.novedades, size: props.size });
  const busy = props.state.fase === 'descargando' || props.state.fase === 'instalando';
  const failed = props.state.fase === 'error';
  const label = props.state.fase === 'descargando' ? `Descargando… ${Math.round(props.state.progreso * 100)}%` : props.state.fase === 'instalando' ? 'Abriendo el instalador…' : failed ? 'Abrir LilaStore' : 'Actualizar';
  return (
    <Modal visible={props.visible} animationType="fade" statusBarTranslucent onRequestClose={() => undefined}>
      <View testID="pantalla-actualizacion-obligatoria" className="flex-1 bg-background" style={{ paddingTop: margins.cabecera + 16, paddingBottom: margins.pie + 16 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, alignItems: 'center' }}>
          <View className="flex-row items-center gap-2">
            <Logo tamano={28} />
            <Text className="text-xl font-bold text-on-surface">Lilachat</Text>
          </View>
          <View className="mt-6 h-20 w-20 items-center justify-center rounded-full border border-primary/15 bg-primary/10">
            <Download size={34} color={colors.primary} />
          </View>
          <Text className="mt-6 text-[11px] font-bold uppercase tracking-widest text-primary">Actualización necesaria</Text>
          <Text className="mt-2 text-center text-2xl font-bold text-on-surface">Actualiza Lilachat para seguir</Text>
          <Text className="mt-2 text-center text-[15px] leading-6 text-on-surface-variant">{content.body}</Text>
          {content.notes.length ? (
            <View testID="novedades-obligatoria" className="mt-6 w-full rounded-xl border border-outline/15 bg-surface p-4">
              <View className="flex-row items-center justify-between border-b border-outline/10 pb-3">
                <Text className="text-[12px] font-bold uppercase tracking-wider text-primary">{content.notesTitle}</Text>
                <View className="rounded-md border border-en-linea/30 bg-en-linea/10 px-2 py-0.5">
                  <Text className="text-[11px] font-bold uppercase text-en-linea">Nuevo</Text>
                </View>
              </View>
              {content.notes.map((note) => (
                <View key={note} className="mt-3 flex-row gap-3">
                  <View className="h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                    <Check size={14} color={colors.primary} strokeWidth={3} />
                  </View>
                  <Text className="min-w-0 flex-1 text-[15px] leading-6 text-on-surface">{note}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
        <View className="px-5 pt-3">
          {props.state.fase === 'error' ? <Text className="mb-2 text-center text-[13px] text-error">{props.state.mensaje}</Text> : null}
          <Pressable testID="btn-actualizar-obligatoria" disabled={busy} onPress={failed ? props.onOpenStore : props.onUpdate} className={`h-14 flex-row items-center justify-center gap-2 rounded-xl ${busy ? 'bg-primary/60' : 'bg-primary'}`}>
            {busy ? <ActivityIndicator color={colors['on-primary']} /> : <Download size={20} color={colors['on-primary']} />}
            <Text className="text-base font-bold text-on-primary">{label}</Text>
          </Pressable>
          <Text className="mt-2 text-center text-[12px] text-on-surface-variant">{content.source}</Text>
        </View>
      </View>
    </Modal>
  );
}
