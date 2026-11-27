import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ban, FolderOpen, Mic, Music, Play, type LucideIcon } from 'lucide-react-native';
import { STICKER_SOUND_PRESETS } from '@lilachat/shared';
import { Sheet } from '../../ui/Sheet';
import { useColores } from '../../ui/tema';
import { reportarError } from '../../ui/reportarError';
import { VoiceClipRecorder } from './VoiceClipRecorder';
import { previewClip, previewPreset, stopSoundPreview } from './soundPreview';
import { pickedAudioRefusal, type AudioClip, type SoundChoice } from './videoStickerSound';

const ICON_BOX = 44;

/** One choice of the sheet: a card with its icon, its words and the radio (design ss-02). */
function SoundOption(props: { testID: string; Icon: LucideIcon; title: string; selected: boolean; onPress: () => void; detail?: ReactNode; children?: ReactNode }) {
  const colors = useColores();
  const { Icon } = props;
  return (
    <View className={`overflow-hidden rounded-2xl border-2 ${props.selected ? 'border-primary' : 'border-outline/15'}`}>
      <Pressable testID={props.testID} accessibilityRole="radio" accessibilityState={{ checked: props.selected }} onPress={props.onPress} className="min-h-[64px] flex-row items-center gap-3 px-3 py-2.5">
        <View className={`items-center justify-center rounded-xl ${props.selected ? 'bg-primary/15' : 'bg-background'}`} style={{ width: ICON_BOX, height: ICON_BOX }}>
          <Icon size={20} color={props.selected ? colors.primary : colors['on-surface-variant']} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[15px] font-semibold text-on-surface">{props.title}</Text>
          {props.detail}
        </View>
        <View className={`h-6 w-6 items-center justify-center rounded-full border-2 ${props.selected ? 'border-primary' : 'border-outline/40'}`}>
          {props.selected ? <View className="h-3 w-3 rounded-full bg-primary" /> : null}
        </View>
      </Pressable>
      {props.selected && props.children ? <View className="px-3 pb-3">{props.children}</View> : null}
    </View>
  );
}

/** «▶ 0:06»: listen to a sound without leaving the sheet. */
function ListenChip(props: { testID: string; label: string; onPress: () => void }) {
  const colors = useColores();
  return (
    <Pressable testID={props.testID} accessibilityLabel={`Escuchar ${props.label}`} onPress={props.onPress} hitSlop={12} className="mt-0.5 flex-row items-center gap-1.5 self-start">
      <View className="h-5 w-5 items-center justify-center rounded-full bg-primary"><Play size={10} color={colors['on-primary']} /></View>
      <Text numberOfLines={1} className="text-[13px] font-semibold text-primary">{props.label}</Text>
    </Pressable>
  );
}

/** «Sonidos de Lilachat»: our wink sounds; a tap chooses one and plays it. */
function PresetGrid(props: { choice: SoundChoice | null; onChoose: (choice: SoundChoice) => void }) {
  return (
    <View className="rounded-2xl border-2 border-outline/15 px-3 py-3">
      <Text className="pb-2 text-[15px] font-semibold text-on-surface">Sonidos de Lilachat</Text>
      <View className="flex-row flex-wrap gap-2">
        {STICKER_SOUND_PRESETS.map((preset) => {
          const selected = props.choice?.kind === 'preset' && props.choice.presetId === preset.id;
          return (
            <Pressable key={preset.id} testID={`sonido-preset-${preset.id}`} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => { props.onChoose({ kind: 'preset', presetId: preset.id }); previewPreset(preset.id); }} className={`min-h-[44px] items-center justify-center rounded-full border px-4 ${selected ? 'border-primary bg-primary/10' : 'border-outline/25'}`}>
              <Text className={`text-[14px] ${selected ? 'font-semibold text-primary' : 'text-on-surface'}`}>{preset.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** «Elegir un audio del teléfono»: an audio of 4 MB at most, copied where the upload can read it. */
async function pickPhoneAudio(): Promise<{ clip: AudioClip } | { refusal: string } | null> {
  try {
    const picked = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true, multiple: false });
    const asset = picked.canceled ? null : picked.assets[0];
    if (!asset) return null;
    const refusal = pickedAudioRefusal(asset);
    if (refusal) return { refusal };
    return { clip: { uri: asset.uri, name: asset.name, mime: asset.mimeType!, bytes: asset.size ?? 0 } };
  } catch (error) {
    reportarError('pickPhoneAudio', error);
    return { refusal: 'No se pudo abrir ese audio.' };
  }
}

/**
 * «Sonido del sticker» (José 26/11, design ss-02): the video's own sound (by
 * default), a voice recorded here, an audio of the phone, one of «Sonidos de
 * Lilachat», or none. A choice applies at once; «Listo» closes. A GIF has no
 * sound of its own: `offerOriginal` false hides that option (José 26/11).
 */
export function StickerSoundSheet(props: { visible: boolean; offerOriginal?: boolean; /** null: nothing chosen yet (a saved sticker, José 27/11). */ choice: SoundChoice | null; clipLength: string; onChoose: (choice: SoundChoice) => void; onPreviewOriginal: () => void; onClose: () => void; /** «Listo» says what it does: «Guardar sonido» on a saved sticker. */ doneLabel?: string; /** Its own «Listo» (a saved sticker saves there); the backdrop and back only close. */ onDone?: () => void; /** What it sounds like now, under the title. */ current?: string }) {
  const { choice, onChoose } = props;
  const [notice, setNotice] = useState('');
  /** A voice or an audio already made stays when another choice is tried and then this one again. */
  const [kept, setKept] = useState<{ voice: AudioClip | null; upload: AudioClip | null }>({ voice: null, upload: null });
  const voiceClip = choice?.kind === 'voice' ? choice.clip : kept.voice;
  const uploadClip = choice?.kind === 'upload' ? choice.clip : kept.upload;

  const choose = (next: SoundChoice) => {
    stopSoundPreview();
    setNotice('');
    onChoose(next);
  };
  const recorded = (clip: AudioClip) => {
    setKept((before) => ({ ...before, voice: clip }));
    onChoose({ kind: 'voice', clip });
  };
  const chooseUpload = async () => {
    choose({ kind: 'upload', clip: uploadClip });
    const picked = await pickPhoneAudio();
    if (!picked) return;
    if ('refusal' in picked) return setNotice(picked.refusal);
    setKept((before) => ({ ...before, upload: picked.clip }));
    onChoose({ kind: 'upload', clip: picked.clip });
  };
  const close = () => {
    stopSoundPreview();
    props.onClose();
  };

  return (
    <Sheet visible={props.visible} onClose={close} testID="hoja-sonido-sticker" dragArea="handle" maxHeight="88%" className="px-4">
      <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
        <View className="pb-1">
          <Text className="text-[20px] font-bold text-on-surface">Sonido del sticker</Text>
          <Text className="text-[14px] text-on-surface-variant">Se escucha cuando lo tocan. Hasta 6 segundos.</Text>
          {props.current ? <Text testID="sonido-actual-sticker" className="pt-1 text-[13px] font-semibold text-primary">{props.current}</Text> : null}
        </View>
        {props.offerOriginal === false ? null : (
          <SoundOption
            testID="sonido-original"
            Icon={Music}
            title="Sonido original del video"
            selected={choice?.kind === 'original'}
            onPress={() => choose({ kind: 'original' })}
            detail={<ListenChip testID="escuchar-sonido-original" label={props.clipLength} onPress={() => { choose({ kind: 'original' }); props.onPreviewOriginal(); }} />}
          />
        )}
        <SoundOption testID="sonido-grabar" Icon={Mic} title="Grabar tu voz" selected={choice?.kind === 'voice'} onPress={() => choose({ kind: 'voice', clip: voiceClip })}>
          <VoiceClipRecorder clip={voiceClip} onRecorded={recorded} />
        </SoundOption>
        <SoundOption
          testID="sonido-subir"
          Icon={FolderOpen}
          title="Elegir un audio del teléfono"
          selected={choice?.kind === 'upload'}
          onPress={() => void chooseUpload()}
          detail={uploadClip ? <ListenChip testID="escuchar-audio-sticker" label={uploadClip.name} onPress={() => previewClip(uploadClip.uri)} /> : <Text className="text-[13px] text-on-surface-variant">MP3, M4A u otro, hasta 4 MB</Text>}
        />
        <PresetGrid choice={choice} onChoose={choose} />
        <SoundOption testID="sin-sonido" Icon={Ban} title="Sin sonido" selected={choice?.kind === 'none'} onPress={() => choose({ kind: 'none' })} detail={<Text className="text-[13px] text-on-surface-variant">El sticker se mueve sin sonar</Text>} />
        {notice ? <Text testID="aviso-sonido-sticker" className="text-[13px] text-error">{notice}</Text> : null}
        <Pressable testID="listo-sonido-sticker" onPress={props.onDone ? () => { stopSoundPreview(); props.onDone?.(); } : close} className="mt-1 min-h-[48px] items-center justify-center rounded-full bg-primary">
          <Text className="text-[15px] font-semibold text-on-primary">{props.doneLabel ?? 'Listo'}</Text>
        </Pressable>
      </ScrollView>
    </Sheet>
  );
}
