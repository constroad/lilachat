import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { Bot, CalendarClock, Clock, Info, Phone, Send, ShieldCheck, type LucideIcon } from 'lucide-react-native';
import { attendantLineOf, followUpGroupsOf, followUpReasonOf, followUpsOf, hasUnsentEdits, isDraftFollowUp, levelOf, prospectNameOf, type ChangeOutcome, type FollowUpGroup, type FollowUpItem, type FollowUpReason, type ProspectView, type SellerPatch } from '@lilachat/shared';
import { PantallaEnModal } from '../../ui/PantallaEnModal';
import { Rotulo } from '../../ui/Rotulo';
import { useColores } from '../../ui/tema';
import { EmptyNote, OriginPill, OutlineButton, ScorePill, SkeletonRows, SolidButton, StagePill, TextButton } from './daliParts';
import { NextActionSheet } from './NextActionSheet';
import { callProspect, Kicker, useCenteredContent } from './prospectSheetBlocks';
import { ProspectAvatar } from './ProspectRow';
import type { ProspectList } from './prospectsApi';
import { sendChange, sendFollowUp } from './sellerDesk';

type Props = { visible: boolean; list: ProspectList | null; jwt: string; spaceId: string; me: string; now: Date; onChanged: (prospect: ProspectView) => void; onStale: () => void; onClose: () => void; onOpenProspect: (prospect: ProspectView) => void };

/** What the screen holds between taps, by prospect id; every opening starts from nothing. */
type DeskState = { edits: Readonly<Record<string, string>>; errors: Readonly<Record<string, string>>; busy: readonly string[]; planningId: string | null };
type Desk = ReturnType<typeof useFollowUpDesk>;

const EMPTY_DESK: DeskState = { edits: {}, errors: {}, busy: [], planningId: null };
const NO_FOLLOW_UPS: FollowUpItem[] = [];
const NOT_A_BUYER: SellerPatch = { result: { outcome: 'lost', reason: 'not_a_buyer' } };
const CARD_AVATAR = 40;
const DRAFT_MAX_LENGTH = 1000;
const ICON = 18;
const SMALL_ICON = 15;
const REASON_ICON: Record<FollowUpReason['icon'], LucideIcon> = { overdue: Clock, action: CalendarClock, draft: Info };

const without = (record: Readonly<Record<string, string>>, id: string): Record<string, string> => Object.fromEntries(Object.entries(record).filter(([key]) => key !== id));

/** Before a change: the card says it is on its way and forgets its last error. */
const started = (desk: DeskState, id: string): DeskState => ({ ...desk, busy: [...desk.busy, id], errors: without(desk.errors, id) });

/** After a change: a sent draft leaves the editor; a refusal stays on its card (with the keyboard open a toast is not seen). */
function settled(desk: DeskState, id: string, outcome: ChangeOutcome, sentDraft: boolean): DeskState {
  const busy = desk.busy.filter((one) => one !== id);
  if (!outcome.ok) return { ...desk, busy, errors: { ...desk.errors, [id]: outcome.message } };
  return { ...desk, busy, edits: sentDraft ? without(desk.edits, id) : desk.edits };
}

/**
 * The seller's desk for today's follow-ups: the drafts being edited, each card's error and wait, and the prospect
 * being planned. It lives mounted behind the space, so closing clears it; an answer that arrives after closing does
 * not write into the next opening.
 */
function useFollowUpDesk(props: Props) {
  const { visible, jwt, spaceId, onChanged, onStale } = props;
  const [state, setState] = useState<DeskState>(EMPTY_DESK);
  const opening = useRef(0);
  useEffect(() => {
    if (visible) return;
    opening.current += 1;
    setState(EMPTY_DESK);
  }, [visible]);
  const tell = useCallback((outcome: ChangeOutcome) => {
    if (outcome.ok) onChanged(outcome.prospect);
    else if (outcome.stale) onStale();
  }, [onChanged, onStale]);
  const run = useCallback(async (prospect: ProspectView, work: () => Promise<ChangeOutcome>, sentDraft: boolean) => {
    const current = opening.current;
    setState((before) => started(before, prospect.id));
    const outcome = await work();
    if (opening.current === current) setState((before) => settled(before, prospect.id, outcome, sentDraft));
    tell(outcome);
  }, [tell]);
  return {
    state,
    edit: (id: string, text: string) => setState((before) => ({ ...before, edits: { ...before.edits, [id]: text } })),
    send: (prospect: ProspectView, text: string) => void run(prospect, () => sendFollowUp(jwt, spaceId, prospect, text), true),
    closeAsConsult: (prospect: ProspectView) => void run(prospect, () => sendChange(jwt, spaceId, prospect, NOT_A_BUYER), true),
    plan: (prospect: ProspectView) => setState((before) => ({ ...before, planningId: prospect.id })),
    closePlan: () => setState((before) => ({ ...before, planningId: null })),
    settlePlan: (outcome: ChangeOutcome) => {
      setState((before) => ({ ...(before.planningId ? settled(before, before.planningId, outcome, false) : before), planningId: null }));
      tell(outcome);
    },
  };
}

/**
 * «Seguimientos de hoy» (dl-05), full screen with ←: my next actions due by tonight and the follow-ups Dali drafted,
 * the late ones first. Dali proposes, you approve: a draft leaves only with a seller's OK, edited or as it came.
 * Stitch's daily counter, «Prioridad alta» and the WhatsApp Business foot do not go (no source; Dali is not WhatsApp
 * Business). Leaving with an edited draft asks first: back does not throw a typed text away.
 */
export function FollowUpsScreen(props: Props) {
  const { now, visible } = props;
  const prospects = useMemo(() => props.list?.prospects ?? [], [props.list]);
  const followUps = useMemo(() => (visible ? followUpsOf(prospects, props.me, now).items : NO_FOLLOW_UPS), [visible, prospects, props.me, now]);
  const groups = useMemo(() => followUpGroupsOf(followUps, now), [followUps, now]);
  const desk = useFollowUpDesk(props);
  // Full screen on a tablet or turned: the cards centered, never wider than they read well.
  const centered = useCenteredContent();
  const planningId = desk.state.planningId;
  const planned = planningId ? (prospects.find((one) => one.id === planningId) ?? null) : null;
  const leave = (go: () => void) => {
    if (!hasUnsentEdits(followUps, desk.state.edits)) return go();
    Alert.alert('¿Descartar lo que escribiste?', 'El mensaje editado no se envía.', [
      { text: 'Seguir editando', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: go },
    ]);
  };
  const open = (prospect: ProspectView) => leave(() => props.onOpenProspect(prospect));
  return (
    <>
      <PantallaEnModal visible={visible} titulo="Seguimientos de hoy" onCerrar={() => leave(props.onClose)} testIDCerrar="cerrar-seguimientos">
        <View testID="seguimientos-hoy" style={centered}>
          <TrustLine />
          {!props.list ? <View className="mt-4"><SkeletonRows count={2} /></View> : null}
          {props.list && groups.length === 0 ? (
            <View className="mt-4">
              <EmptyNote title="Nada pendiente para hoy.">Lo que agendes o lo que Dali proponga para hoy aparece aquí.</EmptyNote>
            </View>
          ) : null}
          {groups.map((group) => <Group key={group.key} group={group} desk={desk} now={now} onOpen={open} />)}
        </View>
      </PantallaEnModal>
      <NextActionSheet visible={planned !== null} jwt={props.jwt} spaceId={props.spaceId} prospect={planned} now={now} onDone={desk.settlePlan} onClose={desk.closePlan} />
    </>
  );
}

function TrustLine() {
  const colors = useColores();
  return (
    <View className="flex-row items-center gap-2 rounded-xl border border-outline/15 bg-surface px-3 py-2.5">
      <ShieldCheck size={ICON} color={colors.primary} />
      <Text className="min-w-0 flex-1 text-[13px] text-on-surface">
        <Text className="font-bold">Dali propone, tú apruebas.</Text>
        {' Nada se le envía al cliente sin tu OK.'}
      </Text>
    </View>
  );
}

/** «Atrasados · 2» (red bar on its cards) or «Para hoy · 3» (the accent's). */
function Group({ group, desk, now, onOpen }: { group: FollowUpGroup; desk: Desk; now: Date; onOpen: (prospect: ProspectView) => void }) {
  return (
    <View testID={`seguimientos-${group.key}`}>
      <Rotulo tono={group.key === 'late' ? 'error' : 'normal'}>{group.title}</Rotulo>
      {group.followUps.map((followUp) => {
        const id = followUp.prospect.id;
        return (
          <FollowUpCard
            key={`${id}:${followUp.kind}`}
            followUp={followUp}
            late={group.key === 'late'}
            now={now}
            edit={desk.state.edits[id]}
            error={desk.state.errors[id]}
            busy={desk.state.busy.includes(id)}
            desk={desk}
            onOpen={onOpen}
          />
        );
      })}
    </View>
  );
}

type CardProps = { followUp: FollowUpItem; late: boolean; now: Date; edit: string | undefined; error: string | undefined; busy: boolean; desk: Desk; onOpen: (prospect: ProspectView) => void };

/** One follow-up: who, why it is here, Dali's draft (editable), and Enviar · Editar · Llamar · Agendar. */
function FollowUpCard(props: CardProps) {
  const { prospect } = props.followUp;
  const draft = isDraftFollowUp(props.followUp);
  const text = props.edit ?? prospect.followUpDraft?.text ?? '';
  return (
    <View testID={`seguimiento-${prospect.id}`} className="mb-3 overflow-hidden rounded-xl border border-outline/15 bg-surface px-4 py-3">
      <View className={`absolute bottom-0 left-0 top-0 w-[3px] ${props.late ? 'bg-error' : 'bg-primary'}`} />
      <CardHead prospect={prospect} onOpen={props.onOpen} />
      <Reason followUp={props.followUp} now={props.now} />
      {draft ? <DraftBlock text={text} editing={props.edit !== undefined} onChange={(value) => props.desk.edit(prospect.id, value)} /> : null}
      {props.error ? <Text testID="error-seguimiento" className="mt-2 text-[13px] text-error">{props.error}</Text> : null}
      <CardActions {...props} draft={draft} text={text} />
    </View>
  );
}

/** The circle, the name and the pills: tapping them opens the conversation. */
function CardHead({ prospect, onOpen }: { prospect: ProspectView; onOpen: (prospect: ProspectView) => void }) {
  const name = prospectNameOf(prospect);
  return (
    <Pressable testID={`abrir-conversacion-${prospect.id}`} accessibilityRole="button" accessibilityLabel={`Abrir la conversación con ${name}`} onPress={() => onOpen(prospect)} className="min-h-[44px] flex-row items-start gap-3">
      <ProspectAvatar name={name} size={CARD_AVATAR} />
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="text-[15px] font-bold text-on-surface">{name}</Text>
        {prospect.service ? <Text numberOfLines={1} className="text-[13px] text-on-surface-variant">{prospect.service.name}</Text> : null}
        <View className="mt-1.5 flex-row flex-wrap gap-1.5">
          <OriginPill prospect={prospect} />
          <ScorePill score={prospect.score} />
          <StagePill prospect={prospect} />
        </View>
      </View>
    </Pressable>
  );
}

/** Why it is here: the next action due, what is late on it, or Dali's proposal; and who attends it. */
function Reason({ followUp, now }: { followUp: FollowUpItem; now: Date }) {
  const colors = useColores();
  const reason = followUpReasonOf(followUp, now);
  const attendant = attendantLineOf(followUp.prospect);
  const Icon = REASON_ICON[reason.icon];
  return (
    <View testID="motivo-seguimiento" className={`mt-2 flex-row items-center gap-2 rounded-lg border px-3 py-1.5 ${reason.late ? 'border-error/30 bg-error/5' : 'border-outline/15'}`}>
      <Icon size={SMALL_ICON} color={reason.late ? colors.error : colors['on-surface-variant']} />
      <Text numberOfLines={2} className={`min-w-0 flex-1 text-[13px] ${reason.late ? 'text-error' : 'text-on-surface'}`}>{reason.text}</Text>
      {attendant ? <Text numberOfLines={1} className="shrink-0 text-[13px] text-on-surface-variant">{attendant}</Text> : null}
    </View>
  );
}

/** «BORRADOR DE DALI»: the text as it came, or the field to change it. */
function DraftBlock({ text, editing, onChange }: { text: string; editing: boolean; onChange: (text: string) => void }) {
  const colors = useColores();
  return (
    <View className="mt-2 rounded-lg border border-outline/15 bg-surface-variant/30 px-3 py-2">
      <View className="flex-row items-center gap-1.5">
        <Bot size={SMALL_ICON} color={colors.primary} />
        <Kicker tone="primary">Borrador de Dali</Kicker>
      </View>
      {editing ? (
        <TextInput
          testID="editar-borrador"
          value={text}
          onChangeText={onChange}
          autoFocus
          multiline
          maxLength={DRAFT_MAX_LENGTH}
          textAlignVertical="top"
          placeholder="Escribe el mensaje para el cliente"
          placeholderTextColor={colors['on-surface-variant']}
          className="mt-1 min-h-[96px] rounded-lg border border-outline/30 bg-surface px-2 py-1.5 text-[14px] text-on-surface"
        />
      ) : (
        <Text className="mt-1 text-[14px] leading-5 text-on-surface">{`«${text}»`}</Text>
      )}
    </View>
  );
}

function CardActions(props: CardProps & { draft: boolean; text: string }) {
  const colors = useColores();
  const { prospect } = props.followUp;
  const { desk } = props;
  return (
    <View className="mt-3 flex-row flex-wrap items-center gap-2">
      {props.draft ? (
        <SolidButton testID="enviar-borrador" busy={props.busy} disabled={!props.text.trim()} icon={<Send size={16} color={colors['on-primary']} />} onPress={() => desk.send(prospect, props.text.trim())}>
          Enviar
        </SolidButton>
      ) : null}
      {props.draft && props.edit === undefined ? <OutlineButton testID="editar-seguimiento" onPress={() => desk.edit(prospect.id, props.text)}>Editar</OutlineButton> : null}
      <CallButton phone={prospect.phone} />
      <TextButton testID="reprogramar-seguimiento" tone="neutral" onPress={() => desk.plan(prospect)}>{prospect.nextAction ? 'Reprogramar' : 'Agendar'}</TextButton>
      {levelOf(prospect.score) === 'cold' ? (
        <TextButton testID="cerrar-solo-consulta" tone="neutral" onPress={() => desk.closeAsConsult(prospect)}>
          Cerrar como solo consulta
        </TextButton>
      ) : null}
    </View>
  );
}

/** The phone's own dialer (never a Lilachat call: the prospect is on WhatsApp, not in the app). */
function CallButton({ phone }: { phone: string }) {
  const colors = useColores();
  return (
    <Pressable testID="llamar-seguimiento" accessibilityRole="button" accessibilityLabel="Llamar" onPress={() => callProspect(phone)} className="h-11 w-11 items-center justify-center rounded-full border border-outline/30">
      <Phone size={ICON} color={colors.primary} />
    </Pressable>
  );
}
