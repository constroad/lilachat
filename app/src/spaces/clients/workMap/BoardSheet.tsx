import type { ReactNode } from 'react';
import { Pressable, ScrollView, View, type ViewStyle } from 'react-native';
import { X } from 'lucide-react-native';
import { expandLayerSheet, type MapSheet } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';

/** The detail's sheet leaves the top of the map, with its chips, in sight. */
const PANEL_MAX_HEIGHT = '75%';
const PANEL_CONTENT = { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 24 };
/** Tablet or phone turned (design ma01 tablet): the sheet is a column beside the map. */
const SIDE_PANEL_WIDTH = 400;
/** Under the peek the hidden panel keeps no head of its own: the peek is the layer's head. */
const HEAD_UNDER_PEEK = <View />;

/** The panel as a sheet over the map (José 20/11, design mapa-v2): hidden, never unmounted, so what waits approval is still drawn. */
function PanelOverlay(props: { open: boolean; side: boolean; onClose: () => void; children: ReactNode }) {
  const colors = useColores();
  const place: ViewStyle = props.side ? { width: SIDE_PANEL_WIDTH } : { left: 0, right: 0, bottom: 0, maxHeight: PANEL_MAX_HEIGHT };
  return (
    <View testID="mapa-panel" accessibilityElementsHidden={!props.open} className={`overflow-hidden bg-surface ${props.side ? 'border-l border-outline/15' : 'absolute rounded-t-3xl'}`} style={{ ...place, display: props.open ? 'flex' : 'none', elevation: 12 }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={PANEL_CONTENT}>{props.children}</ScrollView>
      <Pressable testID="mapa-hoja-cerrar" accessibilityLabel="Cerrar el panel" onPress={props.onClose} className="absolute right-2 top-1 h-11 w-11 items-center justify-center rounded-full">
        <X size={20} color={colors['on-surface-variant']} />
      </Pressable>
    </View>
  );
}

type BoardSheetProps = {
  sheet: MapSheet;
  /** Tablet or phone turned: a column beside the map, always open. */
  side: boolean;
  onSheet: (next: MapSheet) => void;
  /** The layer's sheet, peek (false) or whole (true); null without layers. */
  layerSheet: ((expanded: boolean) => ReactNode) | null;
  /** «Capas y leyenda», only from its floating button. */
  layers: ReactNode;
  /** The rest of the panel under the given head: always mounted, so what waits is still drawn. */
  panel: (head: ReactNode | undefined) => ReactNode;
};

/**
 * What the sheet over the map holds (design ma01, José 28/11): the layer's peek (figure, bar and
 * «Registrar avance de <capa>»), its whole detail, or «Capas y leyenda». Without layers, «Capas»
 * shows the panel too, so the streets and what waits stay reachable.
 */
export function BoardSheet(props: BoardSheetProps) {
  const { sheet, side } = props;
  const hasLayer = props.layerSheet !== null;
  const showsLayers = sheet === 'layers';
  const detail = side || sheet === 'full' || (!hasLayer && showsLayers);
  const peek = !side && sheet === 'peek' && hasLayer;
  return (
    <PanelOverlay open={side || sheet !== null} side={side} onClose={() => props.onSheet(null)}>
      {peek ? <Pressable testID="mapa-hoja-asa" accessibilityLabel="Ver el detalle de la capa" onPress={() => props.onSheet(expandLayerSheet(sheet))} className="-mt-3 mb-2 h-6 items-center justify-center"><View className="h-1 w-10 rounded-full bg-outline/30" /></Pressable> : null}
      {showsLayers ? props.layers : null}
      {peek ? props.layerSheet?.(false) : null}
      <View style={{ display: detail ? 'flex' : 'none' }}>{props.panel(detail ? (hasLayer ? props.layerSheet?.(true) : undefined) : HEAD_UNDER_PEEK)}</View>
    </PanelOverlay>
  );
}
