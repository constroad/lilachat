import { Pressable, Text, TextInput, View } from 'react-native';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react-native';
import { busquedaValida } from '@lilachat/shared';
import { useMargenes } from '../ui/useMargenes';
import { useColores } from '../ui/tema';

/**
 * La barra de buscar dentro del chat (FL9): reemplaza a la cabecera mientras
 * dura, como WhatsApp. ↑ va a la coincidencia más vieja, ↓ a la más nueva.
 */
export function BuscadorDelChat(props: {
  consulta: string;
  onConsulta: (texto: string) => void;
  posicion: number;
  total: number;
  onAnterior: () => void;
  onSiguiente: () => void;
  onCerrar: () => void;
}) {
  const colores = useColores();
  const margenes = useMargenes();
  const conTexto = busquedaValida(props.consulta);
  const puedeSubir = props.total > 0 && props.posicion > 1;
  const puedeBajar = props.total > 0 && props.posicion < props.total;
  return (
    <View
      testID="buscador-del-chat"
      className="flex-row items-center gap-1 border-b border-outline/10 bg-surface px-2 pb-3"
      style={{ paddingTop: margenes.cabecera }}
    >
      <Pressable testID="btn-cerrar-busqueda-chat" accessibilityLabel="Cerrar la búsqueda" onPress={props.onCerrar} className="h-11 w-11 items-center justify-center">
        <ArrowLeft size={22} color={colores['on-surface']} />
      </Pressable>
      <TextInput
        testID="input-buscar-en-chat"
        value={props.consulta}
        onChangeText={props.onConsulta}
        autoFocus
        placeholder="Buscar…"
        placeholderTextColor={colores['on-surface-variant']}
        returnKeyType="search"
        onSubmitEditing={props.onAnterior}
        className="min-h-[44px] min-w-0 flex-1 text-base text-on-surface"
      />
      {conTexto ? (
        <Text testID="conteo-busqueda-chat" className="text-[12px] text-on-surface-variant">
          {props.total === 0 ? 'Sin resultados' : `${Math.max(props.posicion, 1)} de ${props.total}`}
        </Text>
      ) : null}
      <Pressable
        testID="btn-coincidencia-anterior"
        accessibilityLabel="Coincidencia anterior"
        onPress={props.onAnterior}
        disabled={!puedeSubir}
        className={`h-11 w-10 items-center justify-center ${puedeSubir ? '' : 'opacity-30'}`}
      >
        <ChevronUp size={22} color={colores['on-surface']} />
      </Pressable>
      <Pressable
        testID="btn-coincidencia-siguiente"
        accessibilityLabel="Coincidencia siguiente"
        onPress={props.onSiguiente}
        disabled={!puedeBajar}
        className={`h-11 w-10 items-center justify-center ${puedeBajar ? '' : 'opacity-30'}`}
      >
        <ChevronDown size={22} color={colores['on-surface']} />
      </Pressable>
    </View>
  );
}
