import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { Check, FileUp } from 'lucide-react-native';
import { confirmImport, importCreateLabel, importDoneLabel, reviewImport, type ImportReview, type MapEditSend, type TraceUpload } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';
import { pickTraceFile, type TraceFile } from '../useDriveUpload';

type Step = { kind: 'idle' } | { kind: 'busy'; label: string } | { kind: 'review'; mediaId: string; review: ImportReview } | { kind: 'done'; message: string } | { kind: 'failed'; message: string };

function Review(props: { review: ImportReview }) {
  return (
    <View className="gap-2">
      <View testID="importar-lineas" className="rounded-lg border border-outline/15">
        {props.review.lines.map((line, index) => (
          <View key={`${line.name}-${index}`} className={`flex-row justify-between gap-2 px-3 py-2.5 ${index ? 'border-t border-outline/15' : ''}`}>
            <Text numberOfLines={1} className="flex-1 text-[14px] text-on-surface">{line.name}</Text>
            <Text className="font-mono text-[14px] text-on-surface-variant">{line.length}</Text>
          </View>
        ))}
      </View>
      {props.review.skipped.length ? <Text className="text-[13px] text-on-surface-variant">Se dejan fuera: {props.review.skipped.map((one) => `${one.name} (${one.reason})`).join(' · ')}</Text> : null}
    </View>
  );
}

/** «Traer un trazado» on the phone (design o-12): the file goes to the Drive, Portal says what it read, the person confirms. */
export function ImportTrace(props: { send: MapEditSend; upload: TraceUpload<TraceFile> }) {
  const colors = useColores();
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const [entryId] = useState(() => randomUUID());
  const pick = async () => {
    const file = await pickTraceFile();
    if (!file) return;
    setStep({ kind: 'busy', label: 'Subiendo…' });
    const uploaded = await props.upload(file);
    if (!uploaded.ok) return setStep({ kind: 'failed', message: uploaded.message });
    setStep({ kind: 'busy', label: 'Leyendo…' });
    const read = await reviewImport(props.send, uploaded.mediaId);
    setStep(read.ok ? { kind: 'review', mediaId: uploaded.mediaId, review: read.review } : { kind: 'failed', message: read.message });
  };
  const confirm = async (mediaId: string) => {
    setStep({ kind: 'busy', label: 'Creando…' });
    const made = await confirmImport(props.send, mediaId, entryId);
    setStep(made.ok ? { kind: 'done', message: importDoneLabel(made.review.lines.length) } : { kind: 'failed', message: made.message });
  };
  return (
    <View testID="importar-trazado" className="gap-3 rounded-2xl border border-dashed border-outline/30 bg-surface p-4">
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1 flex-row items-center gap-2"><FileUp size={18} color={colors.primary} /><Text className="text-[16px] font-semibold text-on-surface">Importar KMZ o KML</Text></View>
        <Pressable testID="importar-elegir" disabled={step.kind === 'busy'} onPress={() => void pick()} className={`h-11 justify-center rounded-xl bg-primary/10 px-3 ${step.kind === 'busy' ? 'opacity-60' : ''}`}>
          <Text className="text-[14px] font-semibold text-primary">{step.kind === 'busy' ? step.label : 'Elegir archivo'}</Text>
        </Pressable>
      </View>
      <Text className="text-[13px] text-on-surface-variant">Las líneas entran como calles; revisa el nombre y el largo.</Text>
      {step.kind === 'review' ? (
        <>
          <Review review={step.review} />
          <View className="flex-row gap-2">
            <Pressable onPress={() => setStep({ kind: 'idle' })} className="h-12 flex-1 items-center justify-center rounded-xl border border-outline/20"><Text className="text-[15px] font-semibold text-on-surface">Cancelar</Text></Pressable>
            <Pressable testID="importar-crear" onPress={() => void confirm(step.mediaId)} className="h-12 flex-[2] items-center justify-center rounded-xl bg-primary"><Text className="text-[15px] font-semibold text-on-primary">{importCreateLabel(step.review.lines.length)}</Text></Pressable>
          </View>
        </>
      ) : null}
      {step.kind === 'done' ? <View className="flex-row items-center gap-1.5"><Check size={16} color={colors.primary} /><Text testID="importar-listo" className="text-[14px] font-semibold text-on-surface">{step.message}</Text></View> : null}
      {step.kind === 'failed' ? <Text testID="importar-error" accessibilityRole="alert" className="text-[14px] font-semibold text-error">{step.message}</Text> : null}
    </View>
  );
}
