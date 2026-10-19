import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { CalendarDays, MapPin } from 'lucide-react-native';
import { formatEventWhen, type Rsvp } from '@lilachat/shared';
import { agendaGet, agendaPost, type AgendaEvent } from '../agenda/agendaApi';
import { useColores } from '../ui/tema';

/** Lo último que se vio de cada evento, para que la celda reciclada no parpadee. `null` = ya no está. */
const eventosVistos = new Map<string, AgendaEvent | null>();

/**
 * El evento DENTRO del chat (José, 18/10): qué, cuándo y dónde, y confirmar
 * ahí mismo, como una invitación de WhatsApp. El detalle completo sigue en la
 * pestaña Agenda.
 */
export function EventoEnElChat({ eventId, jwt }: { eventId: string; jwt: string }) {
  const colores = useColores();
  /** `undefined` = cargando; `null` = se canceló o ya no se ve. */
  const [evento, setEvento] = useState<AgendaEvent | null | undefined>(() => eventosVistos.get(eventId));
  const [fallo, setFallo] = useState(false);
  const [enviando, setEnviando] = useState<Rsvp | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    const respuesta = await agendaGet<{ event: AgendaEvent }>(`/events/${eventId}`, jwt);
    if (respuesta.ok) {
      eventosVistos.set(eventId, respuesta.data.event);
      setEvento(respuesta.data.event);
      setFallo(false);
    } else setFallo(true);
  }, [eventId, jwt]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const responder = async (rsvp: Rsvp) => {
    if (enviando) return;
    setEnviando(rsvp);
    setError('');
    const respuesta = await agendaPost(`/events/${eventId}/rsvp`, jwt, { rsvp });
    setEnviando(null);
    if (!respuesta.ok) return setError(respuesta.message ?? 'No se pudo responder. Inténtalo de nuevo.');
    void cargar();
  };

  if (evento === null) {
    return <Text className="px-1 text-[13px] italic text-on-surface-variant">Este evento ya no está disponible.</Text>;
  }
  if (evento === undefined) {
    return fallo ? (
      <Pressable testID={`evento-reintentar-${eventId}`} onPress={() => void cargar()} className="min-h-[44px] justify-center rounded-2xl border border-outline/15 bg-surface px-4">
        <Text className="text-[13px] text-on-surface-variant">No se pudo cargar el evento. Toca para reintentar.</Text>
      </Pressable>
    ) : (
      <View className="h-32 rounded-2xl bg-surface-variant" />
    );
  }

  const { yes } = evento.rsvpSummary;
  return (
    <View testID={`evento-en-chat-${eventId}`} className="gap-3 rounded-2xl border border-outline/15 bg-surface p-4">
      <View className="flex-row items-start gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <CalendarDays size={20} color={colores.primary} />
        </View>
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="text-[15px] font-semibold text-on-surface">{evento.title}</Text>
          <Text className="text-[13px] text-on-surface-variant">{formatEventWhen(new Date(evento.startsAt))}</Text>
          {evento.location ? (
            <View className="mt-0.5 flex-row items-center gap-1">
              <MapPin size={13} color={colores['on-surface-variant']} />
              <Text className="min-w-0 flex-1 text-[13px] text-on-surface-variant" numberOfLines={1}>
                {evento.location}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <Text className="text-[12px] text-on-surface-variant">{yes === 1 ? '1 va' : `${yes} van`}</Text>
      {/* Quien lo creó ya va: no se le pregunta. */}
      {evento.mio ? null : (
        <View className="flex-row gap-2">
          {(
            [
              { rsvp: 'yes', texto: 'Voy' },
              { rsvp: 'no', texto: 'No voy' },
            ] as const
          ).map(({ rsvp, texto }) => {
            const elegido = evento.myRsvp === rsvp;
            return (
              <Pressable
                key={rsvp}
                testID={`evento-${rsvp}-${eventId}`}
                onPress={() => void responder(rsvp)}
                className={`min-h-[44px] flex-1 flex-row items-center justify-center gap-2 rounded-xl ${elegido ? 'bg-primary' : 'border border-outline/20'}`}
              >
                {enviando === rsvp ? <ActivityIndicator size="small" color={elegido ? colores['on-primary'] : colores.primary} /> : null}
                <Text className={`text-[14px] font-semibold ${elegido ? 'text-on-primary' : 'text-on-surface'}`}>{texto}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {error ? <Text className="text-[12px] text-error">{error}</Text> : null}
    </View>
  );
}
