import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Check, ChevronRight, CloudOff } from 'lucide-react-native';
import { progressLine, progressPercent, sectionsProgressOf, queueLine, type FieldDocument, type ReportSave, type ResultTone, type SectionResult, type SectionState, type StateBadge } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';
import { DETAIL_TONE } from '../tones';

/** A result's number in its tone (design j-02: «1.02 lt/m²» green when in range). */
const RESULT_TONE: Record<ResultTone, string> = { ok: 'text-en-linea', warn: 'text-warning', error: 'text-error', neutral: 'text-on-surface' };
const DOT_TONE: Record<SectionState, string> = { done: 'border-en-linea bg-en-linea/10', partial: 'border-warning bg-warning/10', error: 'border-error bg-error/10', empty: 'border-outline/30 bg-surface' };

export function Pill({ badge, testID }: { badge: StateBadge; testID?: string }) {
  return <Text testID={testID} className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${DETAIL_TONE[badge.tone]}`}>{badge.label}</Text>;
}

/** The circle at the left of a card: a check once done, a dot while partial, empty otherwise. */
export function StateDot({ state, small }: { state: SectionState; small?: boolean }) {
  const colors = useColores();
  const size = small ? 'h-5 w-5' : 'h-7 w-7';
  return (
    <View className={`${size} items-center justify-center rounded-full border-2 ${DOT_TONE[state]}`}>
      {state === 'done' ? <Check size={small ? 11 : 14} color={colors.primary} /> : null}
      {state === 'partial' || state === 'error' ? <View className={`${small ? 'h-1.5 w-1.5' : 'h-2.5 w-2.5'} rounded-full ${state === 'error' ? 'bg-error' : 'bg-warning'}`} /> : null}
    </View>
  );
}

/** What a section measured (the rate, the area), label over value, in a strip under the summary. */
export function ResultsStrip({ results, testID }: { results: readonly SectionResult[]; testID?: string }) {
  if (!results.length) return null;
  return (
    <View testID={testID} className="mt-3 flex-row flex-wrap gap-x-5 gap-y-2 rounded-xl border border-outline/10 bg-background px-3 py-2.5">
      {results.map((result) => (
        <View key={result.label} className="min-w-[96px]">
          <Text className="text-[10px] font-bold uppercase tracking-[1px] text-on-surface-variant">{result.label}</Text>
          <Text className={`mt-0.5 text-[16px] font-bold ${RESULT_TONE[result.tone]}`}>{result.value}</Text>
        </View>
      ))}
    </View>
  );
}

/** A section's card (design j-02): its state, its pill, what it says so far and what it measured; tapping opens it. */
export function SectionCard(props: { testID: string; title: string; badge: StateBadge; state: SectionState; summary: readonly string[]; results: readonly SectionResult[]; note?: string; onPress?: () => void; children?: ReactNode }) {
  const colors = useColores();
  return (
    <Pressable testID={props.testID} onPress={props.onPress} disabled={!props.onPress} className={`rounded-2xl border border-outline/15 bg-surface p-4 ${props.onPress ? '' : 'opacity-60'}`}>
      <View className="flex-row items-start gap-3">
        <StateDot state={props.state} />
        <View className="min-w-0 flex-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-[16px] font-bold text-on-surface">{props.title}</Text>
            <Pill badge={props.badge} />
          </View>
          {props.summary.length ? <Text className="mt-1 text-[14px] text-on-surface-variant">{props.summary.join(' · ')}</Text> : null}
          {props.note ? <Text className="mt-1 text-[13px] text-error">{props.note}</Text> : null}
          <ResultsStrip results={props.results} />
          {props.children}
        </View>
        {props.onPress ? <ChevronRight size={18} color={colors.primary} /> : null}
      </View>
    </Pressable>
  );
}

function RefusedSave({ save, onFix, onDiscard }: { save: ReportSave; onFix: () => void; onDiscard: () => void }) {
  return (
    <View testID={`rechazo-${save.clientKey}`} className="rounded-2xl border border-error/30 bg-surface p-3">
      <Text className="text-[14px] font-bold text-on-surface">{save.title}</Text>
      <Text className="mt-0.5 text-[13px] text-error">{save.refusal?.message}</Text>
      <View className="mt-2 flex-row gap-2">
        {save.photo ? null : (
          <Pressable testID={`corregir-${save.clientKey}`} onPress={onFix} className="min-h-[44px] flex-1 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
            <Text className="text-[14px] font-semibold text-primary">Corregir</Text>
          </Pressable>
        )}
        <Pressable testID={`descartar-${save.clientKey}`} onPress={onDiscard} className="min-h-[44px] flex-1 items-center justify-center rounded-xl border border-outline/20">
          <Text className="text-[14px] font-semibold text-on-surface">Descartar</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** What has not reached Portal: the line of what waits, and each thing it refused with what to do about it. */
export function QueueCard({ saves, offline, onFix, onDiscard }: { saves: readonly ReportSave[]; offline: boolean; onFix: (save: ReportSave) => void; onDiscard: (save: ReportSave) => void }) {
  const colors = useColores();
  const refused = saves.filter((one) => one.refusal);
  const waiting = saves.length - refused.length;
  if (!offline && saves.length === 0) return null;
  return (
    <View testID="cola-informe" className="gap-2">
      {waiting > 0 || offline ? (
        <View className="flex-row items-center gap-2 rounded-2xl border border-outline/15 bg-surface px-3 py-2.5">
          {offline ? <CloudOff size={16} color={colors.primary} /> : null}
          <Text testID="linea-cola" className="flex-1 text-[13px] font-semibold text-on-surface-variant">{queueLine(waiting, offline)}</Text>
        </View>
      ) : null}
      {refused.map((save) => <RefusedSave key={save.clientKey} save={save} onFix={() => onFix(save)} onDiscard={() => onDiscard(save)} />)}
    </View>
  );
}

/** «2 de 4 secciones listas» with its bar, on top of the hub. */
export function ProgressCard({ document }: { document: FieldDocument }) {
  const progress = sectionsProgressOf(document);
  const percent = progressPercent(progress);
  return (
    <View testID="progreso-informe" className="rounded-2xl border border-outline/15 bg-surface p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-[15px] font-bold text-on-surface">{progressLine(progress)}</Text>
        <Text className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">{`${percent}%`}</Text>
      </View>
      <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-background"><View className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} /></View>
    </View>
  );
}
