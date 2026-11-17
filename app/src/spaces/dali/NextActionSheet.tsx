import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Calendar, Check } from 'lucide-react-native';
import {
  NEXT_ACTION_KINDS, NEXT_ACTION_LABEL, NEXT_ACTION_NOTE_LIMIT, followUpSequenceOf, nextActionDraftOf, nextActionPatchOf, nextActionWhenOf, prospectNameOf, suggestNextAction, suggestionLineOf, whenOptions,
  type ChangeOutcome, type FollowUpStep, type NextActionDraft, type NextActionKind, type PlannedChange, type ProspectView, type Suggestion, type WhenOption,
} from '@lilachat/shared';
import { Interruptor } from '../../ui/Interruptor';
import { Rotulo } from '../../ui/Rotulo';
import { SelectorDeCuando } from '../../ui/SelectorDeCuando';
import { Sheet } from '../../ui/Sheet';
import { useColores } from '../../ui/tema';
import { TextButton } from './daliParts';
import { HALF_ROW_CELL, KIND_ICON, Kicker, NoteField, SheetActions, SheetTitle, useCenteredContent, useSheetSave } from './prospectSheetBlocks';

type Props = { visible: boolean; jwt: string; spaceId: string; prospect: ProspectView | null; now: Date; onDone: (outcome: ChangeOutcome) => void; onClose: () => void };

const SHRINKS = { flexShrink: 1 } as const;
const CLEAR_NEXT_ACTION: PlannedChange = { ok: true, patch: { next_action: null } };

/**
 * «Próxima acción» (dl-09): what Dali suggests from the rules, what you will do, when (Lima time), the reminder and
 * where the follow-up sequence goes. It becomes a reminder for whoever does it. Its errors stay inside the sheet.
 * Stitch's «Avisar también a», the subtitles of each choice and «Paso 3 de 5» do not go (no source behind them).
 */
export function NextActionSheet(props: Props) {
  const { prospect, now, visible } = props;
  const [draft, setDraft] = useState<NextActionDraft | null>(null);
  const [picking, setPicking] = useState(false);
  const [typed, setTyped] = useState(false);
  const saving = useSheetSave(props);
  const { reset } = saving;
  // It lives mounted behind the ficha: each opening starts from its prospect, never from the last one.
  useEffect(() => {
    setDraft(visible && prospect ? nextActionDraftOf(prospect, now) : null);
    setPicking(false);
    setTyped(false);
    reset();
  }, [visible, prospect?.id]);
  const suggestion = useMemo(() => (prospect ? suggestNextAction(prospect, now) : null), [prospect, now]);
  const options = useMemo(() => whenOptions(now), [now]);
  const centered = useCenteredContent();
  const steps = prospect ? followUpSequenceOf(prospect, now) : null;
  const update = (change: Partial<NextActionDraft>) => {
    setDraft((current) => current && { ...current, ...change });
    saving.clearError();
  };
  const pickAt = (at: string) => {
    update({ at });
    setPicking(false);
  };
  const applySuggestion = (picked: Suggestion) => {
    update({ kind: picked.kind, at: picked.at });
    setPicking(false);
  };
  const writeNote = (note: string) => {
    update({ note });
    setTyped(true);
  };

  return (
    <Sheet visible={visible && draft !== null} onClose={props.onClose} onBack={() => (typed ? undefined : props.onClose())} testID="hoja-proxima-accion" className="max-h-[92%]" dragArea="handle" bottomRoom={8} keyboard="avoid">
      {prospect && draft ? (
        <View style={[SHRINKS, centered]}>
          <SheetTitle kicker="Próxima acción" title={prospectNameOf(prospect)} onClose={props.onClose} />
          <ScrollView style={SHRINKS} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View className="px-5 pb-3">
              {suggestion ? <Suggested suggestion={suggestion} now={now} onUse={() => applySuggestion(suggestion)} /> : null}
              <Rotulo>Qué harás</Rotulo>
              <KindChoices value={draft.kind} onPick={(kind) => update({ kind })} />
              <Rotulo>Cuándo</Rotulo>
              <WhenChoices options={options} at={draft.at} now={now} picking={picking} onPick={pickAt} onPickDate={() => setPicking(true)} />
              {picking ? (
                <View className="mt-3">
                  <SelectorDeCuando valor={new Date(draft.at)} onCambiar={(date) => update({ at: date.toISOString() })} prefijo="cuando" conAtajos={false} />
                </View>
              ) : null}
              <RemindRow value={draft.remind} onChange={(remind) => update({ remind })} />
              <View className="mt-3">
                <NoteField testID="nota-proxima" value={draft.note} onChange={writeNote} placeholder="Nota para ti (opcional)" maxLength={NEXT_ACTION_NOTE_LIMIT} />
              </View>
              {steps ? <Sequence steps={steps} /> : null}
            </View>
          </ScrollView>
          <SheetActions error={saving.error} busy={saving.busy} label="Guardar próxima acción" testID="guardar-proxima-accion" onSave={() => void saving.save(nextActionPatchOf(draft, new Date()))}>
            {prospect.nextAction ? <TextButton testID="quitar-proxima-accion" tone="neutral" onPress={() => void saving.save(CLEAR_NEXT_ACTION)}>Quitar la próxima acción</TextButton> : null}
          </SheetActions>
        </View>
      ) : null}
    </Sheet>
  );
}

function Suggested({ suggestion, now, onUse }: { suggestion: Suggestion; now: Date; onUse: () => void }) {
  return (
    <View testID="dali-sugiere" className="mt-4 flex-row overflow-hidden rounded-xl border border-outline/15 bg-surface-variant/40">
      <View className="w-[3px] bg-primary" />
      <View className="min-w-0 flex-1 py-2 pl-3 pr-2">
        <View className="flex-row items-center gap-2">
          <View className="h-6 w-6 items-center justify-center rounded-md bg-primary">
            <Text className="text-[12px] font-bold text-on-primary">D</Text>
          </View>
          <View className="min-w-0 flex-1">
            <Kicker tone="primary">Dali sugiere</Kicker>
          </View>
          <Pressable testID="usar-sugerencia" accessibilityRole="button" onPress={onUse} className="min-h-[44px] justify-center">
            <View className="h-8 justify-center rounded-lg border border-primary/30 px-3">
              <Text className="text-[13px] font-semibold text-primary">Usar sugerencia</Text>
            </View>
          </Pressable>
        </View>
        <Text className="pb-1 pr-2 text-[14px] leading-5 text-on-surface">
          <Text className="font-bold">{suggestionLineOf(suggestion, now)}</Text>
          {` ${suggestion.reason}`}
        </Text>
      </View>
    </View>
  );
}

function KindChoices({ value, onPick }: { value: NextActionKind; onPick: (kind: NextActionKind) => void }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {NEXT_ACTION_KINDS.map((kind) => (
        <KindChoice key={kind} kind={kind} chosen={kind === value} onPick={() => onPick(kind)} />
      ))}
    </View>
  );
}

function KindChoice({ kind, chosen, onPick }: { kind: NextActionKind; chosen: boolean; onPick: () => void }) {
  const colors = useColores();
  const Icon = KIND_ICON[kind];
  return (
    <Pressable testID={`accion-${kind}`} accessibilityRole="radio" accessibilityState={{ checked: chosen }} onPress={onPick} style={HALF_ROW_CELL} className={`min-h-[56px] flex-row items-center gap-3 rounded-xl border px-3 py-2 ${chosen ? 'border-primary bg-primary/10' : 'border-outline/30 bg-surface'}`}>
      <View className={`h-9 w-9 items-center justify-center rounded-lg ${chosen ? 'bg-primary' : 'bg-surface-variant/60'}`}>
        <Icon size={18} color={chosen ? colors['on-primary'] : colors['on-surface-variant']} />
      </View>
      <Text className={`min-w-0 flex-1 text-[14px] font-semibold ${chosen ? 'text-primary' : 'text-on-surface'}`}>{NEXT_ACTION_LABEL[kind]}</Text>
    </Pressable>
  );
}

/** Today, tomorrow and in 3 days, or a date of your own; the box of your own date says the date it holds. */
function WhenChoices(props: { options: WhenOption[]; at: string; now: Date; picking: boolean; onPick: (at: string) => void; onPickDate: () => void }) {
  const own = props.picking || !props.options.some((option) => option.at === props.at);
  return (
    <View className="flex-row flex-wrap gap-2">
      {props.options.map((option) => (
        <WhenChoice key={option.key} testID={`cuando-${option.key}`} label={option.label} chosen={!own && props.at === option.at} onPick={() => props.onPick(option.at)} />
      ))}
      <WhenChoice testID="cuando-elegir" label={own ? nextActionWhenOf(props.at, props.now) : 'Elegir fecha'} calendar chosen={own} onPick={props.onPickDate} />
    </View>
  );
}

function WhenChoice({ label, chosen, onPick, calendar, testID }: { label: string; chosen: boolean; onPick: () => void; calendar?: boolean; testID: string }) {
  const colors = useColores();
  const ink = chosen ? colors.primary : colors['on-surface-variant'];
  return (
    <Pressable testID={testID} accessibilityRole="radio" accessibilityState={{ checked: chosen }} onPress={onPick} style={HALF_ROW_CELL} className={`h-12 flex-row items-center justify-center gap-2 rounded-xl border px-3 ${chosen ? 'border-primary bg-primary/10' : 'border-outline/30 bg-surface'}`}>
      {calendar ? <Calendar size={16} color={ink} /> : null}
      <Text numberOfLines={1} className={`shrink text-[14px] font-semibold ${chosen ? 'text-primary' : 'text-on-surface'}`}>{label}</Text>
      {chosen && !calendar ? <Check size={16} color={ink} /> : null}
    </Pressable>
  );
}

function RemindRow({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View className="mt-4 flex-row items-center gap-3 rounded-xl border border-outline/15 px-4 py-3">
      <View className="min-w-0 flex-1">
        <Text className="text-[15px] font-semibold text-on-surface">Recordatorio</Text>
        <Text className="text-[13px] text-on-surface-variant">Te avisa en Lilachat a esa hora</Text>
      </View>
      <Interruptor testID="recordatorio-proxima" value={value} onValueChange={onChange} />
    </View>
  );
}

/** NativeWind only sees literal classes: one dot per state. */
const STEP_DOT: Record<FollowUpStep['state'], string> = { done: 'bg-en-linea', current: 'bg-primary', next: 'border border-outline/40' };

/** Where the follow-up of the quote goes (day 0 to 10): done, now or coming; a message always needs your OK. */
function Sequence({ steps }: { steps: FollowUpStep[] }) {
  const colors = useColores();
  return (
    <View testID="secuencia-seguimiento" className="mt-4 rounded-xl border border-outline/15 px-4 py-3">
      <Kicker>Secuencia de seguimiento</Kicker>
      <View className="mt-2 gap-2">
        {steps.map((step) => (
          <View key={step.day} className="flex-row items-center gap-2">
            <View className={`h-5 w-5 items-center justify-center rounded-full ${STEP_DOT[step.state]}`}>{step.state === 'done' ? <Check size={12} color={colors['on-primary']} /> : null}</View>
            <Text className={`min-w-0 flex-1 text-[13px] ${step.state === 'next' ? 'text-on-surface-variant' : 'text-on-surface'}`}>{`Día ${step.day} · ${step.label}`}</Text>
            {step.state === 'current' ? <Text className="text-[11px] font-bold uppercase text-primary">Ahora</Text> : null}
          </View>
        ))}
      </View>
    </View>
  );
}
