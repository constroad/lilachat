import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ArrowLeft, RotateCcw } from 'lucide-react-native';
import { DELETED_LOADING, loadDeletedRows, NOTHING_DELETED, restoreDeleted, type DeletedList, type DeletedRow, type MapEditSend, type WorkMap } from '@lilachat/shared';
import { Modal } from '../../../ui/Modal';
import { useColores } from '../../../ui/tema';
import { useMargenes } from '../../../ui/useMargenes';

function Row(props: { row: DeletedRow; send: MapEditSend; onRestored: () => void }) {
  const colors = useColores();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const restore = async () => {
    setBusy(true);
    const failure = await restoreDeleted(props.send, props.row);
    setBusy(false);
    if (failure) return setError(failure);
    props.onRestored();
  };
  return (
    <View testID={`borrado-${props.row.id}`} className="rounded-xl border-[1.5px] border-outline/15 bg-surface p-4">
      <Text className="text-[15px] font-bold text-on-surface">{props.row.title}</Text>
      <Text className="mt-0.5 text-[13px] text-on-surface-variant">{props.row.detail}</Text>
      {error ? <Text className="mt-2 text-[13px] font-semibold text-error">{error}</Text> : null}
      <Pressable testID={`restaurar-${props.row.id}`} disabled={busy} onPress={() => void restore()} className={`mt-3 h-11 flex-row items-center justify-center gap-2 rounded-xl border border-primary/30 ${busy ? 'opacity-60' : ''}`}>
        <RotateCcw size={16} color={colors.primary} /><Text className="text-[14px] font-semibold text-primary">{busy ? 'Restaurando…' : 'Restaurar'}</Text>
      </Pressable>
    </View>
  );
}

/** «Borrados» for admins on the phone (José 07/11): what was deleted from the map, each with «Restaurar». */
export function DeletedWork(props: { open: boolean; map: WorkMap; send: MapEditSend; onClose: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const [list, setList] = useState<DeletedList>(DELETED_LOADING);
  const names = useMemo(() => new Map(props.map.streets.map((street) => [street.id, street.name])), [props.map]);
  const reload = () => { setList(DELETED_LOADING); void loadDeletedRows(props.send, names).then(setList); };
  /** Asked each time the sheet opens (the sender is new on every render); «Restaurar» asks again. */
  const askedOpen = useRef(false);
  useEffect(() => {
    if (!props.open) { askedOpen.current = false; return; }
    if (askedOpen.current) return;
    askedOpen.current = true;
    setList(DELETED_LOADING);
    void loadDeletedRows(props.send, names).then(setList);
  }, [props.open, props.send, names]);
  return (
    <Modal visible={props.open} animationType="slide" onRequestClose={props.onClose}>
      <View className="flex-1 bg-background" testID="mapa-borrados">
        <View className="flex-row items-center gap-2 border-b border-outline/15 bg-surface px-4 pb-3" style={{ paddingTop: margins.cabecera + 8 }}>
          <Pressable testID="mapa-borrados-cerrar" accessibilityLabel="Volver al mapa" onPress={props.onClose} className="h-11 w-11 items-center justify-center rounded-xl"><ArrowLeft size={22} color={colors['on-surface']} /></Pressable>
          <View className="flex-1"><Text className="text-[20px] font-bold text-on-surface">Borrados</Text><Text className="text-[12px] text-on-surface-variant">Una calle vuelve con los tramos que se borraron con ella.</Text></View>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: margins.pie + 24, gap: 12 }}>
          {list.state === 'loading' ? <View className="h-24 rounded-xl bg-surface-variant" /> : null}
          {list.state === 'failed' ? <Text className="text-[14px] font-semibold text-error">{list.message}</Text> : null}
          {list.state === 'ready' && !list.rows.length ? <Text className="text-[14px] text-on-surface-variant">{NOTHING_DELETED}</Text> : null}
          {list.state === 'ready' ? list.rows.map((row) => <Row key={row.id} row={row} send={props.send} onRestored={reload} />) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
