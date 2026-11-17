import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { MessageSquare, RotateCcw, UserX } from 'lucide-react-native';
import { prospectNameOf, reassignChoicesOf, type ChangeOutcome, type ProspectView, type SellerPatch } from '@lilachat/shared';
import { Avatar } from '../../ui/Avatar';
import { PantallaEnModal } from '../../ui/PantallaEnModal';
import { Sheet } from '../../ui/Sheet';
import { useColores } from '../../ui/tema';
import { useDisposicion } from '../../ui/useDisposicion';
import { memberName } from '../memberUi';
import { fetchMembers, membersCache, useCached } from '../spaceCache';
import { notify, OutlineButton, SolidButton, TextButton } from './daliParts';
import { NextActionSheet } from './NextActionSheet';
import { AttendsLine, Card, ContactCard, Kicker, NextActionCard, OriginCard, QuoteCard, ScoreCard, SheetTitle, StageCard, UnderstoodCard, useCenteredContent } from './prospectSheetBlocks';
import { ResultSheet } from './ResultSheet';
import { sendChange, sendHandBack } from './sellerDesk';

type Dialog = 'next' | 'result' | 'reassign' | null;
type OnChanged = (prospect: ProspectView) => void;

const MEMBER_AVATAR = 36;
const SKELETON_MEMBERS = 3;

/** A change that came back: the new prospect shows at once; a refusal is told, and a stale one read again. */
export function applyOutcome(outcome: ChangeOutcome, onChanged: OnChanged, onStale: () => void): void {
  if (outcome.ok) return onChanged(outcome.prospect);
  notify(outcome.message);
  if (outcome.stale) onStale();
}

/** One change at a time: a second tap while the first is on its way would come back as «someone was first». */
export function useOneChangeAtATime(onChanged: OnChanged, onStale: () => void) {
  const busy = useRef(false);
  return useCallback(
    async (send: () => Promise<ChangeOutcome>): Promise<void> => {
      if (busy.current) return;
      busy.current = true;
      try {
        applyOutcome(await send(), onChanged, onStale);
      } finally {
        busy.current = false;
      }
    },
    [onChanged, onStale]
  );
}

type Props = { visible: boolean; prospect: ProspectView | null; jwt: string; spaceId: string; me: string; now: Date; onChanged: OnChanged; onStale: () => void; onClose: () => void; onOpenConversation: (prospect: ProspectView) => void };

/**
 * The ficha of a prospect (dl-03), full screen with ←: contact, origin, Dali's score with its reasons, what Dali
 * understood, the quote, the stage, who attends it, the next action and the result. The decisions are the seller's
 * (version-checked PATCH); what Dali knows is read only. On the phone «Marcar resultado» lives here, at its foot.
 */
export function ProspectSheetScreen(props: Props) {
  const { prospect, jwt, spaceId } = props;
  const [dialog, setDialog] = useState<Dialog>(null);
  const run = useOneChangeAtATime(props.onChanged, props.onStale);
  // It lives mounted: another prospect, or opening it again, never finds a form of the last one open.
  useEffect(() => {
    setDialog(null);
  }, [props.visible, prospect?.id]);
  const close = () => setDialog(null);
  const settle = (outcome: ChangeOutcome) => {
    setDialog(null);
    applyOutcome(outcome, props.onChanged, props.onStale);
  };
  const change = (patch: SellerPatch) => {
    if (prospect) void run(() => sendChange(jwt, spaceId, prospect, patch));
  };
  const handBack = () => {
    if (prospect) void run(() => sendHandBack(jwt, spaceId, prospect));
  };
  const reassign = (assignee: SellerPatch['assignee']) => {
    close();
    change({ assignee });
  };
  const footer = prospect ? <SheetFooter prospect={prospect} onResult={() => setDialog('result')} onReopen={() => change({ result: null })} onOpenConversation={() => props.onOpenConversation(prospect)} /> : undefined;

  return (
    <>
      <PantallaEnModal visible={props.visible && prospect !== null} titulo={prospect ? prospectNameOf(prospect) : ''} onCerrar={props.onClose} testIDCerrar="cerrar-ficha" footer={footer}>
        {prospect ? <SheetBody prospect={prospect} now={props.now} onTake={() => change({ assignee: 'me' })} onReassign={() => setDialog('reassign')} onHandBack={handBack} onPlan={() => setDialog('next')} /> : null}
      </PantallaEnModal>
      <ReassignSheet visible={dialog === 'reassign'} jwt={jwt} spaceId={spaceId} me={props.me} prospect={prospect} onPick={reassign} onClose={close} />
      <NextActionSheet visible={dialog === 'next'} jwt={jwt} spaceId={spaceId} prospect={prospect} now={props.now} onDone={settle} onClose={close} />
      <ResultSheet visible={dialog === 'result'} jwt={jwt} spaceId={spaceId} prospect={prospect} onDone={settle} onClose={close} />
    </>
  );
}

type BodyProps = { prospect: ProspectView; now: Date; onTake: () => void; onReassign: () => void; onHandBack: () => void; onPlan: () => void };

function SheetBody({ prospect, now, ...actions }: BodyProps) {
  const centered = useCenteredContent();
  return (
    <View testID="ficha-prospecto" style={centered} className="gap-3">
      <ContactCard prospect={prospect} />
      <OriginCard prospect={prospect} />
      <ScoreCard prospect={prospect} />
      <UnderstoodCard prospect={prospect} />
      {prospect.quote ? <QuoteCard quote={prospect.quote} kicker="Cotización" testID="ficha-cotizacion" amountTestID="monto-cotizacion" /> : null}
      <StageCard prospect={prospect} />
      <AttendsCard prospect={prospect} onTake={actions.onTake} onReassign={actions.onReassign} onHandBack={actions.onHandBack} />
      {prospect.result ? null : <NextActionCard prospect={prospect} now={now} onPlan={actions.onPlan} />}
    </View>
  );
}

/** Taking one is free (agentes 16/11): anyone takes it; whoever has it passes it on or lets it go. */
function AttendsCard({ prospect, onTake, onReassign, onHandBack }: Pick<BodyProps, 'prospect' | 'onTake' | 'onReassign' | 'onHandBack'>) {
  return (
    <Card testID="ficha-atiende">
      <Kicker>Atiende</Kicker>
      <View className="mt-2 flex-row items-center gap-2">
        <View className="min-w-0 flex-1">
          <AttendsLine prospect={prospect} />
        </View>
        {prospect.assignee ? <OutlineButton testID="reasignar-prospecto" onPress={onReassign}>Reasignar</OutlineButton> : <SolidButton testID="tomar-prospecto" onPress={onTake}>Tomar</SolidButton>}
      </View>
      {prospect.attendedBy === 'human' ? (
        <View className="mt-2 flex-row items-center gap-2 border-t border-outline/10 pt-2">
          <Text className="min-w-0 flex-1 text-[13px] text-on-surface-variant">Dali está en pausa: le contesta una persona.</Text>
          <TextButton testID="devolver-a-dali" onPress={onHandBack}>Devolver a Dali</TextButton>
        </View>
      ) : null}
    </Card>
  );
}

/** Its conversation, and the result: «Marcar resultado» while open; «Reabrir» and «Cambiar resultado» once closed. */
function SheetFooter(props: { prospect: ProspectView; onResult: () => void; onReopen: () => void; onOpenConversation: () => void }) {
  const colors = useColores();
  const { amplia } = useDisposicion();
  const centered = useCenteredContent();
  const closed = (
    <View className={`flex-row gap-2 ${amplia ? 'flex-1' : ''}`}>
      <OutlineButton wide testID="reabrir-prospecto" icon={<RotateCcw size={18} color={colors['on-surface']} />} onPress={props.onReopen}>Reabrir</OutlineButton>
      <OutlineButton wide testID="cambiar-resultado" onPress={props.onResult}>Cambiar resultado</OutlineButton>
    </View>
  );
  return (
    <View style={centered} className={`gap-2 ${amplia ? 'flex-row' : ''}`}>
      <OutlineButton wide={amplia} testID="abrir-conversacion" icon={<MessageSquare size={18} color={colors['on-surface']} />} onPress={props.onOpenConversation}>Abrir conversación</OutlineButton>
      {props.prospect.result ? closed : <SolidButton wide={amplia} testID="marcar-resultado" onPress={props.onResult}>Marcar resultado</SolidButton>}
    </View>
  );
}

type ReassignProps = { visible: boolean; jwt: string; spaceId: string; me: string; prospect: ProspectView | null; onPick: (assignee: SellerPatch['assignee']) => void; onClose: () => void };

/** «Reasignar» (the web's menu, as a sheet on the phone): take it, pass it to a member, or leave it unassigned. */
function ReassignSheet(props: ReassignProps) {
  const colors = useColores();
  const directory = useCached(membersCache, `${props.spaceId}:members`, fetchMembers(props.jwt, props.spaceId), props.visible);
  const { prospect } = props;
  const choices = prospect ? reassignChoicesOf(directory.value ?? [], prospect, props.me) : null;
  return (
    <Sheet visible={props.visible && choices !== null} onClose={props.onClose} testID="hoja-reasignar" className="max-h-[80%]" dragArea="handle" bottomRoom={8}>
      {prospect && choices ? (
        <>
          <SheetTitle kicker="Reasignar" title={prospectNameOf(prospect)} onClose={props.onClose} />
          <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled">
            <View className="py-2">
              {choices.takeIt ? <Choice testID="tomarlo-yo" label="Tomarlo yo" onPress={() => props.onPick('me')} /> : null}
              {choices.members.map((member) => (
                <Choice key={member.id} testID={`reasignar-a-${member.userId}`} label={memberName(member)} lead={<Avatar nombre={memberName(member)} foto={member.avatarUrl} tamano={MEMBER_AVATAR} />} onPress={() => props.onPick({ id: member.userId })} />
              ))}
              <MembersState loaded={directory.value !== undefined} empty={choices.members.length === 0} error={directory.error} onRetry={directory.refresh} />
              <View className="my-1 h-px bg-outline/15" />
              <Choice testID="soltar-prospecto" label="Dejarlo sin asignar" lead={<UserX size={20} color={colors['on-surface-variant']} />} onPress={() => props.onPick(null)} />
            </View>
          </ScrollView>
        </>
      ) : null}
    </Sheet>
  );
}

function Choice({ label, onPress, testID, lead }: { label: string; onPress: () => void; testID: string; lead?: ReactNode }) {
  const colors = useColores();
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} android_ripple={{ color: colors.outline }} className="min-h-[52px] flex-row items-center gap-3 px-5">
      {lead}
      <Text numberOfLines={1} className="min-w-0 flex-1 text-[16px] text-on-surface">{label}</Text>
    </Pressable>
  );
}

/** While the directory loads, rows of its height; if it failed, why, and «Reintentar»; loaded and alone, says so. */
function MembersState({ loaded, empty, error, onRetry }: { loaded: boolean; empty: boolean; error?: string; onRetry: () => void }) {
  if (loaded) return empty ? <Text testID="sin-miembros" className="px-5 py-2 text-[13px] text-on-surface-variant">No hay otros miembros con cuenta en el espacio.</Text> : null;
  if (error) {
    return (
      <View testID="error-miembros" className="flex-row items-center gap-2 px-5 py-1">
        <Text className="min-w-0 flex-1 text-[13px] text-error">{error}</Text>
        <TextButton testID="reintentar-miembros" onPress={onRetry}>Reintentar</TextButton>
      </View>
    );
  }
  return (
    <View testID="esqueleto-miembros" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="gap-2 px-5 py-1">
      {Array.from({ length: SKELETON_MEMBERS }, (_, index) => (
        <View key={index} className="h-11 rounded-xl bg-surface-variant/40" />
      ))}
    </View>
  );
}
