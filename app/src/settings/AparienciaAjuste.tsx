import { Pressable, Text, View } from 'react-native';
import { Moon, Sun, SunMoon } from 'lucide-react-native';
import { Rotulo } from '../ui/Rotulo';
import { useColores, useTema } from '../ui/tema';

const OPCIONES = [
  { key: 'sistema', label: 'Sistema', Icono: SunMoon },
  { key: 'claro', label: 'Claro', Icono: Sun },
  { key: 'oscuro', label: 'Oscuro', Icono: Moon },
] as const;

/**
 * Claro, oscuro o el del sistema (José, 27/08/2026: «lilachat no tiene
 * darkmode o light mode como lilastore»). Salió de `TabsShell`.
 *
 * **Tres opciones y no dos**, igual que LilaStore: sin «sistema», la primera
 * vez que alguien abre la app de noche le explota una pantalla blanca. Control
 * segmentado y no una lista: son excluyentes y se comparan entre sí.
 */
export function AparienciaAjuste() {
  const colores = useColores();
  const { modo, setModo } = useTema();
  return (
    <>
      <Rotulo>Apariencia</Rotulo>
      <View className="flex-row rounded-xl border border-outline/10 bg-surface p-1">
        {OPCIONES.map(({ key, label, Icono }) => {
          const activo = modo === key;
          return (
            <Pressable
              key={key}
              testID={`tema-${key}`}
              accessibilityRole="button"
              accessibilityState={{ selected: activo }}
              onPress={() => setModo(key)}
              className={`min-h-[44px] flex-1 flex-row items-center justify-center gap-1.5 rounded-lg ${activo ? 'bg-primary' : ''}`}
            >
              <Icono size={15} color={activo ? colores['on-primary'] : colores['on-surface-variant']} />
              <Text className={`text-[13px] font-semibold ${activo ? 'text-on-primary' : 'text-on-surface-variant'}`}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}
