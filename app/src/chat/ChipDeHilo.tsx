import { Pressable, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { textoDelChipDeHilo, type ResumenDeHiloEnCliente } from '@lilachat/shared';
import { Avatar } from '../ui/Avatar';
import { useColores } from '../ui/tema';
import { AVATAR_DE_AUTOR } from './burbuja';

/** The chip's avatars (dp) and how much they overlap (José, 21/10: the threads showed, but too small). */
const CHIP_AVATAR = 28;
const MONTADO = -8;
/** El `gap-2` entre el avatar del autor y su burbuja (dp): el chip arranca donde la burbuja. */
const SEPARACION_DEL_AVATAR = 8;

/**
 * Debajo de la raíz de un hilo (E3, 20/10; diseño `e3-app-chip-hilo`): los
 * últimos que respondieron, «4 respuestas · última 10:42», un punto si hay
 * nuevas y la flecha. Tocarlo abre el hilo.
 */
export function ChipDeHilo(props: {
  seq: number;
  hilo: ResumenDeHiloEnCliente;
  mia: boolean;
  /** En un grupo, lo ajeno lleva el avatar del autor: el chip se alinea con la burbuja. */
  conAvatar: boolean;
  nombres: ReadonlyMap<string, string>;
  fotos: ReadonlyMap<string, string>;
  nuevas: boolean;
  onAbrir: (seq: number) => void;
  /** Under a highlighted notice, in the middle (21/10). */
  centered?: boolean;
}) {
  const colores = useColores();
  const texto = textoDelChipDeHilo(props.hilo);
  if (!texto) return null;
  const [cantidad, ...resto] = texto.split(' · ');
  return (
    <View className={`-mt-0.5 flex-row ${props.centered ? 'justify-center' : props.mia ? 'justify-end' : ''}`} style={props.conAvatar && !props.centered ? { paddingLeft: AVATAR_DE_AUTOR + SEPARACION_DEL_AVATAR } : undefined}>
      <Pressable
        testID={`chip-hilo-${props.seq}`}
        accessibilityRole="button"
        accessibilityLabel={`${texto}. Abrir el hilo`}
        onPress={() => props.onAbrir(props.seq)}
        className="min-h-[48px] max-w-[88%] flex-row items-center gap-2.5 rounded-b-2xl border border-t-0 border-outline/15 bg-surface px-3.5"
      >
        <View className="flex-row">
          {(props.hilo.autores ?? []).map((autor, indice) => (
            <View key={autor} style={indice > 0 ? { marginLeft: MONTADO } : undefined}>
              <Avatar nombre={props.nombres.get(autor) ?? '?'} foto={props.fotos.get(autor)} tamano={CHIP_AVATAR} />
            </View>
          ))}
        </View>
        <Text className="text-[15px] font-bold text-primary">{cantidad}</Text>
        {resto.length > 0 ? <Text className="flex-shrink text-[13px] text-on-surface-variant">· {resto.join(' · ')}</Text> : null}
        {props.nuevas ? <View testID={`hilo-nuevas-${props.seq}`} className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
        <ChevronRight size={18} color={colores['on-surface-variant']} />
      </Pressable>
    </View>
  );
}
