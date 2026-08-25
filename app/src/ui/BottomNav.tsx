import { Pressable, Text, View } from 'react-native';
import { BarChart3, CalendarDays, MessageCircle, Settings } from 'lucide-react-native';
import { useMargenes } from './useMargenes';

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

export function BottomNav({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  const margenes = useMargenes();
  return (
    <View className="flex-row border-t border-outline/10 bg-surface pt-2" style={{ paddingBottom: margenes.pie }}>
      {TABS.map(({ key, label, Icon }) => {
        const selected = key === active;
        return (
          <Pressable
            key={key}
            testID={`tab-${key}`}
            onPress={() => onChange(key)}
            className="min-h-[44px] flex-1 items-center justify-center gap-0.5"
          >
            <Icon size={20} color={selected ? '#6b38d4' : '#7b7486'} />
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

/** La cabecera que comparten las pantallas de pestaña (marca + acciones). */
export function AppHeader({ children }: { children?: React.ReactNode }) {
  const margenes = useMargenes();
  return (
    <View className="flex-row items-center gap-2 border-b border-outline/10 bg-surface px-4 pb-3" style={{ paddingTop: margenes.cabecera }}>
      <View className="h-8 w-8 items-center justify-center rounded-lg bg-primary">
        <MessageCircle size={17} color="#ffffff" />
      </View>
      <Text className="flex-1 text-xl font-bold text-primary">Lilachat</Text>
      {children}
    </View>
  );
}
