import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Search } from 'lucide-react-native';
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
export function GifPanel(props: { jwt: string; chatId: string }) {
  const colors = useColores();
  const [chip, setChip] = useState('');
  const [searching, setSearching] = useState(false);
  const search = useGifSearch(props.jwt, chip);
  const { send, error } = useGifSend(props.jwt, props.chatId);
  return (
    <View testID="panel-gif" style={{ flex: 1 }}>
      <Pressable testID="buscar-gif" accessibilityRole="search" onPress={() => setSearching(true)} className="mx-3 mt-2 h-10 flex-row items-center gap-2 rounded-full border border-outline/20 bg-surface px-3">
        <Search size={16} color={colors['on-surface-variant']} />
        <Text className="text-[15px] text-outline">Buscar GIF</Text>
      </Pressable>
      <GifChips query={chip} onPick={setChip} />
      {error ? <Text className="px-4 pb-1 text-[13px] text-error">{error}</Text> : null}
      <GifGrid search={search} columns={2} onPick={(gif) => void send(gif)} />
      <Text className="py-1.5 text-center text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Powered by GIPHY</Text>
      <GifSearchScreen visible={searching} jwt={props.jwt} chatId={props.chatId} onClose={() => setSearching(false)} />
    </View>
  );
}
