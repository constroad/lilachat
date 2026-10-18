import { Alert, Pressable, Text, View } from 'react-native';
import { Lock, Trash2 } from 'lucide-react-native';
import { tallyPoll } from '@lilachat/shared';
import type { AgendaPoll } from './agendaApi';
import { origenDeEncuesta, resumenDeEncuesta, votantesDeOpcion } from './encuestas';
import { useColores } from '../ui/tema';

/**
 * Una encuesta (FL10, auditoría §46.3). Dice de qué chat es y quién preguntó,
 * quién eligió cada opción (si no es anónima), y quien la creó la cierra o la
 * elimina. Mientras un voto viaja, la tarjeta no acepta otro; si falla, lo
 * dice acá mismo.
 */
export function TarjetaDeEncuesta(props: {
  poll: AgendaPoll;
  yo: string;
  agenda: ReadonlyMap<string, string>;
  ocupada: boolean;
  error?: string;
  onVotar: (indice: number) => void;
  onCerrar: () => void;
  onEliminar: () => void;
}) {
  const colores = useColores();
  const { poll, yo, agenda } = props;
  const cerrada = Boolean(poll.closedAt);
  const tally = tallyPoll(
    { question: poll.question, options: poll.options, allowMultiple: poll.allowMultiple, anonymous: poll.anonymous, closedAt: cerrada ? new Date(poll.closedAt!) : null },
    yo
  );
  const origen = origenDeEncuesta({ chat: poll.chat, autor: poll.autor, yo, agenda });
  const modos = [poll.allowMultiple ? 'Varias respuestas' : null, poll.anonymous ? 'Resultados anónimos' : null].filter(Boolean).join(' · ');

  const confirmarCierre = () =>
    Alert.alert('Cerrar la encuesta', 'Ya nadie podrá votar. Los resultados quedan a la vista.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar', onPress: props.onCerrar },
    ]);
  const confirmarEliminar = () =>
    Alert.alert('Eliminar la encuesta', 'Se borra para todos los del chat.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: props.onEliminar },
    ]);

  return (
    <View testID={`encuesta-${poll.id}`} className="mb-3 rounded-xl border border-outline/10 bg-surface p-4">
      {origen ? (
        <Text className="mb-1 text-[11px] text-on-surface-variant" numberOfLines={1} testID={`origen-${poll.id}`}>
          {origen}
        </Text>
      ) : null}
      <Text className="text-base font-bold text-on-surface">{poll.question}</Text>
      {modos ? <Text className="mt-0.5 text-[11px] text-on-surface-variant">{modos}</Text> : null}

      <View className="mt-3">
        {tally.map((option) => {
          const quienes = votantesDeOpcion({ votos: poll.options[option.optionIndex]?.votes ?? [], personas: poll.personas ?? {}, yo, agenda, anonima: poll.anonymous });
          return (
            <Pressable
              key={option.optionIndex}
              testID={`opcion-${poll.id}-${option.optionIndex}`}
              disabled={cerrada || props.ocupada}
              onPress={() => props.onVotar(option.optionIndex)}
              className="mb-2 overflow-hidden rounded-lg border border-outline/15"
            >
              {/* La barra vive DETRÁS del texto, no al lado: así el porcentaje
                  se lee sobre su propia proporción. */}
              <View
                className={`absolute bottom-0 left-0 top-0 ${option.votedByMe ? 'bg-primary/25' : 'bg-surface-variant'}`}
                style={{ width: `${option.percent}%` }}
              />
              <View className="min-h-[44px] justify-center px-3 py-2">
                <View className="flex-row items-center justify-between">
                  <Text
                    className={`min-w-0 flex-1 text-sm ${option.votedByMe ? 'font-semibold text-primary' : 'text-on-surface'}`}
                    numberOfLines={1}
                  >
                    {option.text}
                  </Text>
                  <Text className="ml-2 shrink-0 text-[11px] font-semibold text-on-surface-variant">
                    {option.percent}% · {option.count}
                  </Text>
                </View>
                {quienes ? (
                  <Text className="mt-0.5 text-[11px] text-on-surface-variant" numberOfLines={1} testID={`votantes-${poll.id}-${option.optionIndex}`}>
                    {quienes}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      {props.error ? (
        <Text className="mb-1 text-[12px] text-error" testID={`error-encuesta-${poll.id}`}>
          {props.error}
        </Text>
      ) : null}

      <View className="flex-row items-center">
        <Text className="min-w-0 flex-1 text-[11px] text-on-surface-variant" testID={`resumen-${poll.id}`}>
          {props.ocupada ? 'Guardando…' : resumenDeEncuesta({ opciones: poll.options, cerrada })}
        </Text>
        {poll.esMia && !cerrada ? (
          <Pressable
            testID={`btn-cerrar-encuesta-${poll.id}`}
            accessibilityLabel="Cerrar la encuesta"
            disabled={props.ocupada}
            onPress={confirmarCierre}
            className="h-11 flex-row items-center gap-1 px-2"
          >
            <Lock size={15} color={colores.primary} />
            <Text className="text-[13px] font-semibold text-primary">Cerrar</Text>
          </Pressable>
        ) : null}
        {poll.esMia ? (
          <Pressable
            testID={`btn-eliminar-encuesta-${poll.id}`}
            accessibilityLabel="Eliminar la encuesta"
            disabled={props.ocupada}
            onPress={confirmarEliminar}
            className="h-11 w-11 items-center justify-center"
          >
            <Trash2 size={17} color={colores.error} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
