import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Linking, Pressable, Text, TextInput, View, type ViewStyle } from 'react-native';
import { Check, CircleCheck, FileText, MapPin, MessageSquare, Phone, X, type LucideIcon } from 'lucide-react-native';
import {
  LEVEL_LABEL, arrivalLabelOf, levelOf, missingLabelsOf, nextActionLineOf, originLineOf, prospectDialUrl, prospectNameOf, quoteAmountOf, quoteSentLabelOf, shownProspectPhone, stageWalkOf,
  type ChangeOutcome, type NextActionKind, type PlannedChange, type ProspectQuote, type ProspectView, type StageStep,
} from '@lilachat/shared';
import { Avatar } from '../../ui/Avatar';
import { ANCHO_MAXIMO_DE_CONTENIDO } from '../../ui/disposicion';
import { MONO_FONT } from '../../ui/monoFont';
import { useColores } from '../../ui/tema';
import { useDisposicion } from '../../ui/useDisposicion';
import { notify, OriginPill, ScorePill, SolidButton } from './daliParts';
import { sendChange } from './sellerDesk';

/**
 * The blocks of a prospect's ficha (dl-03), each one a card, and the pieces its two forms share (dl-06, dl-07,
 * dl-09). The screen decides the order and the actions around them. Stitch's pencils on each field, the «WhatsApp»
 * button and «/ 100 puntos» do not go (BOTS-API «Lo que Stitch dibujó y no va»).
 */

export const KIND_ICON: Record<NextActionKind, LucideIcon> = { call: Phone, whatsapp: MessageSquare, visit: MapPin, quote: FileText };
/** Two per row in a grid of choices (2×2 in dl-09, the loss reasons in dl-07); a lone last one takes the row. */
export const HALF_ROW_CELL: ViewStyle = { flexBasis: '45%', flexGrow: 1 };
const CONTACT_AVATAR = 56;
const ASSIGNEE_AVATAR = 36;
const CENTERED: ViewStyle = { width: '100%', maxWidth: ANCHO_MAXIMO_DE_CONTENIDO, alignSelf: 'center' };

/** On a tablet or a turned phone the content is centered, no wider than it reads well. */
export function useCenteredContent(): ViewStyle | undefined {
  return useDisposicion().amplia ? CENTERED : undefined;
}

/** A prospect's number in the phone's dialer: never a Lilachat call (the client is on WhatsApp, not in the app). */
export function callProspect(phone: string): void {
  Linking.openURL(prospectDialUrl(phone)).catch(() => notify('No se pudo abrir el marcador del teléfono.'));
}

const openQuote = (url: string): void => {
  Linking.openURL(url).catch(() => notify('No se pudo abrir la cotización.'));
};

/** A card's title (the app's `Rotulo` carries a section's margins, which a card does not want). */
export function Kicker({ children, tone = 'neutral' }: { children: string; tone?: 'neutral' | 'primary' }) {
  return <Text className={`text-[11px] font-semibold uppercase tracking-wide ${tone === 'primary' ? 'text-primary' : 'text-on-surface-variant'}`}>{children}</Text>;
}

/** `accent`: the line on top of the next action (dl-03). */
export function Card({ children, testID, accent }: { children: ReactNode; testID?: string; accent?: boolean }) {
  return (
    <View testID={testID} className="overflow-hidden rounded-xl border border-outline/15 bg-surface">
      {accent ? <View className="h-[3px] bg-primary" /> : null}
      <View className="px-4 py-3.5">{children}</View>
    </View>
  );
}

export function ContactCard({ prospect }: { prospect: ProspectView }) {
  const colors = useColores();
  const name = prospectNameOf(prospect);
  return (
    <Card testID="ficha-contacto">
      <Kicker>Datos de contacto</Kicker>
      <View className="mt-2 flex-row items-center gap-3">
        <Avatar nombre={name} tamano={CONTACT_AVATAR} icono={prospect.name ? undefined : <Phone size={22} color={colors.primary} />} />
        <View className="min-w-0 flex-1">
          <Text numberOfLines={2} className="text-[18px] font-extrabold text-on-surface">{name}</Text>
          {prospect.service ? <Text numberOfLines={1} className="text-[14px] text-on-surface-variant">{prospect.service.name}</Text> : null}
          {/* Without a name, the title already is the number. */}
          {prospect.name ? <Text style={{ fontFamily: MONO_FONT }} className="text-[14px] text-on-surface">{shownProspectPhone(prospect.phone)}</Text> : null}
        </View>
      </View>
      <View className="mt-3">
        <SolidButton testID="llamar-prospecto" icon={<Phone size={18} color={colors['on-primary']} />} onPress={() => callProspect(prospect.phone)}>Llamar</SolidButton>
      </View>
    </Card>
  );
}

export function OriginCard({ prospect }: { prospect: ProspectView }) {
  return (
    <Card testID="ficha-origen">
      <Kicker>Origen</Kicker>
      <View className="mt-2 flex-row">
        <OriginPill prospect={prospect} />
      </View>
      <Text className="mt-2 text-[14px] font-semibold text-on-surface">{originLineOf(prospect)}</Text>
      <Text className="text-[13px] text-on-surface-variant">{arrivalLabelOf(prospect)}</Text>
    </Card>
  );
}

export function ScoreCard({ prospect }: { prospect: ProspectView }) {
  const level = levelOf(prospect.score);
  if (prospect.score === undefined || !level) return null;
  return (
    <Card testID="ficha-calificacion">
      <View className="flex-row items-center justify-between gap-2">
        <Kicker>Calificación Dali</Kicker>
        <ScorePill score={prospect.score} />
      </View>
      <Text accessibilityLabel={`${prospect.score} puntos, ${LEVEL_LABEL[level]}`} className="mt-1 text-[40px] font-extrabold text-primary">{prospect.score}</Text>
      {prospect.scoreReasons?.length ? <ScoreReasons reasons={prospect.scoreReasons} /> : null}
      <Text className="mt-2 text-[12px] text-on-surface-variant">Puntaje por reglas con lo que entendió Dali</Text>
    </Card>
  );
}

function ScoreReasons({ reasons }: { reasons: string[] }) {
  const colors = useColores();
  return (
    <View className="mt-1">
      <Kicker>Por qué</Kicker>
      <View className="mt-2 flex-row flex-wrap gap-2">
        {reasons.map((reason) => (
          <View key={reason} style={HALF_ROW_CELL} className="min-h-[40px] flex-row items-center gap-2 rounded-lg border border-outline/15 px-2.5 py-1.5">
            <Text className="min-w-0 flex-1 text-[13px] text-on-surface">{reason}</Text>
            <CircleCheck size={16} color={colors.primary} />
          </View>
        ))}
      </View>
    </View>
  );
}

/** What Dali understood, read only: the fields are agentes', a label over its value (dl-03). */
export function UnderstoodCard({ prospect }: { prospect: ProspectView }) {
  const missing = missingLabelsOf(prospect);
  const fields = prospect.fields ?? [];
  if (!fields.length && !missing.length && !prospect.summary) return null;
  return (
    <Card testID="ficha-entendio">
      <Kicker>Lo que entendió Dali</Kicker>
      {prospect.summary ? <Text className="mt-2 text-[14px] text-on-surface">{prospect.summary}</Text> : null}
      {fields.map((field, index) => (
        <View key={field.key} className={`py-2 ${index > 0 ? 'border-t border-outline/10' : 'mt-1'}`}>
          <Text className="text-[12px] text-on-surface-variant">{field.label}</Text>
          <Text className="text-[15px] font-semibold text-on-surface">{field.value}</Text>
        </View>
      ))}
      {missing.length ? <Text testID="ficha-falta" className="mt-2 text-[13px] font-medium text-warning">{`Falta: ${missing.join(', ')}`}</Text> : null}
    </Card>
  );
}

/** The quote agentes linked from Portal; the amount only reaches a space admin (the server strips it). */
export function QuoteCard({ quote, kicker, testID, amountTestID }: { quote: ProspectQuote; kicker: string; testID: string; amountTestID?: string }) {
  const amount = quoteAmountOf(quote);
  return (
    <Card testID={testID}>
      <Kicker>{kicker}</Kicker>
      <View className="mt-2 flex-row items-baseline gap-2">
        <Text style={{ fontFamily: MONO_FONT }} className="min-w-0 flex-1 text-[14px] font-semibold text-on-surface">{quote.code}</Text>
        {amount ? <Text testID={amountTestID} className="text-[18px] font-extrabold text-primary">{amount}</Text> : null}
      </View>
      {quote.sentAt ? <Text className="text-[13px] text-on-surface-variant">{quoteSentLabelOf(quote.sentAt)}</Text> : null}
      {quote.url ? <QuoteLink url={quote.url} /> : null}
    </Card>
  );
}

function QuoteLink({ url }: { url: string }) {
  return (
    <Pressable testID="ver-cotizacion" accessibilityRole="link" onPress={() => openQuote(url)} hitSlop={6} className="min-h-[44px] self-start justify-center">
      <Text className="text-[14px] font-semibold text-primary">Ver cotización</Text>
    </Pressable>
  );
}

/** The funnel's stages, the current one marked (dl-03); a lost prospect says so, with its reason. */
export function StageCard({ prospect }: { prospect: ProspectView }) {
  const walk = stageWalkOf(prospect);
  return (
    <Card testID="ficha-etapa">
      <Kicker>Etapa del prospecto</Kicker>
      {walk.lost ? (
        <Text className="mt-2 text-[14px] font-semibold text-error">{walk.lost}</Text>
      ) : (
        <View className="mt-2 flex-row flex-wrap items-center gap-1.5">
          {walk.steps.map((step) => <StageChip key={step.stage} step={step} />)}
        </View>
      )}
    </Card>
  );
}

/** NativeWind only sees literal classes: one box and one ink per state. */
const STEP_BOX: Record<StageStep['state'], string> = { done: 'border-en-linea/30 bg-en-linea/10', current: 'border-primary bg-primary', next: 'border-outline/30 bg-surface' };
const STEP_INK: Record<StageStep['state'], string> = { done: 'text-en-linea', current: 'text-on-primary', next: 'text-on-surface-variant' };

function StageChip({ step }: { step: StageStep }) {
  const colors = useColores();
  const current = step.state === 'current';
  return (
    <View testID={current ? 'etapa-actual' : undefined} accessibilityLabel={current ? `${step.label}, etapa actual` : step.label} className={`h-7 flex-row items-center gap-1 rounded-md border px-2 ${STEP_BOX[step.state]}`}>
      <Text className={`text-[11px] font-bold uppercase tracking-wide ${STEP_INK[step.state]}`}>{step.label}</Text>
      {step.state === 'done' ? <Check size={12} color={colors['en-linea']} /> : null}
    </View>
  );
}

export function NextActionCard({ prospect, now, onPlan }: { prospect: ProspectView; now: Date; onPlan: () => void }) {
  const action = prospect.nextAction;
  return (
    <Card testID="ficha-proxima" accent={Boolean(action)}>
      <Kicker>Próxima acción</Kicker>
      {action ? <PlannedAction action={action} now={now} /> : <Text className="mt-2 text-[14px] text-on-surface-variant">Sin próxima acción.</Text>}
      <Pressable testID="agendar-proxima" accessibilityRole="button" onPress={onPlan} className="mt-3 min-h-[44px] self-start justify-center rounded-lg border border-dashed border-primary/40 px-4">
        <Text className="text-[14px] font-semibold text-primary">{action ? 'Cambiar' : 'Agendar'}</Text>
      </Pressable>
    </Card>
  );
}

function PlannedAction({ action, now }: { action: NonNullable<ProspectView['nextAction']>; now: Date }) {
  const colors = useColores();
  const Icon = KIND_ICON[action.kind];
  return (
    <View className="mt-2 flex-row items-center gap-3">
      <View className="h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
        <Icon size={20} color={colors.primary} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[15px] font-bold text-on-surface">{nextActionLineOf(action, now)}</Text>
        {action.note ? <Text className="text-[13px] text-on-surface-variant">{action.note}</Text> : null}
      </View>
    </View>
  );
}

export function AttendsLine({ prospect }: { prospect: ProspectView }) {
  if (!prospect.assignee) return <Text className="text-[14px] text-on-surface-variant">{prospect.attendedBy === 'dali' ? 'Nadie lo tomó: Dali conversa.' : 'Nadie lo tomó todavía.'}</Text>;
  return (
    <View className="flex-row items-center gap-2.5">
      <Avatar nombre={prospect.assignee.name} tamano={ASSIGNEE_AVATAR} />
      <Text numberOfLines={1} className="min-w-0 flex-1 text-[15px] font-bold text-on-surface">{prospect.assignee.name}</Text>
    </View>
  );
}

/** The head of a form sheet (dl-06, dl-07, dl-09): the kicker in the accent, the prospect's name, a line and ✕. */
export function SheetTitle({ kicker, title, line, onClose }: { kicker: string; title: string; line?: string; onClose: () => void }) {
  const colors = useColores();
  return (
    <View className="flex-row items-start gap-2 border-b border-outline/15 pb-3 pl-5 pr-2 pt-1">
      <View className="min-w-0 flex-1">
        <Kicker tone="primary">{kicker}</Kicker>
        <Text numberOfLines={1} className="text-[20px] font-extrabold text-on-surface">{title}</Text>
        {line ? <Text numberOfLines={1} className="text-[13px] text-on-surface-variant">{line}</Text> : null}
      </View>
      <Pressable testID="btn-cerrar-overlay" accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} className="h-11 w-11 items-center justify-center rounded-full">
        <X size={20} color={colors['on-surface-variant']} />
      </Pressable>
    </View>
  );
}

export function NoteField(props: { testID: string; value: string; onChange: (text: string) => void; placeholder: string; maxLength: number }) {
  const colors = useColores();
  return (
    <TextInput
      testID={props.testID}
      value={props.value}
      onChangeText={props.onChange}
      maxLength={props.maxLength}
      multiline
      placeholder={props.placeholder}
      placeholderTextColor={colors['on-surface-variant']}
      className="min-h-[56px] rounded-xl border border-outline/30 bg-background px-3 py-2 text-[15px] text-on-surface"
    />
  );
}

/** The foot of a form sheet: its error stays in the sheet (with the keyboard open a toast is not seen), then the button. */
export function SheetActions(props: { error: string; busy: boolean; label: string; testID: string; onSave: () => void; children?: ReactNode }) {
  const colors = useColores();
  return (
    <View className="gap-1 border-t border-outline/15 px-5 pt-3">
      {props.error ? <Text testID="error-formulario" className="pb-1 text-[13px] text-error">{props.error}</Text> : null}
      <SolidButton testID={props.testID} busy={props.busy} icon={<Check size={18} color={colors['on-primary']} />} onPress={props.onSave}>{props.label}</SolidButton>
      {props.children}
    </View>
  );
}

/**
 * A form sheet's save (dl-06, dl-07, dl-09): what is missing or refused stays in the sheet; what took, or someone was
 * first, goes back to whoever opened it. One save at a time: a second tap would come back as «someone was first».
 */
export function useSheetSave(props: { jwt: string; spaceId: string; prospect: ProspectView | null; onDone: (outcome: ChangeOutcome) => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const reset = useCallback(() => {
    setError('');
    setBusy(false);
  }, []);
  const save = async (planned: PlannedChange): Promise<void> => {
    if (!props.prospect || inFlight.current) return;
    if (!planned.ok) return setError(planned.message);
    inFlight.current = true;
    setBusy(true);
    try {
      const outcome = await sendChange(props.jwt, props.spaceId, props.prospect, planned.patch);
      if (!outcome.ok && !outcome.stale) return setError(outcome.message);
      props.onDone(outcome);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return { error, busy, reset, save, clearError: () => setError('') };
}
