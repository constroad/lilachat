import { Pressable, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useColores } from './tema';

export type OpcionSegmentada<K extends string> = {
  key: K;
  etiqueta: string;
  testID: string;
  Icono?: LucideIcon;
  /** Un contador al lado (fotos, docs); con 0 no se muestra. */
  cuenta?: number;
};

/**
 * El control segmentado de toda la app (FL13, auditoría §48). Había tres, cada
 * uno con su activo: sólido en Apariencia, un blanco que en oscuro no se veía
 * en Agenda, y tonal en «Compartido». Queda el tonal: se lee en los dos modos
 * y no compite con el botón principal de la pantalla.
 */
export function Segmentado<K extends string>(props: {
  opciones: readonly OpcionSegmentada<K>[];
  valor: K;
  onCambiar: (key: K) => void;
}) {
  const colores = useColores();
  return (
    <View className="flex-row rounded-2xl border border-outline/10 bg-surface p-1">
      {props.opciones.map(({ key, etiqueta, testID, Icono, cuenta }) => {
        const activo = props.valor === key;
        const tinta = activo ? colores.primary : colores['on-surface-variant'];
        return (
          <Pressable
            key={key}
            testID={testID}
            accessibilityRole="button"
            accessibilityState={{ selected: activo }}
            onPress={() => props.onCambiar(key)}
            className={`min-h-[44px] flex-1 flex-row items-center justify-center gap-1.5 rounded-xl ${activo ? 'bg-primary/[0.14]' : ''}`}
          >
            {Icono ? <Icono size={16} color={tinta} /> : null}
            {/* One line always: four options with the big chat font («Documentos») wrapped in two (21/10). */}
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} className={`shrink text-[14px] ${activo ? 'font-semibold text-primary' : 'font-medium text-on-surface-variant'}`}>
              {etiqueta}
            </Text>
            {cuenta ? <Text className={`text-[12px] ${activo ? 'text-primary' : 'text-on-surface-variant'}`}>{cuenta}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
