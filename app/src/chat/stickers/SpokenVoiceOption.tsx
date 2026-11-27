import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { AudioLines, Play } from 'lucide-react-native';
import { MAX_VOICE_TEXT, STICKER_VOICES, voiceTextOf, type StickerVoiceId } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { SoundOption } from './SoundOptionCard';
import { previewClip } from './soundPreview';
import type { SpokenChoice } from './spokenVoice';
import type { StickerVoiceDoor } from './stickerVoiceDoor';
import type { SoundChoice } from './videoStickerSound';

const VOICE_ROW = 56;

type Props = { choice: SoundChoice | null; door: StickerVoiceDoor; onChoose: (choice: SoundChoice) => void; onNotice: (message: string) => void };

/**
 * «Voz» (José 27/11, design sv-01): a phrase said by Valeria or Daniel, latino neutro, only for an admin of the space
 * (Voice Studio is one machine). «Escuchar» asks for it first; when it is not available it says so and can be retried.
 */
export function SpokenVoiceOption({ choice, door, onChoose, onNotice }: Props) {
  const colors = useColores();
  const [listening, setListening] = useState(false);
  const spoken: SpokenChoice | null = choice?.kind === 'spoken' ? choice : null;
  const choose = (change: Partial<Pick<SpokenChoice, 'voiceId' | 'text'>>) =>
    onChoose({ kind: 'spoken', voiceId: change.voiceId ?? spoken?.voiceId ?? 'valeria', text: change.text ?? spoken?.text ?? '', spaceId: door.spaceId });
  const ready = spoken ? voiceTextOf(spoken.text) : null;
  const listen = async () => {
    if (!spoken || !ready || listening) return;
    setListening(true);
    const heard = await door.listen(spoken.voiceId, ready);
    setListening(false);
    if (heard.ok) previewClip(heard.uri);
    else onNotice(heard.reason);
  };
  return (
    <SoundOption testID="sonido-voz" Icon={AudioLines} title="Voz" badge="Solo admins" selected={Boolean(spoken)} onPress={() => choose({})} detail={<Text className="text-[13px] text-on-surface-variant">Una frase dicha por Valeria o Daniel</Text>}>
      {spoken ? (
        <View className="gap-3">
          <View className="flex-row justify-between">
            <Text className="text-[12px] font-bold uppercase text-on-surface-variant">Escribe la frase</Text>
            <Text testID="voz-contador" className="text-[12px] text-on-surface-variant">{spoken.text.length}/{MAX_VOICE_TEXT}</Text>
          </View>
          <TextInput testID="voz-frase" value={spoken.text} onChangeText={(text) => choose({ text })} maxLength={MAX_VOICE_TEXT} multiline placeholder="¡Buen trabajo, cuadrilla!" placeholderTextColor={colors['on-surface-variant']} className="min-h-[64px] rounded-xl border border-outline/30 px-3 py-2 text-[15px] text-on-surface" style={{ textAlignVertical: 'top' }} />
          <View accessibilityRole="radiogroup" className="flex-row gap-2">
            {STICKER_VOICES.map((voice) => (
              <VoiceCard key={voice.id} id={voice.id} label={voice.label} detail={voice.detail} selected={spoken.voiceId === voice.id} onPress={() => choose({ voiceId: voice.id })} />
            ))}
          </View>
          <Pressable testID="voz-escuchar" accessibilityRole="button" disabled={!ready || listening} onPress={() => void listen()} className={`min-h-[48px] flex-row items-center justify-center gap-2 rounded-full border border-primary/50 ${!ready || listening ? 'opacity-50' : ''}`}>
            <Play size={14} color={colors.primary} />
            <Text className="text-[14px] font-semibold text-primary">{listening ? 'Preparando la voz…' : 'Escuchar'}</Text>
          </Pressable>
        </View>
      ) : null}
    </SoundOption>
  );
}

function VoiceCard(props: { id: StickerVoiceId; label: string; detail: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable testID={`voz-${props.id}`} accessibilityRole="radio" accessibilityState={{ checked: props.selected }} onPress={props.onPress} className={`flex-1 flex-row items-center gap-2 rounded-2xl border-2 px-2 ${props.selected ? 'border-primary bg-primary/10' : 'border-outline/20'}`} style={{ minHeight: VOICE_ROW }}>
      <View className={`h-8 w-8 items-center justify-center rounded-full ${props.selected ? 'bg-primary' : 'bg-primary/10'}`}>
        <Text className={`text-[13px] font-bold ${props.selected ? 'text-on-primary' : 'text-primary'}`}>{props.label[0]}</Text>
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[14px] font-semibold text-on-surface">{props.label}</Text>
        <Text numberOfLines={1} className="text-[11px] text-on-surface-variant">{props.detail}</Text>
      </View>
    </Pressable>
  );
}
