import { useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Pencil, Trash2 } from 'lucide-react-native';
import { deleteLayer, layerDeleteQuestion, renameLayer, type MapEditSend, type MapLayerKind } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';

type Mode = 'idle' | 'rename' | 'ask';
type Props = { kind: MapLayerKind; id: string; name: string; layers: Array<{ id: string; name: string }>; send: MapEditSend };
const ICON = 'h-11 w-11 items-center justify-center rounded-xl';
const BUTTON = 'h-11 flex-1 items-center justify-center rounded-xl';

/**
 * «Renombrar» and «Borrar» on a stage or a work, on the phone (Portal c1c35c58). The icons go in
 * the card's header; the field or the question goes at the bottom of the card.
 */
export function useLayerActions(props: Props): { icons: ReactNode; panel: ReactNode } {
  const colors = useColores();
  const [mode, setMode] = useState<Mode>('idle');
  const [draft, setDraft] = useState(props.name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const testId = `${props.kind === 'stages' ? 'etapa' : 'trabajo'}-${props.id}`;
  const run = async (action: () => Promise<string | null>) => {
    setBusy(true);
    const failure = await action();
    setBusy(false);
    setError(failure);
    if (!failure) setMode('idle');
  };
  const open = (next: Mode) => { setError(null); setDraft(props.name); setMode(next); };
  const icons = mode === 'idle' ? (
    <View className="flex-row">
      <Pressable testID={`renombrar-${testId}`} accessibilityLabel={`Renombrar ${props.name}`} onPress={() => open('rename')} className={ICON}><Pencil size={18} color={colors['on-surface-variant']} /></Pressable>
      <Pressable testID={`borrar-${testId}`} accessibilityLabel={`Borrar ${props.name}`} onPress={() => open('ask')} className={ICON}><Trash2 size={18} color={colors['on-surface-variant']} /></Pressable>
    </View>
  ) : null;
  const cancel = <Pressable disabled={busy} onPress={() => setMode('idle')} className={`${BUTTON} border border-outline/20`}><Text className="text-[14px] font-semibold text-on-surface">Cancelar</Text></Pressable>;
  const panel = (
    <>
      {mode === 'rename' ? (
        <View className="mt-3 gap-2">
          <TextInput testID={`nombre-${testId}`} value={draft} maxLength={60} autoFocus onChangeText={setDraft} className="h-12 rounded-xl border border-outline/25 bg-background px-3 text-[15px] text-on-surface" />
          <View className="flex-row gap-2">
            {cancel}
            <Pressable testID={`guardar-${testId}`} disabled={busy} onPress={() => void run(() => renameLayer(props.send, props.kind, props.id, draft, props.layers))} className={`${BUTTON} bg-primary ${busy ? 'opacity-60' : ''}`}><Text className="text-[14px] font-semibold text-on-primary">{busy ? 'Guardando…' : 'Guardar'}</Text></Pressable>
          </View>
        </View>
      ) : null}
      {mode === 'ask' ? (
        <View className="mt-3 rounded-xl border border-error/30 bg-error/5 p-3">
          <Text className="text-[14px] font-semibold text-on-surface">{layerDeleteQuestion(props.kind, props.name)}</Text>
          <View className="mt-2 flex-row gap-2">
            {cancel}
            <Pressable testID={`borrar-si-${testId}`} disabled={busy} onPress={() => void run(() => deleteLayer(props.send, props.kind, props.id))} className={`${BUTTON} bg-error ${busy ? 'opacity-60' : ''}`}><Text className="text-[14px] font-bold text-background">{busy ? 'Borrando…' : 'Borrar'}</Text></Pressable>
          </View>
        </View>
      ) : null}
      {error ? <Text testID={`error-${testId}`} className="mt-2 text-[13px] font-semibold text-error">{error}</Text> : null}
    </>
  );
  return { icons, panel };
}
