import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { PHOTO_PHASES, PHOTO_STRETCH_HINT, PHOTO_STRETCH_MAX, photoPhaseDraftOf, photoPhaseLabel, type PhotoMark, type PhotoPhase, type WorkProgressResult } from '@lilachat/shared';

export type PhotoPhaseSend = (phase: PhotoPhase | null, stretch: string) => Promise<WorkProgressResult>;

const WHITE = '#ffffff';
const BLACK = '#000000';

/**
 * «Antes / Después» under a Drive photo in the viewer (José 08/11, Portal 2ef27173): any member of
 * the channel marks it, with the stretch that pairs a «before» with its «after». The viewer is
 * always dark, so its colors are fixed and not the theme's.
 */
export function PhotoPhaseBar(props: { mark: PhotoMark | null; send: PhotoPhaseSend }) {
  const [draft, setDraft] = useState(() => photoPhaseDraftOf(props.mark));
  const { phase, stretch, busy, answer } = draft;
  const setPhase = (next: PhotoPhase | null) => setDraft((before) => ({ ...before, phase: next }));
  const setStretch = (next: string) => setDraft((before) => ({ ...before, stretch: next }));
  const save = async () => {
    setDraft((before) => ({ ...before, busy: true }));
    const result = await props.send(phase, stretch);
    setDraft((before) => ({ ...before, busy: false, answer: result }));
  };
  return (
    <View testID="foto-fase-barra" className="gap-2 px-4 pb-3">
      <Text testID="foto-fase" style={{ color: WHITE }} className="text-center text-[14px] font-semibold opacity-80">{photoPhaseLabel(props.mark)}</Text>
      <View accessibilityRole="radiogroup" className="flex-row gap-1 rounded-xl p-1" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
        {PHOTO_PHASES.map((one) => (
          <Pressable key={one.label} testID={`foto-fase-${one.phase ?? 'ninguna'}`} accessibilityRole="radio" accessibilityState={{ checked: phase === one.phase }} onPress={() => setPhase(one.phase)} className="h-11 flex-1 items-center justify-center rounded-lg" style={{ backgroundColor: phase === one.phase ? WHITE : 'transparent' }}>
            <Text style={{ color: phase === one.phase ? BLACK : WHITE }} className="text-[15px] font-semibold">{one.label}</Text>
          </Pressable>
        ))}
      </View>
      {phase ? <TextInput testID="foto-fase-tramo" value={stretch} maxLength={PHOTO_STRETCH_MAX} onChangeText={setStretch} placeholder={PHOTO_STRETCH_HINT} placeholderTextColor="rgba(255,255,255,0.5)" style={{ color: WHITE, borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'rgba(255,255,255,0.12)' }} className="h-12 rounded-xl border px-3 text-[15px]" /> : null}
      <Pressable testID="foto-fase-guardar" disabled={busy} onPress={() => void save()} className={`h-12 items-center justify-center rounded-xl ${busy ? 'opacity-60' : ''}`} style={{ backgroundColor: WHITE }}>
        <Text style={{ color: BLACK }} className="text-[15px] font-semibold">{busy ? 'Guardando…' : 'Guardar marca'}</Text>
      </Pressable>
      {answer ? <Text accessibilityRole="alert" style={{ color: answer.ok ? WHITE : '#fca5a5' }} className="text-center text-[14px]">{answer.message}</Text> : null}
    </View>
  );
}
