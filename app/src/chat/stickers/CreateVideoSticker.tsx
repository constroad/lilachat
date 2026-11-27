import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, ToastAndroid, useWindowDimensions, View } from 'react-native';
import { VideoView, type VideoPlayer } from 'expo-video';
import { Image } from 'expo-image';
import { ArrowLeft, AudioLines, Ban, Mic, Music, Pause, Play, Save, Send, Volume2 } from 'lucide-react-native';
import type { LibrarySticker } from '@lilachat/shared';
import { Modal } from '../../ui/Modal';
import { useMargenes } from '../../ui/useMargenes';
import { useColores } from '../../ui/tema';
import { StickerSoundSheet } from './StickerSoundSheet';
import type { StickerVoiceDoor } from './stickerVoiceDoor';
import { VideoTrimStrip } from './VideoTrimStrip';
import { useClipPreview } from './useClipPreview';
import { previewClip, previewPreset, stopSoundPreview } from './soundPreview';
import { formatClipClock, initialTrim, trimSummary, type TrimWindow } from './videoStickerTrim';
import { audioClipOf, savedVideoStickerNotice, soundSummary, videoStickerBlocker, videoStickerUploadOf, type PickedVideo, type SoundChoice } from './videoStickerSound';
import { initialSoundOf, initialTrimOf, isGifClip } from './stickerSource';
import type { ApiOutcome, VideoStickerUpload } from './stickersApi';

type Phase = { kind: 'editing' } | { kind: 'uploading'; ratio: number } | { kind: 'converting' };
const PERCENT = 100;
/** The preview never takes more than this share of the screen's height: the trim and the buttons fit under it. */
const PREVIEW_HEIGHT_SHARE = 0.36;
const SIDE_ROOM = 64;

type Props = {
  visible: boolean;
  video: PickedVideo & { durationMs?: number };
  onClose: () => void;
  onSave: (upload: VideoStickerUpload, onProgress: (ratio: number) => void) => Promise<ApiOutcome<LibrarySticker>>;
  onSend: (sticker: LibrarySticker) => Promise<boolean>;
  /** «Voz» for an admin of the open space (José 27/11). */
  voiceDoor?: StickerVoiceDoor | null;
};

/**
 * «Crear sticker» from a video (José 26/11, design ss-01), like WhatsApp's
 * stickers with sound: up to 6 seconds of a gallery video, a live preview of
 * that window, and the sound chosen in its sheet (ss-02). Saved in «Mis
 * stickers», or saved and sent to this chat. A GIF (José 26/11) has no trim
 * strip and no sound of its own: it goes whole, from its start, and expo-image
 * plays it (expo-video cannot).
 */
export function CreateVideoSticker(props: Props) {
  const margins = useMargenes();
  const { width, height } = useWindowDimensions();
  const gif = isGifClip(props.video);
  const [trimState, setTrim] = useState<TrimWindow | null>(() => initialTrimOf(props.video));
  const [choice, setChoice] = useState<SoundChoice>(() => initialSoundOf(props.video.mime));
  const [soundOpen, setSoundOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: 'editing' });
  const [notice, setNotice] = useState('');
  const preview = useClipPreview(gif ? null : props.video.uri, trimState);
  const videoMs = props.video.durationMs || preview.loadedMs;
  const trim = trimState;
  // The picker may not say how long the video is: the player does once it loads.
  useEffect(() => {
    if (trimState || !preview.loadedMs) return;
    const first = initialTrim(preview.loadedMs);
    if (first) setTrim(first);
    else setNotice('Ese video es muy corto: elige uno de medio segundo o más.');
  }, [trimState, preview.loadedMs]);
  const busy = phase.kind !== 'editing';
  const side = Math.min(width - SIDE_ROOM, height * PREVIEW_HEIGHT_SHARE);

  const leave = () => {
    stopSoundPreview();
    preview.pause();
    props.onClose();
  };
  // Android's back never throws the work away by itself (José 26/11).
  const askToLeave = () => {
    if (busy) return ToastAndroid.show('Espera: se está guardando el sticker.', ToastAndroid.SHORT);
    Alert.alert('¿Descartar el sticker?', 'Se pierden el tramo y el sonido que elegiste.', [
      { text: 'Seguir editando', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: leave },
    ]);
  };

  const finish = async (send: boolean) => {
    if (!trim || busy) return;
    const blocker = videoStickerBlocker({ video: props.video, trim, choice });
    const upload = videoStickerUploadOf({ video: props.video, trim, choice });
    if (blocker || !upload) return setNotice(blocker ?? 'Elige el sonido del sticker.');
    setNotice('');
    stopSoundPreview();
    preview.quiet();
    setPhase({ kind: 'uploading', ratio: 0 });
    const made = await props.onSave(upload, (ratio) => setPhase(ratio >= 1 ? { kind: 'converting' } : { kind: 'uploading', ratio }));
    if (!made.ok) {
      setPhase({ kind: 'editing' });
      return setNotice(made.reason);
    }
    const sent = send ? await props.onSend(made.data) : true;
    ToastAndroid.show(sent ? savedVideoStickerNotice(choice, made.data) : 'Se guardó en Mis stickers, pero no se pudo mandar.', ToastAndroid.LONG);
    leave();
  };

  const listen = () => (choice.kind === 'original' ? (preview.listening ? preview.quiet() : preview.listen()) : listenToChoice(choice));

  return (
    <Modal visible={props.visible} animationType="slide" onRequestClose={askToLeave} statusBarTranslucent>
      <View testID="crear-sticker-video" className="flex-1 bg-background" style={{ paddingTop: margins.cabecera, paddingBottom: margins.pie }}>
        <Header onBack={askToLeave} onSound={() => setSoundOpen(true)} disabled={busy} />
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          <ClipPreview side={side} gifUri={gif ? props.video.uri : null} player={preview.player} />
          <SoundRow choice={choice} clipLength={formatClipClock(trim ? trim.endMs - trim.startMs : 0)} listening={choice.kind === 'original' && preview.listening} onOpen={() => setSoundOpen(true)} onListen={listen} disabled={busy} />
          {gif ? <GifWindowNote /> : <TrimCard videoMs={videoMs} trim={trim} frames={preview.frames} onChange={setTrim} onCommit={(next) => { setTrim(next); preview.restart(next); }} />}
          {notice ? <Text testID="aviso-sticker-video" className="rounded-xl bg-error/10 px-3 py-2 text-[13px] text-error">{notice}</Text> : null}
        </ScrollView>
        <Footer phase={phase} source={gif ? 'el GIF' : 'el video'} ready={Boolean(trim)} onSave={() => void finish(false)} onSend={() => void finish(true)} />
      </View>
      <StickerSoundSheet visible={soundOpen} offerOriginal={!gif} choice={choice} clipLength={formatClipClock(trim ? trim.endMs - trim.startMs : 0)} onChoose={(next) => { setNotice(''); setChoice(next); }} onPreviewOriginal={preview.listen} onClose={() => setSoundOpen(false)} voiceDoor={props.voiceDoor} />
    </Modal>
  );
}

/** The sticker moving in a loop: the video's window, or the whole GIF (animated by expo-image). */
function ClipPreview(props: { side: number; gifUri: string | null; player: VideoPlayer }) {
  const box = { width: props.side, height: props.side };
  return (
    <View className="items-center self-center overflow-hidden rounded-3xl border border-outline/15 bg-surface-variant/40" style={box}>
      {props.gifUri ? (
        <Image testID="vista-sticker-gif" source={{ uri: props.gifUri }} style={box} contentFit="contain" autoplay />
      ) : (
        <VideoView testID="vista-sticker-video" player={props.player} style={box} contentFit="contain" nativeControls={false} />
      )}
    </View>
  );
}

/** A GIF has no trim strip: it goes whole from its start, up to 6 seconds. */
function GifWindowNote() {
  return (
    <View testID="sticker-gif-entero" className="gap-1 rounded-2xl border border-outline/15 bg-surface px-3 py-3">
      <Text className="text-[12px] font-bold uppercase tracking-wider text-primary">GIF completo</Text>
      <Text className="text-[13px] text-on-surface-variant">Se usa desde el inicio, hasta 6 segundos. Un GIF no trae sonido: elige uno si quieres.</Text>
    </View>
  );
}

/** The sound row's play for a voice, an audio or one of ours (the video's own plays in the preview). */
function listenToChoice(choice: SoundChoice): void {
  const clip = audioClipOf(choice);
  if (clip) previewClip(clip.uri);
  if (choice.kind === 'preset') previewPreset(choice.presetId);
}

function Header(props: { onBack: () => void; onSound: () => void; disabled: boolean }) {
  const colors = useColores();
  return (
    <View className="flex-row items-center gap-2 border-b border-outline/10 px-2 pb-2">
      <Pressable testID="cerrar-sticker-video" accessibilityLabel="Volver" onPress={props.onBack} className="h-11 w-11 items-center justify-center">
        <ArrowLeft size={22} color={colors['on-surface']} />
      </Pressable>
      <View className="min-w-0 flex-1">
        <Text className="text-[11px] font-bold uppercase tracking-wider text-primary">Sticker en movimiento</Text>
        <Text className="text-[19px] font-bold text-on-surface">Crear sticker</Text>
      </View>
      <Pressable testID="abrir-sonido-sticker" disabled={props.disabled} onPress={props.onSound} className="min-h-[44px] flex-row items-center gap-1.5 rounded-full border border-outline/20 bg-surface px-4">
        <Music size={16} color={colors.primary} />
        <Text className="text-[14px] font-semibold text-primary">Sonido</Text>
      </Pressable>
    </View>
  );
}

const SOUND_ICONS = { original: Volume2, voice: Mic, upload: Music, preset: Music, none: Ban, spoken: AudioLines } as const;

/** What the sticker will sound like (design ss-01): a tap opens the sheet, the round button listens. */
function SoundRow(props: { choice: SoundChoice; clipLength: string; listening: boolean; onOpen: () => void; onListen: () => void; disabled: boolean }) {
  const colors = useColores();
  const summary = soundSummary(props.choice);
  const Icon = SOUND_ICONS[props.choice.kind];
  const canListen = props.choice.kind === 'original' || props.choice.kind === 'preset' || audioClipOf(props.choice) !== null;
  return (
    <Pressable testID="fila-sonido-sticker" disabled={props.disabled} onPress={props.onOpen} className="min-h-[64px] flex-row items-center gap-3 rounded-2xl border border-outline/15 bg-surface px-3 py-2.5">
      <View className="h-11 w-11 items-center justify-center rounded-xl bg-primary/10"><Icon size={20} color={colors.primary} /></View>
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-[15px] font-semibold text-on-surface">{summary.title}</Text>
          {props.choice.kind === 'original' ? <Text className="rounded-md border border-outline/20 px-1.5 text-[12px] text-on-surface-variant">{props.clipLength}</Text> : null}
        </View>
        <Text numberOfLines={1} className="text-[13px] text-on-surface-variant">{summary.detail}</Text>
      </View>
      {canListen ? (
        <Pressable testID="escuchar-sonido-sticker" accessibilityLabel={props.listening ? 'Detener' : 'Escuchar el sonido'} disabled={props.disabled} onPress={props.onListen} className="h-11 w-11 items-center justify-center rounded-full bg-primary">
          {props.listening ? <Pause size={18} color={colors['on-primary']} /> : <Play size={18} color={colors['on-primary']} />}
        </Pressable>
      ) : null}
    </Pressable>
  );
}

/** «Recorte del video» (design ss-01): the strip, how long and from where to where. */
function TrimCard(props: { videoMs: number; trim: TrimWindow | null; frames: Parameters<typeof VideoTrimStrip>[0]['frames']; onChange: (trim: TrimWindow) => void; onCommit: (trim: TrimWindow) => void }) {
  const colors = useColores();
  const summary = props.trim ? trimSummary(props.trim) : null;
  return (
    <View className="gap-3 rounded-2xl border border-outline/15 bg-surface px-3 py-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-[12px] font-bold uppercase tracking-wider text-primary">Recorte del video</Text>
        {summary ? <Text testID="sticker-video-duracion" className="rounded-lg bg-primary/10 px-2 py-0.5 text-[12px] font-semibold text-primary">{summary.length}</Text> : null}
      </View>
      {props.trim && summary ? (
        <>
          <VideoTrimStrip videoMs={props.videoMs} trim={props.trim} frames={props.frames} onChange={props.onChange} onCommit={props.onCommit} />
          <View className="flex-row items-center justify-between">
            <Text className="text-[13px] text-on-surface-variant">Elige hasta 6 segundos</Text>
            <Text testID="sticker-video-rango" className="text-[13px] font-semibold text-on-surface" style={{ fontVariant: ['tabular-nums'] }}>{summary.range}</Text>
          </View>
        </>
      ) : (
        <View className="h-14 items-center justify-center"><ActivityIndicator color={colors.primary} /></View>
      )}
    </View>
  );
}

/** Save, or save and send; while it uploads and converts, how far it is and nothing else to press. */
function Footer(props: { phase: Phase; source: string; ready: boolean; onSave: () => void; onSend: () => void }) {
  const colors = useColores();
  const busy = props.phase.kind !== 'editing';
  const progress = props.phase.kind === 'uploading' ? `Subiendo ${props.source}… ${Math.round(props.phase.ratio * PERCENT)} %` : props.phase.kind === 'converting' ? 'Convirtiendo en sticker…' : null;
  return (
    <View className="gap-2 border-t border-outline/10 px-4 pt-3">
      {progress ? (
        <View testID="progreso-sticker-video" className="flex-row items-center justify-center gap-2">
          <ActivityIndicator size="small" color={colors.primary} />
          <Text className="text-[13px] text-on-surface-variant">{progress}</Text>
        </View>
      ) : null}
      <View className="flex-row gap-3">
        <Pressable testID="guardar-sticker-video" disabled={busy || !props.ready} onPress={props.onSave} className={`min-h-[52px] flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-outline/20 bg-surface ${busy || !props.ready ? 'opacity-50' : ''}`}>
          <Save size={18} color={colors.primary} />
          <Text className="text-[15px] font-semibold text-on-surface">Guardar en Mis stickers</Text>
        </Pressable>
        <Pressable testID="enviar-sticker-video" accessibilityLabel="Guardar y enviar el sticker" disabled={busy || !props.ready} onPress={props.onSend} className={`min-h-[52px] flex-row items-center justify-center gap-2 rounded-2xl bg-primary px-5 ${busy || !props.ready ? 'opacity-50' : ''}`}>
          {busy ? <ActivityIndicator color={colors['on-primary']} /> : <Text className="text-[16px] font-bold text-on-primary">Enviar</Text>}
          {busy ? null : <Send size={18} color={colors['on-primary']} />}
        </Pressable>
      </View>
    </View>
  );
}
