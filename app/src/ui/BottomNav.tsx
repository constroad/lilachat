import { Pressable, Text, View } from 'react-native';
import { BarChart3, CalendarDays, MessageCircle, Settings } from 'lucide-react-native';
import { useMargenes } from './useMargenes';
import { useColores } from './tema';
import { Logo } from './Logo';

/**
 * La barra inferior.
 *
 * **Eventos y Avisos son UNA sola pestaña, «Agenda»** (pedido de José): las dos
 * responden a «¿qué tengo por delante?» y separarlas obligaba a mirar en dos
 * lugares lo que se piensa junto. Adentro se filtra con un segmentado y el
 * botón de crear ofrece los dos tipos.
 *
 * La primera versión tenía cuatro —Chats/Estado/Llamadas/Ajustes— copiadas del
 * mock en inglés, que es una generación anterior del diseño: los mocks en
 * español son los que traen las funciones de F5, y su navegación es la real.
 * Dos generaciones del mismo diseño conviven en el proyecto y hay que mirar
 * CUÁL corresponde a lo que se está construyendo.
 */
export type Tab = 'chats' | 'agenda' | 'encuestas' | 'ajustes';

const TABS: { key: Tab; label: string; Icon: typeof MessageCircle }[] = [
  { key: 'chats', label: 'Chats', Icon: MessageCircle },
  { key: 'agenda', label: 'Agenda', Icon: CalendarDays },
  { key: 'encuestas', label: 'Encuestas', Icon: BarChart3 },
  { key: 'ajustes', label: 'Ajustes', Icon: Settings },
];

export function BottomNav({
  active,
  onChange,
  vertical = false,
}: {
  active: Tab;
  onChange: (tab: Tab) => void;
  /** Riel a la izquierda (FL10): girado o en tablet, la altura no alcanza para la barra abajo. */
  vertical?: boolean;
}) {
  const colores = useColores();
  const margenes = useMargenes();
  return (
    <View
      testID={vertical ? 'riel-de-pestanas' : 'barra-de-pestanas'}
      className={vertical ? 'w-20 gap-1 border-r border-outline/10 bg-surface pt-3' : 'flex-row border-t border-outline/10 bg-surface pt-2'}
      style={{ paddingBottom: margenes.pie }}
    >
      {TABS.map(({ key, label, Icon }) => {
        const selected = key === active;
        return (
          <Pressable
            key={key}
            testID={`tab-${key}`}
            onPress={() => onChange(key)}
            className={vertical ? 'min-h-[64px] items-center justify-center gap-0.5' : 'min-h-[44px] flex-1 items-center justify-center gap-0.5'}
          >
            <Icon size={20} color={selected ? colores.primary : colores.outline} />
            <Text
              className={`text-[10px] ${
                selected ? 'font-semibold text-primary' : 'text-on-surface-variant'
              }`}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * La cabecera que comparten las pantallas de pestaña. En Chats, la marca como
 * FL6; en las demás, el nombre de la pestaña (auditoría §48: las cuatro decían
 * «Lilachat» y nada ubicaba dónde estabas). Sin línea abajo: el diseño no la tiene.
 */
export function AppHeader({ tab, children }: { tab: Tab; children?: React.ReactNode }) {
  const margenes = useMargenes();
  return (
    <View className="min-h-[56px] flex-row items-center gap-2 bg-background px-4 pb-2" style={{ paddingTop: margenes.cabecera }}>
      {tab === 'chats' ? (
        <>
          <Logo tamano={32} />
          <Text className="flex-1 text-[22px] font-bold text-primary">Lilachat</Text>
        </>
      ) : (
        <Text testID="titulo-pestana" accessibilityRole="header" className="flex-1 text-[22px] font-bold text-on-surface">
          {TABS.find((pestana) => pestana.key === tab)?.label}
        </Text>
      )}
      {children}
    </View>
  );
}
