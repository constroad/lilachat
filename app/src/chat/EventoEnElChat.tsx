import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CalendarDays, MapPin, Phone, Video } from 'lucide-react-native';
import { formatEventWhen, type Rsvp, resumenDeRsvp } from '@lilachat/shared';
import { agendaGet, agendaPost, type AgendaEvent } from '../agenda/agendaApi';
import { BotonesDeRsvp } from '../agenda/BotonesDeRsvp';
import { useColores } from '../ui/tema';
import { useTarjetaViva } from './useTarjetaViva';
import { ScheduledCallJoin } from './scheduledCall/ScheduledCallJoin';

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
    } else if (respuesta.status === 404) {
      // Cancelado (o ya no lo veo): lo dice, en vez de ofrecer reintentar.
      eventosVistos.set(eventId, null);
      setEvento(null);
    } else setFallo(true);
  }, [eventId, jwt]);

  useEffect(() => {
    void cargar();
  }, [cargar]);
  useTarjetaViva('evento', eventId, cargar);

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
      <View className="h-32 rounded-xl bg-surface-variant" />
    );
  }

  return (
    <View testID={`evento-en-chat-${eventId}`} className="gap-3 rounded-xl border border-outline/10 bg-surface p-4">
      <View className="flex-row items-start gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          {evento.call ? (evento.call.video ? <Video size={20} color={colores.primary} /> : <Phone size={20} color={colores.primary} />) : <CalendarDays size={20} color={colores.primary} />}
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
      {evento.call ? <ScheduledCallJoin event={evento} video={evento.call.video} /> : null}
      {/* Los mismos botones y el mismo resumen que la Agenda (FL13d). Quien lo
          creó ya va: no se le pregunta. */}
      {evento.mio ? null : <BotonesDeRsvp eventId={eventId} elegido={evento.myRsvp} enviando={enviando} onResponder={(rsvp) => void responder(rsvp)} />}
      <Text className="text-[11px] text-on-surface-variant">{resumenDeRsvp(evento.rsvpSummary)}</Text>
      {error ? <Text className="text-[12px] text-error">{error}</Text> : null}
    </View>
  );
}
