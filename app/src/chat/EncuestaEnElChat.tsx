import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { agendaGet, type AgendaPoll } from '../agenda/agendaApi';
import { TarjetaDeEncuesta } from '../agenda/TarjetaDeEncuesta';
import { useAccionesDeEncuesta } from '../agenda/useAccionesDeEncuesta';
import { agendaPorTelefono } from '../contacts/agendaEnMemoria';
import { useTarjetaViva } from './useTarjetaViva';

/**
 * Lo último que se vio de cada encuesta: la celda se recicla al scrollear y
 * volver a pedirla dejaría la tarjeta en blanco un instante. `null` = ya no está.
 */
const encuestasVistas = new Map<string, AgendaPoll | null>();

/**
 * La encuesta DENTRO del chat (José, 18/10): se vota acá mismo, como WhatsApp.
 * Es la misma tarjeta y las mismas acciones que la pestaña Encuestas.
 */
export function EncuestaEnElChat({ pollId, jwt, yo }: { pollId: string; jwt: string; yo: string }) {
  /** `undefined` = cargando; `null` = se eliminó o ya no se ve. */
  const [poll, setPoll] = useState<AgendaPoll | null | undefined>(() => encuestasVistas.get(pollId));
  const [fallo, setFallo] = useState(false);

  const cargar = useCallback(async () => {
    const respuesta = await agendaGet<{ poll: AgendaPoll }>(`/polls/${pollId}`, jwt);
    if (respuesta.ok) {
      encuestasVistas.set(pollId, respuesta.data.poll);
      setPoll(respuesta.data.poll);
      setFallo(false);
    } else if (respuesta.status === 404) {
      // Borrada (o ya no la veo): lo dice, en vez de ofrecer reintentar para siempre.
      encuestasVistas.set(pollId, null);
      setPoll(null);
    } else setFallo(true);
  }, [pollId, jwt]);

  // Siempre se pide al montar: los votos cambian y la tarjeta tiene que mostrarlos.
  useEffect(() => {
    void cargar();
  }, [cargar]);
  useTarjetaViva('encuesta', pollId, cargar);

  const reemplazar = (id: string, nueva: AgendaPoll | null) => {
    encuestasVistas.set(id, nueva);
    setPoll(nueva);
  };
  const acciones = useAccionesDeEncuesta({ jwt, yo, reemplazar, recargar: () => void cargar() });

  if (poll === null) {
    return <Text className="px-1 text-[13px] italic text-on-surface-variant">Esta encuesta ya no está disponible.</Text>;
  }
  if (poll === undefined) {
    return fallo ? (
      <Pressable testID={`encuesta-reintentar-${pollId}`} onPress={() => void cargar()} className="min-h-[44px] justify-center rounded-2xl border border-outline/15 bg-surface px-4">
        <Text className="text-[13px] text-on-surface-variant">No se pudo cargar la encuesta. Toca para reintentar.</Text>
      </Pressable>
    ) : (
      <View className="h-40 rounded-xl bg-surface-variant" />
    );
  }
  return (
    <TarjetaDeEncuesta
      poll={poll}
      yo={yo}
      agenda={agendaPorTelefono()}
      ocupada={acciones.ocupada === poll.id}
      error={acciones.errores[poll.id]}
      onVotar={(indice) => void acciones.votar(poll, indice)}
      onCerrar={() => void acciones.cerrar(poll)}
      onEliminar={() => void acciones.eliminar(poll)}
      enElChat
    />
  );
}
