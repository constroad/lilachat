import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { CalendarDays, MapPin, Plus } from 'lucide-react-native';
import { formatEventWhen, type Rsvp } from '@lilachat/shared';
import type { Credential } from '../auth/credentialStore';
import { agendaGet, agendaPost, type AgendaEvent } from './agendaApi';
import { useColores } from '../ui/tema';

/**
 * Los eventos que vienen (diseño «New Event», pestaña Eventos).
 *
 * La tarjeta muestra el RSVP con los tres botones a la vista, no detrás de un
 * menú: responder «voy / no voy / tal vez» es la única acción de esta pantalla
 * y esconderla detrás de un toque extra es lo que hace que nadie responda.
 */
const RSVP_OPTIONS: { value: Rsvp; label: string }[] = [
  { value: 'yes', label: 'Voy' },
  { value: 'maybe', label: 'Tal vez' },
  { value: 'no', label: 'No voy' },
];

export function EventsScreen({
  credential,
  onCreate,
  hideFab,
}: {
  credential: Credential;
  onCreate: () => void;
  /** La Agenda pone su propio botón: dos flotantes encimados es un bug visible. */
  hideFab?: boolean;
}) {
  const colores = useColores();
  const [events, setEvents] = useState<AgendaEvent[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const result = await agendaGet<{ events: AgendaEvent[] }>('/events', credential.jwt);
    setEvents(result.ok ? result.data.events : []);
  }, [credential.jwt]);

  useEffect(() => {
    void load();
  }, [load]);

  const answer = async (eventId: string, rsvp: Rsvp) => {
    // Optimista: responder tiene que sentirse instantáneo. Si el server
    // rechaza, el refresco de abajo deja el valor real.
    setEvents((current) =>
      (current ?? []).map((event) => (event.id === eventId ? { ...event, myRsvp: rsvp } : event))
    );
    await agendaPost(`/events/${eventId}/rsvp`, credential.jwt, { rsvp });
    void load();
  };

  return (
    <View className="flex-1 bg-background" testID="pantalla-eventos">
      {events === null ? (
        <View className="px-5 pt-4" testID="eventos-cargando">
          {[0, 1].map((index) => (
            <View key={index} className="mb-3 h-28 rounded-xl bg-surface-variant" />
          ))}
        </View>
      ) : events.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8" testID="eventos-vacio">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <CalendarDays size={28} color={colores.primary} />
          </View>
          <Text className="mt-4 text-lg font-semibold text-on-surface">Sin eventos</Text>
          <Text className="mt-1 text-center text-sm leading-5 text-on-surface-variant">
            Crea uno para juntarte con tu gente.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load().finally(() => setRefreshing(false));
              }}
            />
          }
        >
          {events.map((event) => (
            <View
              key={event.id}
              testID={`evento-${event.id}`}
              className="mb-3 rounded-xl border border-outline/10 bg-surface p-4"
            >
              <Text className="text-base font-bold text-on-surface">{event.title}</Text>
              <View className="mt-1.5 flex-row items-center gap-1.5">
                <CalendarDays size={14} color={colores.outline} />
                <Text className="text-sm text-on-surface-variant">
                  {formatEventWhen(new Date(event.startsAt))}
                </Text>
              </View>
              {event.location ? (
                <View className="mt-1 flex-row items-center gap-1.5">
                  <MapPin size={14} color={colores.outline} />
                  <Text className="text-sm text-on-surface-variant">{event.location}</Text>
                </View>
              ) : null}

              <View className="mt-3 flex-row gap-2">
                {RSVP_OPTIONS.map((option) => {
                  const selected = event.myRsvp === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      testID={`rsvp-${event.id}-${option.value}`}
                      onPress={() => void answer(event.id, option.value)}
                      className={`min-h-[36px] flex-1 items-center justify-center rounded-lg ${
                        selected ? 'bg-primary' : 'bg-surface-variant'
                      }`}
                    >
                      <Text
                        className={`text-[13px] font-semibold ${
                          selected ? 'text-on-primary' : 'text-on-surface-variant'
                        }`}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text className="mt-2 text-[11px] text-on-surface-variant">
                {event.rsvpSummary.yes} van · {event.rsvpSummary.maybe} tal vez ·{' '}
                {event.rsvpSummary.pending} sin responder
              </Text>
            </View>
          ))}
        </ScrollView>
      )}

      {hideFab ? null : (
        <Pressable
          testID="btn-nuevo-evento"
          onPress={onCreate}
          className="absolute bottom-5 right-5 h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg"
        >
          <Plus size={24} color={colores["on-primary"]} />
        </Pressable>
      )}
    </View>
  );
}
