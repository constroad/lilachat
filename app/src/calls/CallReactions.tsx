import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Smile, X } from 'lucide-react-native';
import { CALL_STICKER_MS, winkById, type CallReaction } from '@lilachat/shared';
import { Modal } from '../ui/Modal';
import { Segmentado } from '../ui/Segmentado';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';
import { WinkOverlay } from '../chat/WinkOverlay';
import { WinkPanel } from '../chat/WinkPanel';
import { STICKER_PACK_SECTIONS } from '../chat/stickers/useStickers';

type Tab = 'winks' | 'stickers';
const TABS = [{ key: 'winks', etiqueta: 'Guiños', testID: 'reacciones-guinos' }, { key: 'stickers', etiqueta: 'Stickers', testID: 'reacciones-stickers' }] as const;
const STICKER_TILE = 76;
const FLOAT_SIZE = 180;
const FADE_MS = 300;

/** The round button over the call's controls that opens winks and stickers (pending 98). */
export function CallReactionButton(props: { onPress: () => void }) {
  const colors = useColores();
  return (
    <Pressable testID="btn-reacciones-llamada" accessibilityLabel="Guiños y stickers" onPress={props.onPress} className="h-12 w-12 items-center justify-center rounded-full bg-black/30">
      <Smile size={24} color={colors['on-primary']} />
    </Pressable>
  );
}

/** Winks (the chat's own panel) and the packs' stickers; picking one sends it and closes. */
export function CallReactionSheet(props: { peerName: string; onSend: (reaction: CallReaction) => void; onClose: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const [tab, setTab] = useState<Tab>('winks');
  const send = (reaction: CallReaction) => {
    props.onSend(reaction);
    props.onClose();
  };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={props.onClose}>
      <Pressable className="flex-1 bg-black/30" onPress={props.onClose} accessibilityLabel="Cerrar" />
      <View testID="hoja-reacciones-llamada" className="max-h-[70%] rounded-t-3xl bg-surface pt-3" style={{ paddingBottom: margins.pie + 8 }}>
        <View className="flex-row items-center px-4 pb-2">
          <Text className="flex-1 text-[16px] font-bold text-on-surface">{`Para ${props.peerName}`}</Text>
          <Pressable onPress={props.onClose} accessibilityLabel="Cerrar" className="h-11 w-11 items-center justify-center"><X size={20} color={colors['on-surface-variant']} /></Pressable>
        </View>
        <View className="px-4 pb-2"><Segmentado opciones={TABS} valor={tab} onCambiar={setTab} /></View>
        {tab === 'winks' ? (
          <WinkPanel recipient={props.peerName} onSend={(id) => send({ kind: 'wink', id })} />
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            {STICKER_PACK_SECTIONS.map((pack) => (
              <View key={pack.id} className="mb-3">
                <Text className="mb-2 text-[13px] font-semibold text-on-surface-variant">{pack.title}</Text>
                <View className="flex-row flex-wrap gap-2">
                  {pack.stickers.map((sticker) => (
                    <Pressable key={sticker.id} testID={`sticker-llamada-${sticker.id}`} accessibilityLabel="Mandar sticker" onPress={() => send({ kind: 'sticker', id: sticker.id })}>
                      <Image source={{ uri: sticker.url }} style={{ width: STICKER_TILE, height: STICKER_TILE }} contentFit="contain" autoplay={false} />
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

/** What plays over the call: a wink with its own choreography, or a sticker that rises and fades. */
export function CallReactionOverlay(props: { played: { reaction: CallReaction; key: number } | null; onDone: () => void }) {
  const { played, onDone } = props;
  const wink = played?.reaction.kind === 'wink' ? winkById(played.reaction.id) : undefined;
  const winkPlay = useMemo(() => (played && wink ? { seq: played.key, wink, run: played.key } : null), [played, wink]);
  if (!played) return null;
  if (played.reaction.kind === 'wink') return <WinkOverlay play={winkPlay} onDone={onDone} />;
  return <FloatingSticker key={played.key} id={played.reaction.id} onDone={onDone} />;
}

function FloatingSticker(props: { id: string; onDone: () => void }) {
  const url = STICKER_PACK_SECTIONS.flatMap((pack) => pack.stickers).find((sticker) => sticker.id === props.id)?.url;
  const opacity = useSharedValue(0);
  const lift = useSharedValue(40);
  const { onDone } = props;
  useEffect(() => {
    opacity.value = withSequence(withTiming(1, { duration: FADE_MS }), withTiming(1, { duration: CALL_STICKER_MS - FADE_MS * 2 }), withTiming(0, { duration: FADE_MS }));
    lift.value = withTiming(-40, { duration: CALL_STICKER_MS, easing: Easing.out(Easing.quad) });
    const timer = setTimeout(onDone, CALL_STICKER_MS);
    return () => clearTimeout(timer);
  }, [opacity, lift, onDone]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateY: lift.value }] }));
  if (!url) return null;
  return (
    <View testID={`sticker-en-llamada-${props.id}`} pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
      <Animated.View style={style}>
        <Image source={{ uri: url }} style={{ width: FLOAT_SIZE, height: FLOAT_SIZE }} contentFit="contain" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({ center: { alignItems: 'center', justifyContent: 'center', zIndex: 2 } });
