import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { CalendarDays, ChevronRight, MapPin, RotateCw } from 'lucide-react-native';
import type { Rsvp } from '@lilachat/shared';
import type { Credential } from '../auth/credentialStore';
import { agendaPorTelefono } from '../contacts/agendaEnMemoria';
import { agendaGet, agendaPost, type AgendaEvent } from './agendaApi';
import { DetalleDeEvento } from './DetalleDeEvento';
import { BotonesDeRsvp } from './BotonesDeRsvp';
import { cuandoDelEvento, origenDelEvento, resumenDeRsvp } from './eventos';
import { useColores } from '../ui/tema';

/**
 * Los eventos que vienen (diseño «New Event», pestaña Eventos).
 *
 * La tarjeta muestra el RSVP con los tres botones a la vista, no detrás de un
 * menú: responder «voy / no voy / tal vez» es la acción principal de esta
 * pantalla y esconderla detrás de un toque extra es lo que hace que nadie
 * responda.
 *
 * Tocar la tarjeta abre el detalle, para TODOS (FL10): quiénes van, en qué
 * chat, hasta qué hora. Quien lo creó lo edita desde ahí.
 */
export function EventsScreen({
  credential,
  recarga,
  onEditar,
  onCantidad,
}: {
  credential: Credential;
  /** Sube cuando algo se creó, editó o canceló: se vuelve a pedir SIN esqueleto. */
  recarga: number;
  onEditar: (event: AgendaEvent) => void;
  /** Cuántos vienen: el número del segmento «Eventos» (18/10). */
  onCantidad?: (cuantos: number) => void;
}) {
  const colores = useColores();
  const [events, setEvents] = useState<AgendaEvent[] | null>(null);
  const cantidadRef = useRef(onCantidad);
  cantidadRef.current = onCantidad;
  useEffect(() => {
    if (events) cantidadRef.current?.(events.length);
  }, [events]);
  const [fallo, setFallo] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  /** El evento abierto en el detalle; se lee de la lista para verlo al día tras recargar. */
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const abierto = (events ?? []).find((event) => event.id === abiertoId) ?? null;
  const agenda = agendaPorTelefono();

  const load = useCallback(async () => {
    const result = await agendaGet<{ events: AgendaEvent[] }>('/events', credential.jwt);
    // Sin red NO es «sin eventos»: se conserva lo que había y se dice.
    if (result.ok) {
      setEvents(result.data.events);
      setFallo(false);
    } else setFallo(true);
  }, [credential.jwt]);

  useEffect(() => {
    void load();
  }, [load, recarga]);

  const answer = async (eventId: string, rsvp: Rsvp) => {
    // Optimista: responder tiene que sentirse instantáneo. El refresco de
    // abajo deja el valor real (y el resumen de quién va); si no hubo red, el
    // aviso de error lo dice.
    setEvents((current) =>
      (current ?? []).map((event) => (event.id === eventId ? { ...event, myRsvp: rsvp } : event))
    );
    await agendaPost(`/events/${eventId}/rsvp`, credential.jwt, { rsvp });
    void load();
  };

  const refresco = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        void load().finally(() => setRefreshing(false));
      }}
    />
  );

  return (
    <View className="flex-1 bg-background" testID="pantalla-eventos">
      {fallo ? (
        <Pressable testID="eventos-error" onPress={() => void load()} className="mx-4 mt-3 flex-row items-center gap-2 rounded-xl bg-error/10 px-4 py-3">
          <RotateCw size={16} color={colores.error} />
          <Text className="flex-1 text-[13px] text-error">No se pudo actualizar. Toca para reintentar.</Text>
        </Pressable>
      ) : null}
      {events === null && fallo ? null : events === null ? (
        <View className="px-5 pt-4" testID="eventos-cargando">
          {[0, 1].map((index) => (
            <View key={index} className="mb-3 h-28 rounded-xl bg-surface-variant" />
          ))}
        </View>
      ) : (events ?? []).length === 0 ? (
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} refreshControl={refresco}>
          <View className="flex-1 items-center justify-center px-8" testID="eventos-vacio">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <CalendarDays size={28} color={colores.primary} />
            </View>
            <Text className="mt-4 text-lg font-semibold text-on-surface">Sin eventos</Text>
            <Text className="mt-1 text-center text-sm leading-5 text-on-surface-variant">
              Crea uno para juntarte con tu gente.
            </Text>
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
          refreshControl={refresco}
        >
          {(events ?? []).map((event) => (
            <Pressable
              key={event.id}
              testID={`evento-${event.id}`}
              onPress={() => setAbiertoId(event.id)}
              android_ripple={{ color: colores.outline }}
              className="mb-3 rounded-xl border border-outline/10 bg-surface p-4"
            >
              {event.createdBy ? (
                <Text className="mb-1 text-[11px] text-on-surface-variant" numberOfLines={1}>
                  {origenDelEvento({
                    chat: event.chat,
                    creadorId: event.createdBy,
                    invitadoPor: event.attendees?.find((a) => a.userId === credential.userId)?.invitedBy,
                    personas: event.personas ?? {},
                    yo: credential.userId,
                    agenda,
                  })}
                </Text>
              ) : null}
              <View className="flex-row items-start gap-2">
                <Text className="min-w-0 flex-1 text-base font-bold text-on-surface">{event.title}</Text>
                <ChevronRight size={16} color={colores.outline} accessibilityLabel="Ver el detalle" />
              </View>
              {event.description ? (
                <Text className="mt-1 text-[13px] leading-5 text-on-surface-variant" numberOfLines={2}>
                  {event.description}
                </Text>
              ) : null}
              <View className="mt-1.5 flex-row items-center gap-1.5">
                <CalendarDays size={14} color={colores.outline} />
                <Text className="text-sm text-on-surface-variant">
                  {cuandoDelEvento(event.startsAt, event.endsAt)}
                </Text>
              </View>
              {event.location ? (
                <View className="mt-1 flex-row items-center gap-1.5">
                  <MapPin size={14} color={colores.outline} />
                  <Text className="text-sm text-on-surface-variant">{event.location}</Text>
                </View>
              ) : null}

              <View className="mt-3">
                <BotonesDeRsvp eventId={event.id} elegido={event.myRsvp} onResponder={(rsvp) => void answer(event.id, rsvp)} />
              </View>

              <Text className="mt-2 text-[11px] text-on-surface-variant">{resumenDeRsvp(event.rsvpSummary)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <DetalleDeEvento
        evento={abierto}
        credential={credential}
        onCerrar={() => setAbiertoId(null)}
        onEditar={(evento) => {
          setAbiertoId(null);
          onEditar(evento);
        }}
        onInvitados={() => void load()}
      />
    </View>
  );
}
