import { useState } from 'react';
import type { GifResult, MessageTarget } from '@lilachat/shared';
import { Pressable, Text, ToastAndroid, View } from 'react-native';
import { Music, Search, Send } from 'lucide-react-native';
import { Sheet } from '../../ui/Sheet';
import { openGiphyGifInEditor } from '../stickers/chatGifEditor';
import { useColores } from '../../ui/tema';
import { GifChips, GifGrid, useGifSearch, useGifSend } from './GifGrid';
import { GifSearchScreen } from './GifSearchScreen';

/**
 * The «GIF» tab of the panel (backlog 37, José 21/10; design
 * `g-01-panel-gif-giphy`): suggestion chips, a grid of moving previews, and
 * «Powered by GIPHY», as its license asks. A tap sends it. The search opens
 * full screen, like WhatsApp (pending 59): typing in the panel brought up the
 * keyboard, and the keyboard closed the panel.
 */
export function GifPanel(props: { jwt: string; chatId: string; target?: () => MessageTarget; onSent?: () => void }) {
  const colors = useColores();
  const [chip, setChip] = useState('');
  const [searching, setSearching] = useState(false);
  const search = useGifSearch(props.jwt, chip);
  const { send, error } = useGifSend(props.jwt, props.chatId, props.target, props.onSent);
  const [held, setHeld] = useState<GifResult | null>(null);
  const soundSticker = async (gif: GifResult) => {
    setHeld(null);
    const problem = await openGiphyGifInEditor({ jwt: props.jwt, chatId: props.chatId, gifId: gif.id });
    if (problem) ToastAndroid.show(problem, ToastAndroid.SHORT);
  };
  return (
    <View testID="panel-gif" style={{ flex: 1 }}>
      <Pressable testID="buscar-gif" accessibilityRole="search" onPress={() => setSearching(true)} className="mx-3 mt-2 h-10 flex-row items-center gap-2 rounded-full border border-outline/20 bg-surface px-3">
        <Search size={16} color={colors['on-surface-variant']} />
        <Text className="text-[15px] text-outline">Buscar GIF</Text>
      </Pressable>
      <GifChips query={chip} onPick={setChip} />
      {error ? <Text className="px-4 pb-1 text-[13px] text-error">{error}</Text> : null}
      <GifGrid search={search} columns={2} onPick={(gif) => void send(gif)} onSoundSticker={(gif) => void soundSticker(gif)} onLongPress={setHeld} />
      <GifChoiceSheet gif={held} onClose={() => setHeld(null)} onSend={(gif) => { setHeld(null); void send(gif); }} onSoundSticker={(gif) => void soundSticker(gif)} />
      <Text className="py-1.5 text-center text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Powered by GIPHY</Text>
      <GifSearchScreen visible={searching} jwt={props.jwt} chatId={props.chatId} onClose={() => setSearching(false)} target={props.target} onSent={props.onSent} />
    </View>
  );
}

/** A long press on a GIF (design sa-04): send it as always, or make it a sticker with sound first. */
function GifChoiceSheet(props: { gif: GifResult | null; onClose: () => void; onSend: (gif: GifResult) => void; onSoundSticker: (gif: GifResult) => void }) {
  const colors = useColores();
  const { gif } = props;
  return (
    <Sheet visible={gif !== null} onClose={props.onClose} testID="hoja-gif" className="px-4">
      {gif ? (
        <View className="gap-1 pb-2">
          <Pressable testID="gif-enviar" accessibilityRole="button" onPress={() => props.onSend(gif)} className="min-h-[56px] flex-row items-center gap-3 px-2">
            <Send size={20} color={colors['on-surface']} />
            <Text className="text-[16px] text-on-surface">Enviar GIF</Text>
          </Pressable>
          <Pressable testID="gif-sticker-sonido" accessibilityRole="button" onPress={() => props.onSoundSticker(gif)} className="min-h-[56px] flex-row items-center gap-3 px-2">
            <Music size={20} color={colors.primary} />
            <View className="flex-1">
              <Text className="text-[16px] font-semibold text-primary">Hacer sticker con sonido</Text>
              <Text className="text-[13px] text-on-surface-variant">Hasta 6 segundos. Le pones tu voz, un audio o un sonido de Lilachat.</Text>
            </View>
          </Pressable>
        </View>
      ) : null}
    </Sheet>
  );
}
