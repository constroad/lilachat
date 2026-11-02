import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { removeLayer, replaceOrAppend } from './layers';

/**
 * Where the in-window overlays are drawn (plan 1, F1). A sheet or a full-screen
 * panel used to be React Native's `Modal`: on Android a second window
 * (`Dialog`), 100–200 ms to appear, the system's own animation, and a keyboard
 * event of its own that made the chat behind it jump. Here they are plain views
 * stacked over the screen, in the same window.
 *
 * One host at the root of the session and one per screen that provides
 * context of its own (the chat: its custom emojis): an overlay is drawn by the
 * NEAREST host, so it keeps every provider above that host. Back closes the
 * top layer.
 */
type Layer = { id: number; node: ReactNode; onBack: () => void };
export type OverlayHostHandle = {
  mount: (id: number, node: ReactNode, onBack: () => void) => void;
  unmount: (id: number) => void;
};

const OverlayHostContext = createContext<OverlayHostHandle | null>(null);
export const useOverlayHost = () => useContext(OverlayHostContext);

let lastOverlayId = 0;
export const newOverlayId = () => ++lastOverlayId;

export function OverlayHost(props: { children: ReactNode }) {
  const [layers, setLayers] = useState<Layer[]>([]);
  const handle = useMemo<OverlayHostHandle>(
    () => ({
      mount: (id, node, onBack) => setLayers((current) => replaceOrAppend(current, { id, node, onBack })),
      // A closed sheet says «remove me» on every render: the same array back skips the redraw.
      unmount: (id) => setLayers((current) => removeLayer(current, id)),
    }),
    []
  );

  const top = layers.length > 0 ? layers[layers.length - 1] : null;
  useEffect(() => {
    if (!top) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      top.onBack();
      return true;
    });
    return () => subscription.remove();
  }, [top]);

  // Each node is the layer itself (`OverlayModal`'s animated view): removed as a
  // direct child, its exit animation runs.
  return (
    <OverlayHostContext.Provider value={handle}>
      <View style={styles.host}>
        {props.children}
        {layers.map((layer) => layer.node)}
      </View>
    </OverlayHostContext.Provider>
  );
}

const styles = StyleSheet.create({ host: { flex: 1 } });
