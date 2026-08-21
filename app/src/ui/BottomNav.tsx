import { Pressable, Text, View } from 'react-native';
import { BarChart3, Bell, CalendarDays, MessageCircle, Settings } from 'lucide-react-native';

/**
 * La barra inferior, con las CINCO pestañas del diseño en español
 * (Chats · Encuestas · Eventos · Avisos · Ajustes).
 *
 * La primera versión tenía cuatro —Chats/Estado/Llamadas/Ajustes— copiadas del
 * mock en inglés, que es una generación anterior del diseño: los mocks en
 * español son los que traen las funciones de F5, y su navegación es la real.
 * Dos generaciones del mismo diseño conviven en el proyecto y hay que mirar
 * CUÁL corresponde a lo que se está construyendo.
 */
export type Tab = 'chats' | 'encuestas' | 'eventos' | 'avisos' | 'ajustes';

const TABS: { key: Tab; label: string; Icon: typeof MessageCircle }[] = [
  { key: 'chats', label: 'Chats', Icon: MessageCircle },
  { key: 'encuestas', label: 'Encuestas', Icon: BarChart3 },
  { key: 'eventos', label: 'Eventos', Icon: CalendarDays },
  { key: 'avisos', label: 'Avisos', Icon: Bell },
  { key: 'ajustes', label: 'Ajustes', Icon: Settings },
];

export function BottomNav({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  return (
    <View className="flex-row border-t border-outline/10 bg-surface pb-6 pt-2">
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
  return (
    <View className="flex-row items-center gap-2 border-b border-outline/10 bg-surface px-4 pb-3 pt-14">
      <View className="h-8 w-8 items-center justify-center rounded-lg bg-primary">
        <MessageCircle size={17} color="#ffffff" />
      </View>
      <Text className="flex-1 text-xl font-bold text-primary">Lilachat</Text>
      {children}
    </View>
  );
}
