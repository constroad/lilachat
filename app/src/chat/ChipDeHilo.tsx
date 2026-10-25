import { Pressable, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { textoDelChipDeHilo, type ResumenDeHiloEnCliente } from '@lilachat/shared';
import { Avatar } from '../ui/Avatar';
import { useColores } from '../ui/tema';
import { AVATAR_DE_AUTOR } from './burbuja';
import { useBubbleWidth } from './bubbleWidths';

/** The chip's avatars (dp) and how much they overlap (José, 21/10: the threads showed, but too small). */
const CHIP_AVATAR = 28;
/** In the Slack format the chip is one compact line, like Slack's: avatars, the count and when the last one came (José 25/10). */
const FLAT_CHIP_AVATAR = 20;
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
  /** `chatId:seq`: the bubble's width under that key (`bubbleWidths.ts`). */
  bubbleKey: string;
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
  /** Under a flat row (Slack format): on the left, after the avatar. */
  indent?: number;
}) {
  const colores = useColores();
  const bubbleWidth = useBubbleWidth(props.bubbleKey);
  const texto = textoDelChipDeHilo(props.hilo);
  if (!texto) return null;
  const [cantidad, ...resto] = texto.split(' · ');
  const flat = props.indent !== undefined;
  return (
    <View className={`${props.indent !== undefined ? 'mt-1' : '-mt-0.5'} flex-row ${props.centered ? 'justify-center' : props.mia && props.indent === undefined ? 'justify-end' : ''}`} style={props.indent !== undefined ? { paddingLeft: props.indent } : props.conAvatar && !props.centered ? { paddingLeft: AVATAR_DE_AUTOR + SEPARACION_DEL_AVATAR } : undefined}>
      <Pressable
        testID={`chip-hilo-${props.seq}`}
        accessibilityRole="button"
        accessibilityLabel={`${texto}. Abrir el hilo`}
        onPress={() => props.onAbrir(props.seq)}
        className={
          flat
            ? 'min-h-[36px] max-w-full flex-shrink flex-row items-center gap-2 rounded-lg border border-outline/15 bg-surface px-2'
            : 'min-h-[48px] max-w-[80%] flex-row items-center gap-2.5 rounded-b-2xl border border-t-0 border-outline/15 bg-surface px-3.5'
        }
        // As wide as its bubble, so the edges meet; the same 80 % limit as the bubble.
        style={bubbleWidth && !flat && !props.centered ? { minWidth: bubbleWidth } : undefined}
      >
        <View className="flex-row">
          {(props.hilo.autores ?? []).map((autor, indice) => (
            <View key={autor} style={indice > 0 ? { marginLeft: MONTADO } : undefined}>
              <Avatar nombre={props.nombres.get(autor) ?? '?'} foto={props.fotos.get(autor)} tamano={flat ? FLAT_CHIP_AVATAR : CHIP_AVATAR} />
            </View>
          ))}
        </View>
        <Text className={`${flat ? 'text-[14px]' : 'text-[15px]'} font-bold text-primary`} numberOfLines={1}>{cantidad}</Text>
        {resto.length > 0 ? <Text className={`flex-shrink ${flat ? 'text-[12px]' : 'text-[13px]'} text-on-surface-variant`} numberOfLines={1}>· {resto.join(' · ')}</Text> : null}
        {props.nuevas ? <View testID={`hilo-nuevas-${props.seq}`} className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
        <ChevronRight size={flat ? 16 : 18} color={colores['on-surface-variant']} />
      </Pressable>
    </View>
  );
}
