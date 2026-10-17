import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Search, X } from 'lucide-react-native';
import type { FiltroDeChats } from '@lilachat/shared';
import { useColores } from '../ui/tema';

/**
 * El buscador y los chips de la lista de chats, como WhatsApp (salió de
 * `ChatListScreen`, que pasaba de 700 líneas).
 */
export function BuscadorDeChats(props: {
  busqueda: string;
  onBuscar: (texto: string) => void;
  filtro: FiltroDeChats;
  onFiltrar: (filtro: FiltroDeChats) => void;
  cuentas: Record<'no-leidos' | 'grupos', number>;
}) {
  const colores = useColores();
  const { busqueda, filtro, cuentas } = props;
  return (
    <>
    <View className="px-4 pb-2 pt-1">
      <View className="flex-row items-center gap-2 rounded-full bg-primary/[0.07] px-4">
        <Search size={16} color={colores.outline} />
        <TextInput
          testID="buscar-chats"
          value={busqueda}
          onChangeText={props.onBuscar}
          placeholder="Buscar"
          placeholderTextColor={colores['on-surface-variant']}
          className="min-h-[44px] min-w-0 flex-1 text-[15px] text-on-surface"
        />
        {busqueda ? (
          <Pressable
            testID="btn-limpiar-busqueda"
            accessibilityLabel="Limpiar la búsqueda"
            onPress={() => props.onBuscar('')}
            className="h-11 w-8 items-center justify-center"
          >
            <X size={16} color={colores['on-surface-variant']} />
          </Pressable>
        ) : null}
      </View>
    </View>

    {/* Los chips scrollean en horizontal: son tres y entran, pero el
        contador puede empujarlos en pantallas angostas y una fila de
        filtros partida en dos se ve rota. */}
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Un ScrollView dentro de una columna CRECE hasta llenar lo que
      // sobra: sin esto la fila de chips se comía media pantalla y dejaba
      // dos huecos enormes alrededor.
      style={{ flexGrow: 0 }}
      // `alignItems: 'center'` NO es cosmético: sin él el ScrollView
      // estira a los hijos a TODA su altura y los chips salen como
      // píldoras gigantes. Visto en el emulador.
      contentContainerStyle={{
        paddingHorizontal: 16,
        gap: 8,
        paddingBottom: 8,
        alignItems: 'center',
      }}
    >
      {(
        [
          { id: 'todos', etiqueta: 'Todos', cuenta: 0 },
          { id: 'no-leidos', etiqueta: 'No leídos', cuenta: cuentas['no-leidos'] },
          { id: 'grupos', etiqueta: 'Grupos', cuenta: cuentas.grupos },
        ] as const
      ).map((chip) => {
        const activo = filtro === chip.id;
        return (
          <Pressable
            key={chip.id}
            testID={`filtro-${chip.id}`}
            accessibilityRole="button"
            accessibilityState={{ selected: activo }}
            onPress={() => props.onFiltrar(chip.id)}
            className={`min-h-[36px] flex-row items-center gap-1.5 rounded-full border px-4 ${
              activo ? 'border-primary bg-primary/[0.14]' : 'border-outline/20'
            }`}
          >
            <Text
              className={`text-[13px] ${activo ? 'font-semibold text-primary' : 'text-on-surface-variant'}`}
            >
              {chip.etiqueta}
            </Text>
            {chip.cuenta > 0 ? (
              <Text
                className={`shrink-0 text-[12px] ${activo ? 'text-primary' : 'text-on-surface-variant'}`}
              >
                {chip.cuenta}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
    </>
  );
}
