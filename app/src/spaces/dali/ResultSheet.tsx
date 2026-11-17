import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Check, X } from 'lucide-react-native';
import {
  LOSS_REASONS, LOSS_REASON_LABEL, PROSPECT_OUTCOMES, RESULT_NOTE_LIMIT, STAGE_LABEL, prospectNameOf, resultDraftOf, resultHeaderLineOf, resultPatchOf,
  type ChangeOutcome, type LossReason, type ProspectOutcome, type ProspectView, type ResultDraft,
} from '@lilachat/shared';
import { Rotulo } from '../../ui/Rotulo';
import { Sheet } from '../../ui/Sheet';
import { useColores } from '../../ui/tema';
import { HALF_ROW_CELL, NoteField, QuoteCard, SheetActions, SheetTitle, useCenteredContent, useSheetSave } from './prospectSheetBlocks';

type Props = { visible: boolean; jwt: string; spaceId: string; prospect: ProspectView | null; onDone: (outcome: ChangeOutcome) => void; onClose: () => void };

const SHRINKS = { flexShrink: 1 } as const;

/**
 * «Resultado» (dl-06 and dl-07): won or lost, and why it was lost, from the contract's reasons; «Otro» asks for a
 * line. What backs a sale is the quote agentes linked (its amount only for an admin: the server strips it). Its
 * errors stay inside the sheet. Stitch's subtitles under each option, «Muy pequeño», Dali writing again in 30 days and
 * the notice to Meta do not go (no source behind them yet).
 */
export function ResultSheet(props: Props) {
  const { prospect, visible } = props;
  const [draft, setDraft] = useState<ResultDraft | null>(null);
  const [typed, setTyped] = useState(false);
  const saving = useSheetSave(props);
  const { reset } = saving;
  // It lives mounted behind the ficha: each opening starts from its prospect, never from the last one.
  useEffect(() => {
    setDraft(visible && prospect ? resultDraftOf(prospect) : null);
    setTyped(false);
    reset();
  }, [visible, prospect?.id]);
  const centered = useCenteredContent();
  const update = (change: Partial<ResultDraft>) => {
    setDraft((current) => current && { ...current, ...change });
    saving.clearError();
  };
  const writeNote = (note: string) => {
    update({ note });
    setTyped(true);
  };

  return (
    <Sheet visible={visible && draft !== null} onClose={props.onClose} onBack={() => (typed ? undefined : props.onClose())} testID="hoja-resultado" className="max-h-[92%]" dragArea="handle" bottomRoom={8} keyboard="avoid">
      {prospect && draft ? (
        <View style={[SHRINKS, centered]}>
          <SheetTitle kicker="Resultado" title={prospectNameOf(prospect)} line={resultHeaderLineOf(prospect)} onClose={props.onClose} />
          <ScrollView style={SHRINKS} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View className="px-5 pb-3">
              <OutcomeChoices value={draft.outcome} onPick={(outcome) => update({ outcome })} />
              {draft.outcome === 'won' && prospect.quote ? (
                <View className="mt-4">
                  <QuoteCard quote={prospect.quote} kicker="Lo que lo prueba" testID="prueba-cotizacion" />
                </View>
              ) : null}
              {draft.outcome === 'lost' ? <LossReasons value={draft.reason} onPick={(reason) => update({ reason })} /> : null}
              {draft.outcome ? <NoteSection draft={draft} onChange={writeNote} /> : null}
            </View>
          </ScrollView>
          <SheetActions error={saving.error} busy={saving.busy} label="Guardar resultado" testID="guardar-resultado" onSave={() => void saving.save(resultPatchOf(draft))} />
        </View>
      ) : null}
    </Sheet>
  );
}

/** NativeWind only sees literal classes: the chosen outcome's box, circle and ink. */
const OUTCOME_BOX: Record<ProspectOutcome, string> = { won: 'border-en-linea bg-en-linea/10', lost: 'border-error bg-error/10' };
const OUTCOME_CIRCLE: Record<ProspectOutcome, string> = { won: 'bg-en-linea', lost: 'bg-error' };
const OUTCOME_INK: Record<ProspectOutcome, string> = { won: 'text-en-linea', lost: 'text-error' };

function OutcomeChoices({ value, onPick }: { value: ProspectOutcome | null; onPick: (outcome: ProspectOutcome) => void }) {
  return (
    <View className="mt-4 flex-row gap-2">
      {PROSPECT_OUTCOMES.map((outcome) => (
        <OutcomeChoice key={outcome} outcome={outcome} chosen={value === outcome} onPick={() => onPick(outcome)} />
      ))}
    </View>
  );
}

function OutcomeChoice({ outcome, chosen, onPick }: { outcome: ProspectOutcome; chosen: boolean; onPick: () => void }) {
  const colors = useColores();
  const Icon = outcome === 'won' ? Check : X;
  return (
    <Pressable testID={`resultado-${outcome}`} accessibilityRole="radio" accessibilityState={{ checked: chosen }} onPress={onPick} className={`min-h-[64px] flex-1 flex-row items-center gap-3 rounded-xl border-2 px-4 ${chosen ? OUTCOME_BOX[outcome] : 'border-outline/20 bg-surface'}`}>
      <View className={`h-9 w-9 items-center justify-center rounded-full ${chosen ? OUTCOME_CIRCLE[outcome] : 'bg-surface-variant/60'}`}>
        <Icon size={18} color={chosen ? colors['on-primary'] : colors['on-surface-variant']} />
      </View>
      <Text className={`text-[16px] font-bold ${chosen ? OUTCOME_INK[outcome] : 'text-on-surface'}`}>{STAGE_LABEL[outcome]}</Text>
    </Pressable>
  );
}

function LossReasons({ value, onPick }: { value: LossReason | null; onPick: (reason: LossReason) => void }) {
  return (
    <>
      <Rotulo>¿Por qué se perdió?</Rotulo>
      <View className="flex-row flex-wrap gap-2">
        {LOSS_REASONS.map((reason) => (
          <ReasonChoice key={reason} reason={reason} chosen={value === reason} onPick={() => onPick(reason)} />
        ))}
      </View>
    </>
  );
}

function ReasonChoice({ reason, chosen, onPick }: { reason: LossReason; chosen: boolean; onPick: () => void }) {
  const colors = useColores();
  return (
    <Pressable testID={`motivo-${reason}`} accessibilityRole="radio" accessibilityState={{ checked: chosen }} onPress={onPick} style={HALF_ROW_CELL} className={`min-h-[48px] flex-row items-center gap-2.5 rounded-xl border px-3 py-2 ${chosen ? 'border-primary bg-primary/10' : 'border-outline/30 bg-surface'}`}>
      <View className={`h-5 w-5 items-center justify-center rounded-full ${chosen ? 'bg-primary' : 'border-2 border-outline/40'}`}>
        {chosen ? <Check size={12} color={colors['on-primary']} /> : null}
      </View>
      <Text className={`min-w-0 flex-1 text-[14px] font-semibold ${chosen ? 'text-primary' : 'text-on-surface'}`}>{LOSS_REASON_LABEL[reason]}</Text>
    </Pressable>
  );
}

/** «Otro» makes the line required; otherwise it is a detail for the team. */
function NoteSection({ draft, onChange }: { draft: ResultDraft; onChange: (note: string) => void }) {
  const required = draft.outcome === 'lost' && draft.reason === 'other';
  return (
    <>
      <Rotulo>{required ? '¿Qué pasó?' : '¿Algo más? (opcional)'}</Rotulo>
      <NoteField testID="nota-resultado" value={draft.note} onChange={onChange} placeholder="Un detalle para el equipo" maxLength={RESULT_NOTE_LIMIT} />
    </>
  );
}
