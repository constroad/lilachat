import { Pressable, Text, View } from 'react-native';
import { MessagesSquare, Pencil, Plus } from 'lucide-react-native';
import { EMOJIS_RAPIDOS } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { AVATAR_DE_AUTOR } from '../burbuja';

/** El `gap-2` entre el avatar del autor y su burbuja (dp). */
const SEPARACION_DEL_AVATAR = 8;

/**
 * La barra de reacciones sobre el mensaje elegido (20/10; diseño
 * `f1-app-reacciones`): los seis rápidos y «+» para el resto. El emoji que ya
 * puse lleva un círculo tintado; tocarlo de nuevo lo quita. Botones de 40 de
 * ancho (44 de alto) y sin la sangría del avatar: así entra en 360 dp.
 *
 * Debajo, «Responder en hilo» cuando se puede (José, 20/10: «al tocar un
 * mensaje aparecen solo emojis; ahí también la manera de crear hilos»). En la
 * barra de arriba era un ícono sin nombre y no se encontraba.
 */
export function BarraDeReacciones(props: { seq: number; mia: boolean; conAvatar: boolean; miEmoji: string | null; onElegir: (seq: number, emoji: string | null) => void; onMas: (seq: number) => void; onHilo?: (seq: number) => void; onEditar?: (seq: number) => void; /** Over a highlighted notice, in the middle (21/10). */ centered?: boolean; /** Over a flat row (Slack format): on the left, after the avatar. */ indent?: number }) {
  const colores = useColores();
  return (
    <View className={`mb-1 mt-1 flex-row ${props.centered ? 'justify-center' : props.mia && props.indent === undefined ? 'justify-end' : ''}`} style={props.indent !== undefined ? { paddingLeft: props.indent } : props.conAvatar && !props.centered ? { paddingLeft: AVATAR_DE_AUTOR + SEPARACION_DEL_AVATAR } : undefined}>
      <View testID={`barra-reacciones-${props.seq}`} className={`overflow-hidden border border-outline/10 bg-surface shadow-sm ${props.onHilo || props.onEditar ? 'rounded-3xl' : 'rounded-full'}`} style={{ elevation: 4 }}>
      <View className="flex-row items-center gap-0.5 px-1.5 py-1">
        {EMOJIS_RAPIDOS.map((emoji) => {
          const elegido = props.miEmoji === emoji;
          return (
            <Pressable
              key={emoji}
              testID={`reaccion-rapida-${emoji}`}
              accessibilityRole="button"
              accessibilityLabel={elegido ? `Quitar ${emoji}` : `Reaccionar con ${emoji}`}
              onPress={() => props.onElegir(props.seq, elegido ? null : emoji)}
              className={`h-11 w-10 items-center justify-center rounded-full ${elegido ? 'bg-primary/15' : ''}`}
            >
              <Text className="text-[26px]">{emoji}</Text>
            </Pressable>
          );
        })}
        <View className="mx-0.5 h-6 w-px bg-outline/20" />
        <Pressable testID="reaccion-mas" accessibilityRole="button" accessibilityLabel="Más emojis" onPress={() => props.onMas(props.seq)} className="h-11 w-10 items-center justify-center rounded-full bg-background">
          <Plus size={20} color={colores['on-surface-variant']} />
        </Pressable>
      </View>
      {props.onHilo ? (
        <Pressable testID="reaccion-hilo" accessibilityRole="button" onPress={() => props.onHilo?.(props.seq)} className="min-h-[44px] flex-row items-center gap-2.5 border-t border-outline/10 px-4">
          <MessagesSquare size={18} color={colores.primary} />
          <Text className="text-[14px] font-medium text-on-surface">Responder en hilo</Text>
        </Pressable>
      ) : null}
      {/* Editing inside a thread (José, 20/10: «I can't edit my message in a thread»). */}
      {props.onEditar ? (
        <Pressable testID="reaccion-editar" accessibilityRole="button" onPress={() => props.onEditar?.(props.seq)} className="min-h-[44px] flex-row items-center gap-2.5 border-t border-outline/10 px-4">
          <Pencil size={18} color={colores.primary} />
          <Text className="text-[14px] font-medium text-on-surface">Editar</Text>
        </Pressable>
      ) : null}
      </View>
    </View>
  );
}
