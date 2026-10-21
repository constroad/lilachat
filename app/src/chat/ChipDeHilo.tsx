import { Pressable, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { textoDelChipDeHilo, type ResumenDeHiloEnCliente } from '@lilachat/shared';
import { Avatar } from '../ui/Avatar';
import { useColores } from '../ui/tema';
import { AVATAR_DE_AUTOR } from './burbuja';

/** Los avatares del chip (dp) y cuánto se montan entre sí. */
const AVATAR_DEL_CHIP = 20;
const MONTADO = -6;
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
        className="min-h-[36px] max-w-[88%] flex-row items-center gap-2 rounded-b-xl border border-t-0 border-outline/10 bg-surface px-3"
      >
        <View className="flex-row">
          {(props.hilo.autores ?? []).map((autor, indice) => (
            <View key={autor} style={indice > 0 ? { marginLeft: MONTADO } : undefined}>
              <Avatar nombre={props.nombres.get(autor) ?? '?'} foto={props.fotos.get(autor)} tamano={AVATAR_DEL_CHIP} />
            </View>
          ))}
        </View>
        <Text className="text-[13px] font-semibold text-primary">{cantidad}</Text>
        {resto.length > 0 ? <Text className="text-[12px] text-on-surface-variant">· {resto.join(' · ')}</Text> : null}
        {props.nuevas ? <View testID={`hilo-nuevas-${props.seq}`} className="h-2 w-2 rounded-full bg-primary" /> : null}
        <ChevronRight size={16} color={colores['on-surface-variant']} />
      </Pressable>
    </View>
  );
}
