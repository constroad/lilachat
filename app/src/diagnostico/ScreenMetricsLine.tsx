import { useContext } from 'react';
import { Dimensions, Text, useWindowDimensions } from 'react-native';
import { initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootInsetsContext, rootLayerSize } from '../ui/overlay/OverlayHost';

const round = (value: number | undefined) => Math.round(value ?? -1);

/**
 * What the app believes about the screen (José 13/11: the clip sheet sat under a Samsung's three
 * buttons and the cause could not be read from the code). Sizes in dp.
 */
export function ScreenMetricsLine() {
  const window = useWindowDimensions();
  const screen = Dimensions.get('screen');
  const here = useSafeAreaInsets();
  const root = useContext(RootInsetsContext);
  const initial = initialWindowMetrics;
  return (
    <Text className="text-[12px] text-on-surface-variant" testID="diag-pantalla">
      Pantalla: ventana {round(window.width)}×{round(window.height)} · pantalla {round(screen.width)}×{round(screen.height)} · capa {round(rootLayerSize.width)}×{round(rootLayerSize.height)} · márgenes aquí {round(here.top)}/{round(here.bottom)} · raíz {round(root?.top)}/{round(root?.bottom)} · inicio {round(initial?.insets.top)}/{round(initial?.insets.bottom)} marco {round(initial?.frame.height)}
    </Text>
  );
}
