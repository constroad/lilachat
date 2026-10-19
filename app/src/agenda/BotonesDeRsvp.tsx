import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { Rsvp } from '@lilachat/shared';
import { useColores } from '../ui/tema';

const OPCIONES: { valor: Rsvp; texto: string }[] = [
  { valor: 'yes', texto: 'Voy' },
  { valor: 'maybe', texto: 'Tal vez' },
  { valor: 'no', texto: 'No voy' },
];

/**
 * «Voy / Tal vez / No voy» a la vista (FL10), el MISMO en la Agenda y en la
 * tarjeta del chat (FL13d: el chat tenía dos botones con otro estilo).
 */
export function BotonesDeRsvp(props: {
  eventId: string;
  elegido?: Rsvp | null;
  /** La respuesta que está viajando: lleva el indicador. */
  enviando?: Rsvp | null;
  onResponder: (rsvp: Rsvp) => void;
}) {
  const colores = useColores();
  return (
    <View className="flex-row gap-2">
      {OPCIONES.map(({ valor, texto }) => {
        const elegido = props.elegido === valor;
        return (
          <Pressable
            key={valor}
            testID={`rsvp-${props.eventId}-${valor}`}
            onPress={() => props.onResponder(valor)}
            className={`min-h-[44px] flex-1 flex-row items-center justify-center gap-1.5 rounded-lg ${elegido ? 'bg-primary' : 'bg-surface-variant'}`}
          >
            {props.enviando === valor ? <ActivityIndicator size="small" color={elegido ? colores['on-primary'] : colores.primary} /> : null}
            <Text className={`text-[13px] font-semibold ${elegido ? 'text-on-primary' : 'text-on-surface-variant'}`}>{texto}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
