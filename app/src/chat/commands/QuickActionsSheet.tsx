import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { X } from 'lucide-react-native';
import type { ShortcutRow } from '@lilachat/shared';
import { Modal } from '../../ui/Modal';
import { useColores } from '../../ui/tema';
import { useMargenes } from '../../ui/useMargenes';
import { AppActionRows } from './AppActionRows';

const SHEET_PADDING = 16;
const SHEET_MAX_WIDTH = 560;
const MAX_SCREEN_SHARE = 0.85;
const SKELETON_ROWS = [0, 1, 2];

export type QuickActionsSheetProps = {
  visible: boolean;
  title: string;
  hint: string;
  rows: readonly ShortcutRow[];
  /** Still asking: skeleton rows. */
  loading: boolean;
  failed: boolean;
  emptyText: string;
  testID: string;
  testPrefix: string;
  footer?: string;
  onRetry: () => void;
  onPick: (row: ShortcutRow) => void;
  onClose: () => void;
  /** What sits above the rows (the space's ⚡ shows its answers there). */
  children?: ReactNode;
};

/** The sheet of a ⚡: the space's (design e-30) and a chat's (R31/10) draw the same. */
export function QuickActionsSheet(props: QuickActionsSheetProps) {
  const colors = useColores();
  const margins = useMargenes();
  const { width, height } = useWindowDimensions();
  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={props.onClose} accessibilityLabel="Cerrar" />
      <View testID={props.testID} className="self-center rounded-t-3xl bg-surface pt-3" style={{ width: Math.min(width, SHEET_MAX_WIDTH), maxHeight: height * MAX_SCREEN_SHARE, paddingBottom: margins.pie + 8 }}>
        <View className="mb-2 h-1.5 w-11 self-center rounded-full bg-outline/30" />
        <View className="flex-row items-center gap-2 px-4">
          <Text className="flex-1 text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">{props.title}</Text>
          <Pressable accessibilityLabel="Cerrar" onPress={props.onClose} hitSlop={8} className="h-10 w-10 items-center justify-center rounded-full bg-surface-variant"><X size={18} color={colors['on-surface-variant']} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: SHEET_PADDING, gap: 12 }} keyboardShouldPersistTaps="handled">
          <Text className="text-[13px] text-on-surface-variant">{props.hint}</Text>
          {props.children}
          {props.loading ? SKELETON_ROWS.map((index) => <View key={index} className="h-16 rounded-2xl bg-surface-variant" />) : null}
          {props.failed ? <Pressable onPress={props.onRetry} className="rounded-xl bg-error/10 px-4 py-3"><Text className="text-[13px] text-error">No se pudieron leer las acciones. Toca para reintentar.</Text></Pressable> : null}
          {!props.loading && !props.failed && props.rows.length === 0 ? <Text testID="acciones-vacias" className="rounded-2xl border border-outline/15 p-4 text-[14px] text-on-surface-variant">{props.emptyText}</Text> : null}
          {props.rows.length ? <AppActionRows rows={props.rows} testPrefix={props.testPrefix} onPick={props.onPick} /> : null}
          {props.footer ? <Text className="text-center text-[12px] text-on-surface-variant">{props.footer}</Text> : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
