import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Plus, Search, X } from 'lucide-react-native';
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
  cuentas: Record<'no-leidos' | 'grupos' | 'borradores', number>;
  /** A new section (pending 62): my lists are now sections of «Todos», not chips. */
  onNuevaLista?: () => void;
}) {
  const colores = useColores();
  const { busqueda, filtro, cuentas } = props;
  return (
    <>
    <View className="px-4 pb-2 pt-1">
      <View className="flex-row items-center gap-2 rounded-full bg-primary/[0.07] px-4">
        <Search size={18} color={colores.primary} />
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
            className="h-11 w-11 items-center justify-center"
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
          // Los chats contigo mismo (José, 19/10).
          { id: 'borradores', etiqueta: 'Borradores', cuenta: cuentas.borradores },
        ] satisfies { id: FiltroDeChats; etiqueta: string; cuenta: number }[]
      ).map((chip) => {
        const activo = filtro === chip.id;
        return (
          <Pressable
            key={chip.id}
            testID={`filtro-${chip.id}`}
            accessibilityRole="button"
            accessibilityState={{ selected: activo }}
            onPress={() => props.onFiltrar(chip.id)}
            hitSlop={{ top: 4, bottom: 4 }}
            className={`min-h-[36px] flex-row items-center gap-1.5 rounded-full border px-4 ${
              // Como FL6: el apagado es gris neutro y lleno, no otro lavanda
              // con borde. El borde transparente evita el salto al activarlo.
              activo ? 'border-primary/50 bg-primary/[0.08]' : 'border-transparent bg-surface-variant'
            }`}
          >
            <Text
              className={`text-[13px] font-medium ${activo ? 'text-primary' : 'text-on-surface'}`}
            >
              {chip.etiqueta}
            </Text>
            {chip.cuenta > 0 ? (
              <Text
                className={`shrink-0 text-[13px] font-medium ${activo ? 'text-primary' : 'text-on-surface'}`}
              >
                {chip.cuenta}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
      {props.onNuevaLista ? (
        <Pressable
          testID="filtro-nueva-lista"
          accessibilityRole="button"
          accessibilityLabel="Nueva sección"
          onPress={props.onNuevaLista}
          hitSlop={{ top: 4, bottom: 4 }}
          className="min-h-[36px] w-11 items-center justify-center rounded-full border border-transparent bg-surface-variant"
        >
          <Plus size={16} color={colores['on-surface']} />
        </Pressable>
      ) : null}
    </ScrollView>
    </>
  );
}
