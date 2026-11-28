import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { CircleCheck, MousePointerClick, Ruler, X } from 'lucide-react-native';
import { AVANCE_CURRENT, avanceCurrentPercent, AVANCE_MANUAL_HINT, AVANCE_MANUAL_LABEL, AVANCE_MANUAL_ONE, manualRangeSummary, type ManualRange, AVANCE_FOOTER, AVANCE_PERCENTS, avanceEndFor, avanceKicker, avanceProgressLine, metersLabel, runAvanceSave, stationLabel, type AvanceEntryIds, type ByApproveProgress, type AvancePercent, type AvanceTarget, type MapEditSend, type WorkMap } from '@lilachat/shared';
import { DecimalInput } from '../../../ui/DecimalInput';
import { useColores } from '../../../ui/tema';
import { KICKER } from './WorkMapPanel';
import { UndoProgress } from './PendingProgress';
import type { ManualMarks } from './AvanceMode';

const FIELD = 'mt-2 h-12 rounded-xl border border-outline/25 bg-background px-3 font-mono text-[15px] text-on-surface';
const newIds = (): AvanceEntryIds => ({ scope: randomUUID(), progress: randomUUID() });
type Answer = { ok: boolean; message: string } | null;

/** The five big buttons (design av-01): each one the street's share where the work arrives. */
function PercentButtons(props: { picked: AvancePercent | null; /** Where the street stands now (José 28/11). */ current: AvancePercent | null; onPick: (percent: AvancePercent) => void }) {
  return (
    <View className="flex-row gap-2">
      {AVANCE_PERCENTS.map((percent) => {
        const on = props.picked === percent;
        const now = !on && props.current === percent;
        return (
          <Pressable key={percent} testID={`avance-pct-${percent}`} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityHint={now ? AVANCE_CURRENT : undefined} onPress={() => props.onPick(percent)} className={`h-16 flex-1 items-center justify-center rounded-2xl ${on ? 'bg-primary' : now ? 'border-2 border-primary bg-primary/10' : 'bg-surface-variant'}`}>
            <Text className={`text-[17px] font-bold ${on ? 'text-on-primary' : now ? 'text-primary' : 'text-on-surface'}`}>{percent} %</Text>
            {now ? <Text testID="avance-pct-actual" className="text-[11px] font-semibold text-primary">{AVANCE_CURRENT}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** «Hasta una progresiva exacta»: the end typed in metres instead of a percent. */
function ExactEnd(props: { open: boolean; endM: number | null; typed: number | null; onOpen: () => void; onTyped: (meters: number | null) => void }) {
  const colors = useColores();
  return (
    <View>
      <Pressable testID="avance-progresiva" onPress={props.onOpen} className="h-12 flex-row items-center justify-center gap-2">
        <Ruler size={18} color={colors.primary} />
        <Text className="font-mono text-[14px] text-primary">Hasta una progresiva exacta · {stationLabel(props.endM ?? 0)}</Text>
      </Pressable>
      {props.open ? <DecimalInput testID="avance-progresiva-m" autoFocus value={props.typed} onValue={props.onTyped} placeholder="Hasta (m)" className={FIELD} /> : null}
    </View>
  );
}

/** The street's head: kicker, name, length and what is already done. */
function StreetHead(props: { target: AvanceTarget }) {
  const progress = avanceProgressLine(props.target);
  return (
    <View className="gap-1">
      <Text className={`${KICKER} font-mono`}>{avanceKicker(props.target)}</Text>
      <View className="flex-row items-baseline justify-between gap-3">
        <Text numberOfLines={1} className="flex-1 text-[22px] font-bold text-on-surface">{props.target.streetName}</Text>
        <Text className="font-mono text-[16px] text-on-surface">{metersLabel(props.target.lengthM)}</Text>
      </View>
      <View className="mt-2 h-2.5 overflow-hidden rounded-full bg-outline/15"><View className="h-full rounded-full bg-primary" style={{ width: `${progress.percent}%` }} /></View>
      <View className="flex-row justify-between">
        <Text className="font-mono text-[13px] text-on-surface-variant">{progress.line}</Text>
        <Text className="font-mono text-[13px] font-bold text-primary">{progress.percent} % completado</Text>
      </View>
      {props.target.pendingM !== null ? <Text testID="avance-por-aprobar" className="font-mono text-[13px] text-on-surface-variant">Por aprobar hasta {stationLabel(props.target.pendingM)}</Text> : null}
    </View>
  );
}

/** The ends the person chose, the stable ids of this save and Portal's answer. */
function useAvanceSave(map: WorkMap, target: AvanceTarget, send: MapEditSend, range: ManualRange | null) {
  const [picked, setPicked] = useState<AvancePercent | null>(null);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState<number | null>(null);
  const [ids, setIds] = useState(newIds);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<Answer>(null);
  const endM = typing ? typed : picked === null ? null : avanceEndFor(target, picked);
  const save = async () => {
    setBusy(true);
    const result = await runAvanceSave({ map, target, toM: endM, range, ids, now: new Date(), send });
    setBusy(false);
    setAnswer(result);
    if (result.ok) setIds(newIds());
  };
  const pick = (percent: AvancePercent) => { setAnswer(null); setTyping(false); setPicked(percent); };
  const type = (meters: number | null) => { setAnswer(null); setTyped(meters); };
  return { picked, typing, typed, endM, busy, answer, save, pick, type, openTyping: () => { setAnswer(null); setTyping((open) => !open); } };
}

/** «Marcar a mano» (José 28/11): the stretch marked with two taps, or what to tap next. */
function ManualRow(props: { manual: ManualMarks }) {
  const colors = useColores();
  const { manual } = props;
  return (
    <View className="gap-1">
      <Pressable testID="avance-a-mano" accessibilityRole="button" accessibilityState={{ selected: manual.on }} onPress={manual.toggle} className={`h-11 flex-row items-center justify-center gap-2 rounded-xl border ${manual.on ? 'border-primary bg-primary/10' : 'border-outline/25'}`}>
        <MousePointerClick size={18} color={colors.primary} />
        <Text className="text-[14px] font-semibold text-primary">{AVANCE_MANUAL_LABEL}</Text>
      </Pressable>
      {manual.on ? <Text testID="avance-a-mano-tramo" className="text-center font-mono text-[14px] text-on-surface">{manual.range ? manualRangeSummary(manual.range) : manual.marks.length ? AVANCE_MANUAL_ONE : AVANCE_MANUAL_HINT}</Text> : null}
    </View>
  );
}

/** The bottom panel of «Modo Avance» (design av-01): street, bar, five buttons, the exact end, «Marcar a mano» and «Guardar avance». */
export function AvancePanel(props: { map: WorkMap; target: AvanceTarget; send: MapEditSend; undoable: ByApproveProgress | null; onUndo: (id: string) => Promise<string | null>; bottom: number; manual: ManualMarks; onClose: () => void }) {
  const colors = useColores();
  const save = useAvanceSave(props.map, props.target, props.send, props.manual.range);
  const manualOn = props.manual.on;
  return (
    <View testID="avance-panel" className="absolute inset-x-0 bottom-0 gap-4 rounded-t-3xl bg-surface px-4 pt-5" style={{ paddingBottom: props.bottom + 12, elevation: 12 }}>
      <Pressable accessibilityLabel="Cerrar el panel" onPress={props.onClose} className="absolute right-2 top-1 z-10 h-11 w-11 items-center justify-center rounded-full"><X size={20} color={colors['on-surface-variant']} /></Pressable>
      <StreetHead target={props.target} />
      {manualOn ? null : <PercentButtons picked={save.typing ? null : save.picked} current={avanceCurrentPercent(props.target)} onPick={save.pick} />}
      {manualOn ? null : <ExactEnd open={save.typing} endM={save.endM} typed={save.typed} onOpen={save.openTyping} onTyped={save.type} />}
      <ManualRow manual={props.manual} />
      {save.answer ? <Text testID="avance-respuesta-modo" accessibilityRole="alert" className={`text-[14px] font-semibold ${save.answer.ok ? 'text-primary' : 'text-error'}`}>{save.answer.message}</Text> : null}
      {props.undoable && props.undoable.toM !== null ? <UndoProgress id={props.undoable.id} toM={props.undoable.toM} onUndo={props.onUndo} /> : null}
      <Pressable testID="avance-guardar" disabled={save.busy} onPress={() => void save.save()} className={`h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-primary ${save.busy ? 'opacity-60' : ''}`}>
        <CircleCheck size={22} color={colors['on-primary']} />
        <Text className="text-[17px] font-bold text-on-primary">{save.busy ? 'Guardando…' : 'Guardar avance'}</Text>
      </Pressable>
      <Text className="text-center text-[13px] text-on-surface-variant">{AVANCE_FOOTER}</Text>
    </View>
  );
}
