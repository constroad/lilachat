import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Bell, CalendarDays, Plus, X } from 'lucide-react-native';
import type { Credential } from '../auth/credentialStore';
import type { AgendaEvent, AgendaReminder } from './agendaApi';
import { CreateEventScreen } from './CreateEventScreen';
import { CreateReminderScreen } from './CreateReminderScreen';
import { EventsScreen } from './EventsScreen';
import { RemindersScreen } from './RemindersScreen';
import { useAlVolver } from '../ui/useAlVolver';
import { useMargenes } from '../ui/useMargenes';
import { useColores } from '../ui/tema';

/**
 * Agenda: eventos y avisos en UNA pestaña (pedido de José).
 *
 * Las dos cosas responden a la misma pregunta —«¿qué tengo por delante?»— y
 * tenerlas separadas obligaba a mirar en dos lugares lo que uno piensa junto.
 *
 * El botón de crear ofrece los DOS tipos en vez de adivinar por la vista
 * activa: se crea un recordatorio estando en eventos todo el tiempo.
 *
 * Desde el 17/10/2026 (José: «los sub tabs eventos y avisos tienen el mismo
 * problema»):
 * - **Las dos vistas quedan montadas** y la inactiva se esconde: cambiar de
 *   vista ya no remonta la lista ni muestra el esqueleto.
 * - **Crear y editar viven acá**, no en TabsShell: al guardar se sube
 *   `recarga` y la lista vuelve a pedir conservando lo que muestra. Antes
 *   TabsShell remontaba toda la pestaña con un `key` y volvía el esqueleto.
 */
type Formulario =
  | { tipo: 'event'; editando?: AgendaEvent }
  | { tipo: 'reminder'; editando?: AgendaReminder }
  | null;

export function AgendaScreen({
  credential,
  activa,
  grupos,
}: {
  credential: Credential;
  activa: boolean;
  /** Mis grupos, para que un evento con la misma gente vaya al que ya existe (FL10). */
  grupos?: readonly { id: string; memberIds: readonly string[] }[];
}) {
  const colores = useColores();
  const margenes = useMargenes();
  const [vista, setVista] = useState<'eventos' | 'avisos'>('eventos');
  const [eligiendo, setEligiendo] = useState(false);
  const [formulario, setFormulario] = useState<Formulario>(null);
  const [recarga, setRecarga] = useState(0);

  const oculta = (cual: typeof vista) => ({ flex: 1, display: cual === vista ? ('flex' as const) : ('none' as const) });
  const alGuardar = () => setRecarga((n) => n + 1);
  // Lo creado desde un chat o por otra persona aparece al volver a la pestaña.
  useAlVolver(activa, alGuardar);

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
            className={`min-h-[44px] flex-1 items-center justify-center rounded-md ${vista === opcion.key ? 'bg-surface' : ''}`}
          >
            <Text className={`text-[13px] font-semibold ${vista === opcion.key ? 'text-on-surface' : 'text-on-surface-variant'}`}>
              {opcion.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Las pantallas siguen siendo dos: cada una tiene su carga, su vacío y
          su forma de fila. Lo que se unificó es la NAVEGACIÓN. */}
      <View style={oculta('eventos')}>
        <EventsScreen credential={credential} recarga={recarga} onEditar={(editando) => setFormulario({ tipo: 'event', editando })} />
      </View>
      <View style={oculta('avisos')}>
        <RemindersScreen credential={credential} recarga={recarga} onEditar={(editando) => setFormulario({ tipo: 'reminder', editando })} />
      </View>

      <Pressable
        testID="btn-crear-agenda"
        accessibilityLabel="Crear evento o recordatorio"
        onPress={() => setEligiendo(true)}
        className="absolute bottom-5 right-5 h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg"
      >
        <Plus size={24} color={colores['on-primary']} />
      </Pressable>

      <Modal visible={eligiendo} transparent animationType="fade" onRequestClose={() => setEligiendo(false)}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setEligiendo(false)} testID="hoja-crear-agenda">
          <View className="rounded-t-2xl bg-surface px-4 pt-3" style={{ paddingBottom: margenes.pie }}>
            <View className="mb-2 flex-row items-center">
              <Text className="flex-1 text-base font-bold text-on-surface">¿Qué quieres crear?</Text>
              <Pressable onPress={() => setEligiendo(false)} accessibilityLabel="Cerrar" className="h-11 w-11 items-center justify-center">
                <X size={18} color={colores.outline} />
              </Pressable>
            </View>

            {(
              [
                { tipo: 'event' as const, label: 'Evento', hint: 'Con invitados y confirmación', Icon: CalendarDays },
                { tipo: 'reminder' as const, label: 'Recordatorio', hint: 'Solo para ti, con repetición', Icon: Bell },
              ]
            ).map(({ tipo, label, hint, Icon }) => (
              <Pressable
                key={tipo}
                testID={`crear-${tipo}`}
                onPress={() => {
                  setEligiendo(false);
                  setFormulario({ tipo });
                  // Lo nuevo se ve donde corresponde: crear un aviso estando en
                  // eventos lleva a la vista de avisos.
                  setVista(tipo === 'event' ? 'eventos' : 'avisos');
                }}
                className="min-h-[64px] flex-row items-center gap-3 rounded-xl px-2 py-3"
              >
                <View className="h-11 w-11 items-center justify-center rounded-full bg-primary/[0.12]">
                  <Icon size={20} color={colores.primary} />
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

      {formulario?.tipo === 'event' ? (
        <CreateEventScreen
          visible
          credential={credential}
          editando={formulario.editando}
          grupos={grupos}
          onClose={() => setFormulario(null)}
          onCreated={alGuardar}
        />
      ) : formulario?.tipo === 'reminder' ? (
        <CreateReminderScreen
          visible
          credential={credential}
          editando={formulario.editando}
          onClose={() => setFormulario(null)}
          onCreated={alGuardar}
        />
      ) : null}
    </View>
  );
}
