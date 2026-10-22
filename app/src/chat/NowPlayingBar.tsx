import { Pressable, Text, View } from 'react-native';
import { Pause, Play, X } from 'lucide-react-native';
import { nextPlaybackRate, nowPlayingLabel, nowPlayingProgress, showsNowPlayingBar } from '@lilachat/shared';
import { Avatar } from '../ui/Avatar';
import { useColores } from '../ui/tema';
import { setVoiceNoteRate, stopVoiceNote, toggleVoiceNote, useNowPlaying } from './voicePlayer';

/**
 * A voice note keeps playing outside its chat, with this bar on top of the
 * list (backlog 34, José 21/10; design `a-02-audio-en-curso`): who, how far,
 * the speed, pause and the X. Tapping it goes back to the chat.
 */
export function NowPlayingBar(props: { openChatId: string | null; onOpen: (chatId: string) => void }) {
  const colors = useColores();
  const now = useNowPlaying();
  if (!now || !showsNowPlayingBar(now, props.openChatId)) return null;
  const progress = nowPlayingProgress(now);
  return (
    <View testID="barra-audio-en-curso" className="border-b border-outline/10 bg-primary/[0.06]">
      <View className="min-h-[56px] flex-row items-center gap-3 px-4 py-2">
        <Pressable testID="barra-audio-abrir" onPress={() => props.onOpen(now.chatId)} className="min-w-0 flex-1 flex-row items-center gap-3">
          <Avatar nombre={now.authorName} foto={now.authorPhoto} tamano={32} />
          <View className="min-w-0 flex-1">
            <Text numberOfLines={1} className="text-[15px] font-semibold text-on-surface">{now.authorName}</Text>
            <Text numberOfLines={1} className="text-[12px] text-on-surface-variant">{nowPlayingLabel(now)}</Text>
          </View>
        </Pressable>
        <Pressable testID="barra-audio-velocidad" onPress={() => setVoiceNoteRate(nextPlaybackRate(now.rate))} className="min-h-[32px] justify-center rounded-full border border-outline/20 bg-surface px-2.5">
          <Text className="text-[12px] font-bold text-primary">{`${String(now.rate).replace('.', ',')}×`}</Text>
        </Pressable>
        <Pressable testID="barra-audio-pausa" accessibilityLabel={now.playing ? 'Pausar' : 'Reproducir'} onPress={toggleVoiceNote} className="h-10 w-10 items-center justify-center rounded-full bg-primary">
          {now.playing ? <Pause size={18} color={colors['on-primary']} fill={colors['on-primary']} /> : <Play size={18} color={colors['on-primary']} fill={colors['on-primary']} />}
        </Pressable>
        <Pressable testID="barra-audio-cerrar" accessibilityLabel="Cerrar" hitSlop={8} onPress={stopVoiceNote} className="h-9 w-9 items-center justify-center">
          <X size={20} color={colors['on-surface-variant']} />
        </Pressable>
      </View>
      <View className="h-[2px] bg-primary/15">
        <View className="h-full bg-primary" style={{ width: `${progress * 100}%` }} />
      </View>
    </View>
  );
}
