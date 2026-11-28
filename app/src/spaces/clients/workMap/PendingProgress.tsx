import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Undo2 } from 'lucide-react-native';
import { byApproveActions, UNDO_LABEL, undoQuestion, type ByApproveList, type MapEditSend } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';

/** «Deshacer» on a record (José 28/11: no approval, but a mistake can be taken back): asks once, then Portal does it or says why not. */
export function UndoProgress(props: { id: string; toM: number; onUndo: (id: string) => Promise<string | null> }) {
  const colors = useColores();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const undo = () => {
    setBusy(true);
    void props.onUndo(props.id).then((failure) => { setBusy(false); setError(failure); if (!failure) setAsking(false); });
  };
  if (!asking) {
    return (
      <Pressable testID={`deshacer-avance-${props.id}`} onPress={() => { setError(null); setAsking(true); }} className="mt-2 min-h-[44px] flex-row items-center justify-center gap-1.5 self-start rounded-xl border border-outline/25 px-4">
        <Undo2 size={16} color={colors['on-surface']} />
        <Text className="text-[14px] font-semibold text-on-surface">{UNDO_LABEL}</Text>
      </Pressable>
    );
  }
  return (
    <View className="mt-2 rounded-xl border border-error/30 bg-surface-variant p-3">
      <Text className="text-[14px] font-semibold text-on-surface">{undoQuestion(props.toM)}</Text>
      {error ? <Text accessibilityRole="alert" className="mt-1 text-[13px] font-semibold text-error">{error}</Text> : null}
      <View className="mt-2 flex-row gap-2">
        <Pressable testID={`deshacer-si-${props.id}`} disabled={busy} onPress={undo} className="min-h-[48px] flex-1 items-center justify-center rounded-xl bg-error"><Text className="text-[14px] font-semibold text-background">{busy ? 'Deshaciendo…' : 'Sí, deshacer'}</Text></Pressable>
        <Pressable disabled={busy} onPress={() => setAsking(false)} className="min-h-[48px] flex-1 items-center justify-center rounded-xl border border-outline/25"><Text className="text-[14px] font-semibold text-on-surface">No</Text></Pressable>
      </View>
    </View>
  );
}

/** What Portal still keeps pending, next to the map (José 28/11: it counts as done): loaded with it, again after each change. */
export function useByApprove(send: MapEditSend | undefined, reloadKey: unknown) {
  const [list, setList] = useState<ByApproveList | null>(null);
  const sender = useRef(send);
  sender.current = send;
  const actions = useMemo(() => byApproveActions(sender, setList), []);
  useEffect(actions.load, [reloadKey, actions]);
  return { list, undo: actions.undo, reload: actions.load };
}
