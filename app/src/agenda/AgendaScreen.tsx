import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Bell, CalendarDays, Plus, X } from 'lucide-react-native';
import type { Credential } from '../auth/credentialStore';
import { EventsScreen } from './EventsScreen';
import { RemindersScreen } from './RemindersScreen';
import { useMargenes } from '../ui/useMargenes';

/**
 * Agenda: eventos y avisos en UNA pestaña (pedido de José).
 *
 * Las dos cosas responden a la misma pregunta —«¿qué tengo por delante?»— y
 * tenerlas separadas obligaba a mirar en dos lugares lo que uno piensa junto.
 *
 * El botón de crear ofrece los DOS tipos en vez de adivinar por la pestaña
 * activa: se crea un recordatorio estando en eventos todo el tiempo, y hacer
 * que el botón dependa del filtro obliga a cambiar de vista antes de crear.
 */
export function AgendaScreen({
  credential,
  onCreate,
}: {
  credential: Credential;
  onCreate: (kind: 'event' | 'reminder') => void;
}) {
  const margenes = useMargenes();
  const [vista, setVista] = useState<'eventos' | 'avisos'>('eventos');
  const [eligiendo, setEligiendo] = useState(false);

  return (
    <View className="flex-1 bg-background" testID="pantalla-agenda">
      <View className="mx-4 mt-3 flex-row rounded-lg bg-primary/[0.07] p-1">
        {(
          [
            { key: 'eventos' as const, label: 'Eventos' },
            { key: 'avisos' as const, label: 'Avisos' },
          ]
        ).map((opcion) => (
          <Pressable
            key={opcion.key}
            testID={`tab-agenda-${opcion.key}`}
            onPress={() => setVista(opcion.key)}
            className={`min-h-[40px] flex-1 items-center justify-center rounded-md ${
              vista === opcion.key ? 'bg-surface' : ''
            }`}
          >
            <Text
              className={`text-[13px] font-semibold ${
                vista === opcion.key ? 'text-on-surface' : 'text-on-surface-variant'
              }`}
            >
              {opcion.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View className="flex-1">
        {vista === 'eventos' ? (
          // Las pantallas siguen siendo dos: cada una tiene su carga, su vacío
          // y su forma de fila. Lo que se unificó es la NAVEGACIÓN, no el
          // contenido — juntarlos en una lista mezclada haría ilegibles los dos.
          <EventsScreen credential={credential} onCreate={() => setEligiendo(true)} hideFab />
        ) : (
          <RemindersScreen credential={credential} onCreate={() => setEligiendo(true)} hideFab />
        )}
      </View>

      <Pressable
        testID="btn-crear-agenda"
        onPress={() => setEligiendo(true)}
        className="absolute bottom-5 right-5 h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg"
      >
        <Plus size={24} color="#ffffff" />
      </Pressable>

      <Modal
        visible={eligiendo}
        transparent
        animationType="fade"
        onRequestClose={() => setEligiendo(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={() => setEligiendo(false)}
          testID="hoja-crear-agenda"
        >
          <View className="rounded-t-2xl bg-surface px-4 pt-3" style={{ paddingBottom: margenes.pie }}>
            <View className="mb-2 flex-row items-center">
              <Text className="flex-1 text-base font-bold text-on-surface">¿Qué quieres crear?</Text>
              <Pressable
                onPress={() => setEligiendo(false)}
                className="h-9 w-9 items-center justify-center"
              >
                <X size={18} color="#7b7486" />
              </Pressable>
            </View>

            {(
              [
                {
                  kind: 'event' as const,
                  label: 'Evento',
                  hint: 'Con invitados y confirmación',
                  Icon: CalendarDays,
                },
                {
                  kind: 'reminder' as const,
                  label: 'Recordatorio',
                  hint: 'Solo para ti, con repetición',
                  Icon: Bell,
                },
              ]
            ).map(({ kind, label, hint, Icon }) => (
              <Pressable
                key={kind}
                testID={`crear-${kind}`}
                onPress={() => {
                  setEligiendo(false);
                  onCreate(kind);
                }}
                className="min-h-[64px] flex-row items-center gap-3 rounded-xl px-2 py-3"
              >
                <View className="h-11 w-11 items-center justify-center rounded-full bg-primary/[0.12]">
                  <Icon size={20} color="#6b38d4" />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-[15px] font-semibold text-on-surface">{label}</Text>
                  <Text className="text-[12px] text-on-surface-variant">{hint}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
