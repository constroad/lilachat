import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Mic, Play, Square } from 'lucide-react-native';
import { VIDEO_STICKER_MAX_MS } from '@lilachat/shared';
import { useGrabadorDeVoz } from '../useGrabadorDeVoz';
import { useColores } from '../../ui/tema';
import { formatClipClock } from './videoStickerTrim';
import { stopSoundPreview, toggleClipPreview, useClipPreviewPlaying } from './soundPreview';
import type { AudioClip } from './videoStickerSound';

const RECORD_BUTTON = 56;
const VOICE_FILE_NAME = 'voz-del-sticker.m4a';

/**
 * «Grabar tu voz» (design ss-02): hold the mic, let go and it is ready; it
 * stops by itself at 6 seconds. Reuses the voice notes' recorder and its
 * microphone permission.
 */
export function VoiceClipRecorder(props: { clip: AudioClip | null; onRecorded: (clip: AudioClip) => void }) {
  const colors = useColores();
  const recorder = useGrabadorDeVoz();
  const held = useRef(false);
  /** A take in progress that has not been finished yet: the auto-stop and the release finish it only once. */
  const active = useRef(false);
  const [notice, setNotice] = useState('');
  const recording = recorder.estado.fase === 'grabando';
  const elapsedMs = recorder.estado.fase === 'grabando' ? recorder.estado.ms : 0;
  const { terminar } = recorder;
  const { onRecorded } = props;

  const finish = useCallback(async () => {
    if (!active.current) return;
    active.current = false;
    const note = await terminar();
    if (!note) return setNotice('Muy corto: mantén presionado mientras hablas.');
    setNotice('');
    onRecorded({ uri: note.uri, name: VOICE_FILE_NAME, mime: note.mime, bytes: note.bytes, ms: note.ms });
  }, [terminar, onRecorded]);

  // 6 seconds at most, like the clip: it stops by itself.
  useEffect(() => {
    if (recording && elapsedMs >= VIDEO_STICKER_MAX_MS) void finish();
  }, [recording, elapsedMs, finish]);

  const pressIn = async () => {
    held.current = true;
    active.current = true;
    stopSoundPreview();
    setNotice('');
    await recorder.empezar();
    // The permission dialog may have taken the finger: a release during it throws the take away.
    if (!held.current) await terminar({ cancelar: true });
  };
  const pressOut = () => {
    held.current = false;
    void finish();
  };

  if (recorder.estado.fase === 'sin-permiso') return <MicPermissionNotice />;

  const status = recording ? 'Grabando… suelta para terminar' : props.clip ? 'Tu voz está lista' : 'Mantén para grabar';
  const shownMs = recording ? elapsedMs : (props.clip?.ms ?? 0);
  return (
    <View className="flex-row items-center gap-3 rounded-2xl bg-background px-3 py-3">
      <Pressable
        testID="grabar-voz-sticker"
        accessibilityLabel="Mantén presionado para grabar tu voz"
        onPressIn={() => void pressIn()}
        onPressOut={pressOut}
        className={`items-center justify-center rounded-full ${recording ? 'bg-error' : 'bg-primary'}`}
        style={{ width: RECORD_BUTTON, height: RECORD_BUTTON }}
      >
        <Mic size={24} color={colors['on-primary']} />
      </Pressable>
      <View className="min-w-0 flex-1">
        <Text className="text-[14px] font-semibold text-on-surface">{status}</Text>
        <Text className="text-[13px] text-on-surface-variant" style={{ fontVariant: ['tabular-nums'] }}>{`${formatClipClock(shownMs)} / ${formatClipClock(VIDEO_STICKER_MAX_MS)}`}</Text>
        {recorder.estado.fase === 'error' ? <Text className="text-[12px] text-error">{recorder.estado.motivo}</Text> : null}
        {notice ? <Text testID="aviso-voz-sticker" className="text-[12px] text-error">{notice}</Text> : null}
      </View>
      {props.clip && !recording ? (
        <ListenVoiceButton uri={props.clip.uri} />
      ) : (
        <View className="rounded-full bg-primary/10 px-3 py-1.5">
          <Text className="text-[12px] font-semibold text-primary">Listo al soltar</Text>
        </View>
      )}
    </View>
  );
}

/**
 * «Escuchar» / «Detener» (José 27/11: «ni siquiera puedo saber si está haciendo play»): it says what a tap does, and
 * is filled with the accent while the voice sounds.
 */
function ListenVoiceButton(props: { uri: string }) {
  const colors = useColores();
  const playing = useClipPreviewPlaying(props.uri);
  const Icon = playing ? Square : Play;
  const tint = playing ? colors['on-primary'] : colors.primary;
  return (
    <Pressable
      testID="escuchar-voz-sticker"
      accessibilityRole="button"
      accessibilityLabel={playing ? 'Detener tu voz' : 'Escuchar tu voz'}
      accessibilityState={{ selected: playing }}
      onPress={() => toggleClipPreview(props.uri)}
      hitSlop={6}
      className={`h-11 flex-row items-center gap-1.5 rounded-full px-4 ${playing ? 'bg-primary' : 'bg-primary/10'}`}
    >
      <Icon size={16} color={tint} fill={playing ? tint : 'none'} />
      <Text className={`text-[14px] font-semibold ${playing ? 'text-on-primary' : 'text-primary'}`}>{playing ? 'Detener' : 'Escuchar'}</Text>
    </Pressable>
  );
}

/** The microphone was refused: say so, and offer the settings where it is allowed. */
function MicPermissionNotice() {
  return (
    <View testID="sticker-voz-sin-permiso" className="gap-2 rounded-2xl bg-background px-4 py-3">
      <Text className="text-[13px] text-on-surface">Permite el micrófono para grabar tu voz.</Text>
      <Pressable testID="abrir-ajustes-microfono" onPress={() => void Linking.openSettings()} className="min-h-[44px] items-center justify-center self-start rounded-full border border-primary/40 px-4">
        <Text className="text-[13px] font-semibold text-primary">Abrir ajustes</Text>
      </Pressable>
    </View>
  );
}
