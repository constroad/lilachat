import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { Crown, MessageSquare, X } from 'lucide-react-native';
import { birthdayCardFor, limaDayKey } from '@lilachat/shared';
import { Modal } from '../../ui/Modal';
import { Avatar } from '../../ui/Avatar';
import { useColores } from '../../ui/tema';
import { loadSeenBirthdayCards, markBirthdayCardSeen } from './seenBirthdayCards';

const QUICK_REACTIONS = ['🎂', '👏', '❤️', '🎉'] as const;
/** The confetti of the design (`c1-app-cumpleanos`): still pieces in the brand's colors, nothing childish. */
const CONFETTI = [
  { top: '8%', left: '12%', color: 'bg-primary', rotate: '20deg' },
  { top: '14%', left: '78%', color: 'bg-warning', rotate: '-30deg' },
  { top: '22%', left: '40%', color: 'bg-tertiary', rotate: '45deg' },
  { top: '72%', left: '8%', color: 'bg-warning', rotate: '-15deg' },
  { top: '80%', left: '84%', color: 'bg-primary', rotate: '30deg' },
  { top: '88%', left: '30%', color: 'bg-tertiary', rotate: '-40deg' },
] as const;

type Props = {
  chatId: string;
  chatName: string;
  isGroup: boolean;
  me: string;
  messages: readonly { seq: number; at: string; senderId: string; system?: { evento?: string; valor?: string } }[];
  names: ReadonlyMap<string, string>;
  photos: ReadonlyMap<string, string>;
  onReact: (emoji: string) => void;
  onGreet: (text: string) => void;
};

/**
 * The birthday card (pending 17, design `c1-app-cumpleanos`): on opening a
 * chat that has birthdays on, the day of someone else's, once per phone. The
 * design's «Crear tarjeta con IA» needs a paid image model: José decides it,
 * and it is not drawn meanwhile.
 */
export function BirthdayCard(props: Props) {
  const colors = useColores();
  const [card, setCard] = useState<{ seq: number; who: string; age?: number } | null>(null);
  const { chatId, me, messages } = props;

  useEffect(() => {
    let alive = true;
    void loadSeenBirthdayCards().then((seen) => {
      if (!alive) return;
      const found = birthdayCardFor(messages, { me, todayKey: limaDayKey(new Date()), seen: (seq) => seen.has(`${chatId}:${seq}`) });
      if (found) setCard((current) => current ?? found);
    });
    return () => {
      alive = false;
    };
  }, [chatId, me, messages]);

  if (!card) return null;
  const name = props.names.get(card.who) ?? 'tu contacto';
  const firstName = name.split(' ')[0];
  const close = () => {
    void markBirthdayCardSeen(`${chatId}:${card.seq}`);
    setCard(null);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <Animated.View entering={FadeIn} className="flex-1 items-center justify-center bg-black/65 px-6" testID="tarjeta-cumpleanos-chat">
        {CONFETTI.map((piece, index) => (
          <View key={index} pointerEvents="none" className={`absolute h-3 w-2 rounded-sm ${piece.color}`} style={{ top: piece.top, left: piece.left, transform: [{ rotate: piece.rotate }] }} />
        ))}
        <Pressable testID="btn-cerrar-cumpleanos" accessibilityLabel="Cerrar" onPress={close} className="absolute right-5 top-14 h-11 w-11 items-center justify-center rounded-full bg-white/20">
          <X size={22} color="white" />
        </Pressable>
        <Animated.View entering={ZoomIn.springify().damping(14)} className="w-full max-w-[380px] items-center rounded-3xl bg-surface px-5 pb-5 pt-6">
          <View className="items-center">
            <Crown size={22} color={colors.warning} />
            <View className="mt-1 rounded-full border-4 border-primary/70 p-1">
              <Avatar nombre={name} foto={props.photos.get(card.who)} tamano={96} />
            </View>
            <View className="absolute -right-1 bottom-0 h-9 w-9 items-center justify-center rounded-full bg-surface">
              <Text style={{ fontSize: 18 }}>🎂</Text>
            </View>
          </View>
          <Text className="mt-4 text-center text-[22px] font-extrabold text-on-surface">¡Feliz cumpleaños, {firstName}!</Text>
          <View className="mt-2 rounded-full bg-primary/10 px-3 py-1">
            <Text className="text-[13px] font-medium text-primary">
              {card.age ? `Hoy cumple ${card.age} años` : 'Hoy es su cumpleaños'}
              {props.isGroup ? ` · ${props.chatName}` : ''}
            </Text>
          </View>
          <Text className="mt-5 text-[11px] font-semibold uppercase tracking-[1.5px] text-on-surface-variant">Reaccionar al instante</Text>
          <View className="mt-2 flex-row gap-3">
            {QUICK_REACTIONS.map((emoji) => (
              <Pressable
                key={emoji}
                testID={`cumple-reaccion-${emoji}`}
                accessibilityLabel={`Mandar ${emoji}`}
                onPress={() => {
                  props.onReact(emoji);
                  close();
                }}
                className="h-14 w-14 items-center justify-center rounded-full border border-outline/15 bg-background"
              >
                <Text style={{ fontSize: 24 }}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            testID="btn-saludar-cumpleanos"
            onPress={() => {
              props.onGreet(`¡Feliz cumpleaños, ${firstName}! 🎉`);
              close();
            }}
            className="mt-5 min-h-[52px] w-full flex-row items-center justify-center gap-2 rounded-2xl bg-primary"
          >
            <MessageSquare size={18} color={colors['on-primary']} />
            <Text className="text-[15px] font-semibold text-on-primary">{props.isGroup ? 'Saludar en el grupo' : 'Saludar'}</Text>
          </Pressable>
        </Animated.View>
        <Text className="absolute bottom-10 px-8 text-center text-[13px] text-white/80">
          {props.isGroup ? 'Lo ves porque el grupo tiene activados los cumpleaños' : 'Lo ves porque este chat tiene activados los cumpleaños'}
        </Text>
      </Animated.View>
    </Modal>
  );
}
