import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { ChevronDown, ChevronUp, ClipboardList, EyeOff, Send, X } from 'lucide-react-native';
import { canCloseAll, ephemeralLabel, ephemeralSummary, openAnswerId, toggleAnswer, type EphemeralAnswer, type StackChoice } from '@lilachat/shared';
import { Avatar } from '../../ui/Avatar';
import { AppLogo } from '../../spaces/apps/AppLogo';
import { useColores } from '../../ui/tema';
import { BotCardView } from '../BotCardView';
import { TextoConEnlaces } from '../TextoConEnlaces';

const APP_AVATAR = 22;
/** The answers never take more than this share of the screen: the conversation stays in sight. */
const MAX_SCREEN_SHARE = 0.45;
type Props = { answers: readonly EphemeralAnswer[]; onDismiss: (commandId: string) => void; onShare?: (commandId: string) => Promise<string | null>; onOpenForm?: (commandId: string) => void; chatId: string; jwt: string; /** Inside a sheet (the ⚡): it grows with its content instead of capping at the screen. */ embedded?: boolean; /** The command panel is open: with the keyboard up there is no room left, so the stack steps aside until it closes (E2E 28/10). */ hidden?: boolean };

/**
 * What an app answered only to me (§c-bis), over the bar like Slack's
 * «Only visible to you»: never stored, gone when the chat closes. Since
 * pending 104 (José, 28/10, design c-01) a stack of chips like Claude's: the
 * newest open, the rest folded in one line, each with its X and «Cerrar todas»
 * on top. A card here has no actions to tap: there is no message behind it.
 * In a channel, «Enviar al canal» has the app post it there (José, 23/10).
 */
export function EphemeralAnswers(props: Props) {
  const colors = useColores();
  const { height } = useWindowDimensions();
  const scroll = useRef<ScrollView>(null);
  const [choice, setChoice] = useState<StackChoice>({ open: null, newest: null });
  if (props.answers.length === 0 || props.hidden) return null;
  const openId = openAnswerId(props.answers, choice);
  // A tall open card shows from its head (with its X), not from its end. It is measured after it grows
  // (a placeholder swapped for the answer, a card that loads), so it scrolls itself into view from its own layout.
  const placeAnswer = (commandId: string, top: number) => {
    if (commandId === openId) scroll.current?.scrollTo({ y: top, animated: true });
  };
  const toggle = (commandId: string) => setChoice((current) => toggleAnswer(props.answers, current, commandId));
  return (
    <View testID="respuestas-efimeras" className="border-t border-outline/10 bg-surface px-3 pb-2" style={props.embedded ? undefined : { maxHeight: height * MAX_SCREEN_SHARE }}>
      <View className="min-h-[36px] flex-row items-center gap-1.5">
        <EyeOff size={14} color={colors['on-surface-variant']} />
        <Text className="flex-1 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">{`Solo tú ves esto · ${props.answers.length}`}</Text>
        {canCloseAll(props.answers) ? (
          <Pressable testID="btn-cerrar-todas-efimeras" hitSlop={8} onPress={() => props.answers.forEach((answer) => props.onDismiss(answer.commandId))}>
            <Text className="text-[13px] font-semibold text-primary">Cerrar todas</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled" ref={scroll}>
        {props.answers.map((answer) => (
          <View key={answer.commandId} testID={`efimera-${answer.state}`} onLayout={(event) => placeAnswer(answer.commandId, event.nativeEvent.layout.y)} className="rounded-2xl border border-outline/15 bg-background px-3">
            <AnswerHead answer={answer} open={answer.commandId === openId} onToggle={() => toggle(answer.commandId)} onDismiss={() => props.onDismiss(answer.commandId)} />
            {answer.commandId === openId ? <AnswerBody answer={answer} {...props} /> : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/** One line: logo, app, the /command and, folded, what it said; the chevron opens or folds it, the X dismisses it. */
function AnswerHead(props: { answer: EphemeralAnswer; open: boolean; onToggle: () => void; onDismiss: () => void }) {
  const colors = useColores();
  const { answer } = props;
  const Chevron = props.open ? ChevronUp : ChevronDown;
  return (
    <View className="min-h-[44px] flex-row items-center gap-2">
      <Pressable testID={`efimera-plegar-${answer.commandId}`} accessibilityLabel={props.open ? 'Plegar' : 'Abrir'} onPress={props.onToggle} className="min-w-0 flex-1 flex-row items-center gap-2 self-stretch">
        {answer.avatarUrl ? <AppLogo avatarUrl={answer.avatarUrl} size={APP_AVATAR} /> : <Avatar nombre={answer.appName} tamano={APP_AVATAR} bot />}
        <Text className="text-[14px] font-semibold text-on-surface" numberOfLines={1}>{answer.appName}</Text>
        {ephemeralLabel(answer) ? <Text className={`text-[13px] text-primary ${answer.action ? 'font-semibold' : 'font-mono'}`} numberOfLines={1}>{ephemeralLabel(answer)}</Text> : null}
        <Text className={`min-w-0 flex-1 text-[13px] ${answer.state === 'failed' ? 'text-error' : 'text-on-surface-variant'}`} numberOfLines={1}>{props.open ? '' : ephemeralSummary(answer)}</Text>
        <Chevron size={16} color={colors['on-surface-variant']} />
      </Pressable>
      <Pressable testID="btn-descartar-efimera" accessibilityLabel="Descartar" onPress={props.onDismiss} hitSlop={8} className="h-8 w-8 items-center justify-center">
        <X size={16} color={colors['on-surface-variant']} />
      </Pressable>
    </View>
  );
}

function AnswerBody(props: Props & { answer: EphemeralAnswer }) {
  const colors = useColores();
  const { answer } = props;
  return (
    <View className="border-t border-outline/10 pb-2.5 pt-2">
      {answer.state === 'pending' ? (
        <View testID="efimera-pensando" className="flex-row items-center gap-2">
          <ActivityIndicator size="small" color={colors.primary} />
          <Text className="text-[14px] italic text-on-surface-variant">{`${answer.appName} está trabajando…`}</Text>
        </View>
      ) : null}
      {answer.state === 'failed' ? <Text className="text-[14px] text-error">{answer.message}</Text> : null}
      {answer.state === 'form' && props.onOpenForm ? (
        <Pressable testID="btn-abrir-formulario" onPress={() => props.onOpenForm!(answer.commandId)} className="min-h-[40px] flex-row items-center gap-1.5 self-start rounded-xl border border-outline/25 px-3">
          <ClipboardList size={15} color={colors.primary} />
          <Text className="text-[14px] font-semibold text-primary">{`Abrir «${answer.response?.form?.title ?? 'formulario'}»`}</Text>
        </Pressable>
      ) : null}
      {answer.response?.text ? (
        <Text selectable className="text-[15px] text-on-surface">
          <TextoConEnlaces texto={answer.response.text} />
        </Text>
      ) : null}
      {answer.response?.card ? (
        <View className="mt-2">
          <BotCardView card={{ ...answer.response.card, actions: [] }} chatId={props.chatId} seq={0} jwt={props.jwt} />
        </View>
      ) : null}
      {/* shareable:false (R160): a debt or a salary is only for whoever asked. */}
      {props.onShare && answer.state === 'answered' && answer.response?.shareable !== false ? <ShareAnswer onShare={() => props.onShare!(answer.commandId)} /> : null}
    </View>
  );
}

function ShareAnswer(props: { onShare: () => Promise<string | null> }) {
  const colors = useColores();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const send = async () => {
    setBusy(true);
    const reason = await props.onShare();
    setBusy(false);
    setError(reason ?? '');
  };
  return (
    <View className="mt-2 flex-row items-center gap-3">
      <Text className="min-w-0 flex-1 text-[12px] italic text-on-surface-variant" numberOfLines={2}>{error || 'Los demás no lo ven'}</Text>
      <Pressable testID="btn-enviar-al-canal" disabled={busy} onPress={() => void send()} className={`min-h-[40px] flex-row items-center gap-1.5 rounded-xl border border-outline/25 px-3 ${busy ? 'opacity-50' : ''}`}>
        <Send size={15} color={colors.primary} />
        <Text className="text-[14px] font-semibold text-primary">{busy ? 'Enviando…' : 'Enviar al canal'}</Text>
      </Pressable>
    </View>
  );
}
