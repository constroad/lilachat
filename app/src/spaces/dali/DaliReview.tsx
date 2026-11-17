import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View, type TextStyle } from 'react-native';
import { ArrowUpRight, Hash } from 'lucide-react-native';
import { REVIEW_TAG_LABEL, reviewFiguresOf, reviewLossesOf, weekReviewOf, type DaliFigureTone, type ProspectView, type ReviewFigure, type ReviewLoss, type ReviewTag } from '@lilachat/shared';
import { Avatar } from '../../ui/Avatar';
import { useColores } from '../../ui/tema';
import { EmptyNote, OutlineButton, Pill, SkeletonRows, TextButton, type PillTone } from './daliParts';
import { fetchReview, type DaliReviewCard, type ProspectList } from './prospectsApi';
import { TeachDaliSheet } from './TeachDaliSheet';

type Props = { jwt: string; spaceId: string; list: ProspectList | null; now: Date; onOpenProspect: (prospect: ProspectView) => void; onOpenChat: (chatId: string) => void };
type Review = ReturnType<typeof weekReviewOf>;
type Asked = Review['questions'][number];
type CardState = { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; review: DaliReviewCard | null };

const KICKER = 'text-[11px] font-bold uppercase tracking-widest text-on-surface-variant';
const TABULAR: TextStyle = { fontVariant: ['tabular-nums'] };
const CONTENT = { padding: 16, paddingBottom: 32, gap: 16 };
const PERSON_AVATAR = 36;
/** Dali's card shows its first fields; the rest is read in #general. */
const CARD_FIELDS_MAX = 4;
const VALUE_INK: Record<DaliFigureTone, string> = { neutral: 'text-on-surface', primary: 'text-primary', ok: 'text-en-linea', error: 'text-error' };
const TAG_TONE: Record<ReviewTag, PillTone> = { late: 'error', following: 'warn', dropped: 'neutral' };
const LOADING: CardState = { kind: 'loading' };

/** The latest review card Dali posted in #general (agentes builds it on Sundays): `null` until it publishes one. */
function useReviewCard(jwt: string, spaceId: string) {
  const [state, setState] = useState<CardState>(LOADING);
  const [round, setRound] = useState(0);
  useEffect(() => {
    let alive = true;
    setState(LOADING);
    void fetchReview(jwt, spaceId).then((answer) => {
      if (alive) setState(answer.ok ? { kind: 'ready', review: answer.data.review } : { kind: 'failed' });
    });
    return () => {
      alive = false;
    };
  }, [jwt, spaceId, round]);
  const retry = useCallback(() => setRound((value) => value + 1), []);
  return { state, retry };
}

/**
 * The weekly review (dl-10 v3): the last whole week in Lima. Won and lost (an ACTION per reason), late answers to a
 * hot prospect, quotes nobody follows, what Dali could not answer (with «Enseñarle a Dali») and the conversations worth
 * reading; Dali's own card in #general beside it, where the team's agreements live as a checklist. Stitch's «Publicar
 * en #ventas», the «causes», the «Revisado» boxes and the WhatsApp Business foot do not go: nothing behind them yet.
 */
export function DaliReview(props: Props) {
  const { list, now } = props;
  const review = useMemo(() => weekReviewOf(list?.prospects ?? [], now), [list, now]);
  const card = useReviewCard(props.jwt, props.spaceId);
  const [teach, setTeach] = useState<Asked | null>(null);
  if (!list) return <View className="p-4"><SkeletonRows /></View>;
  return (
    <View className="flex-1">
      <ScrollView testID="revision-dali" keyboardShouldPersistTaps="handled" contentContainerStyle={CONTENT}>
        <View>
          <Text className={KICKER}>{`Lo que aprendimos · ${review.week.label}`}</Text>
          <Text accessibilityRole="header" className="mt-1 text-[22px] font-extrabold tracking-tight text-on-surface">Revisión de la semana</Text>
        </View>
        <View className="flex-row flex-wrap gap-3">
          {reviewFiguresOf(review, list.admin).map((figure) => <FigureCard key={figure.key} figure={figure} />)}
        </View>
        <LossesBlock losses={reviewLossesOf(review)} />
        <QuestionsBlock questions={review.questions} onTeach={setTeach} />
        <ToReviewBlock items={review.toReview} onOpen={props.onOpenProspect} />
        <TitledCard title="La revisión de Dali">
          <DaliCard state={card.state} onRetry={card.retry} onOpenChat={props.onOpenChat} />
        </TitledCard>
        <Text className="border-t border-outline/15 pt-3 text-[12px] text-on-surface-variant">La semana va de lunes a domingo, en hora de Lima, con los prospectos de este espacio.</Text>
      </ScrollView>
      <TeachDaliSheet visible={teach !== null} jwt={props.jwt} spaceId={props.spaceId} question={teach?.question} asked={teach?.count} onTaught={() => setTeach(null)} onClose={() => setTeach(null)} />
    </View>
  );
}

/** A block of the review and of what Dali knows: its title, then its rows. */
export function TitledCard({ title, children, testID }: { title: string; children: ReactNode; testID?: string }) {
  return (
    <View testID={testID} className="gap-2 rounded-xl border border-outline/15 bg-surface px-4 py-3">
      <Text accessibilityRole="header" className="text-[16px] font-bold text-on-surface">{title}</Text>
      {children}
    </View>
  );
}

const Quiet = ({ children }: { children: string }) => <Text className="text-[14px] text-on-surface-variant">{children}</Text>;

function FigureCard({ figure }: { figure: ReviewFigure }) {
  return (
    <View testID={`revision-${figure.key}`} className="min-w-[45%] flex-1 rounded-xl border border-outline/15 bg-surface px-4 py-3">
      <Text className={KICKER}>{figure.label}</Text>
      <View className="mt-1 flex-row flex-wrap items-center gap-2">
        <Text style={TABULAR} className={`text-[30px] font-extrabold ${VALUE_INK[figure.tone]}`}>{figure.value}</Text>
        {figure.pill ? <Pill tone="ok">{figure.pill}</Pill> : null}
      </View>
      {figure.note ? <Text className="text-[12px] text-on-surface-variant">{figure.note}</Text> : null}
    </View>
  );
}

function LossesBlock({ losses }: { losses: ReviewLoss[] }) {
  return (
    <TitledCard title="Por qué perdimos" testID="revision-por-que">
      {losses.length ? losses.map((loss) => <LossRow key={loss.key} loss={loss} />) : <Quiet>No se perdió ninguno esta semana.</Quiet>}
    </TitledCard>
  );
}

function LossRow({ loss }: { loss: ReviewLoss }) {
  return (
    <View className="rounded-lg border border-outline/15 px-3 py-2.5">
      <View className="flex-row items-center gap-2">
        <Text className="shrink text-[14px] font-bold text-on-surface">{loss.label}</Text>
        <Pill tone="primary">{String(loss.count)}</Pill>
      </View>
      <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-variant/60">
        <View className="h-full rounded-full bg-primary" style={{ width: `${loss.share}%` }} />
      </View>
      <Text className="mt-2 text-[13px] font-semibold text-primary">{`Acción: ${loss.action}`}</Text>
    </View>
  );
}

function QuestionsBlock({ questions, onTeach }: { questions: Asked[]; onTeach: (asked: Asked) => void }) {
  return (
    <TitledCard title="Dali no supo responder">
      {questions.length ? (
        questions.map((one, index) => (
          <View key={one.question} className={`flex-row items-center gap-2 py-2 ${index ? 'border-t border-outline/10' : ''}`}>
            <Text className="min-w-0 flex-1 text-[14px] font-semibold text-on-surface">
              {`«${one.question}» `}
              <Text className="text-[12px] font-normal text-on-surface-variant">{`×${one.count}`}</Text>
            </Text>
            <OutlineButton testID="revision-ensenar" onPress={() => onTeach(one)}>Enseñarle a Dali</OutlineButton>
          </View>
        ))
      ) : (
        <Quiet>Dali respondió todo lo que le preguntaron.</Quiet>
      )}
    </TitledCard>
  );
}

function ToReviewBlock({ items, onOpen }: { items: Review['toReview']; onOpen: (prospect: ProspectView) => void }) {
  return (
    <TitledCard title="Conversaciones para revisar">
      {items.length ? items.map((item, index) => <ToReviewRow key={item.prospect.id} item={item} first={index === 0} onOpen={onOpen} />) : <Quiet>Nada pendiente de revisar.</Quiet>}
    </TitledCard>
  );
}

/** The whole row opens the prospect's ficha; «Leer ↗» says so. */
function ToReviewRow({ item, first, onOpen }: { item: Review['toReview'][number]; first: boolean; onOpen: (prospect: ProspectView) => void }) {
  const colors = useColores();
  return (
    <Pressable testID="revision-leer" accessibilityRole="button" accessibilityLabel={`Leer la conversación de ${item.name}`} onPress={() => onOpen(item.prospect)} className={`min-h-[52px] flex-row items-center gap-3 py-2 ${first ? '' : 'border-t border-outline/10'}`}>
      <Avatar nombre={item.name} tamano={PERSON_AVATAR} />
      <View className="min-w-0 flex-1 flex-row items-center gap-2">
        <Text numberOfLines={1} className="shrink text-[14px] font-bold text-on-surface">{item.name}</Text>
        <Pill tone={TAG_TONE[item.tag]} shrink>{REVIEW_TAG_LABEL[item.tag]}</Pill>
      </View>
      <View className="flex-row items-center gap-1">
        <Text className="text-[14px] font-semibold text-primary">Leer</Text>
        <ArrowUpRight size={16} color={colors.primary} />
      </View>
    </Pressable>
  );
}

/** Dali's own card: loading, failed (with «Reintentar»), not published yet (said plainly), or its first fields. */
function DaliCard({ state, onRetry, onOpenChat }: { state: CardState; onRetry: () => void; onOpenChat: (chatId: string) => void }) {
  const colors = useColores();
  if (state.kind === 'loading') return <SkeletonRows count={1} />;
  if (state.kind === 'failed') return <EmptyNote title="No se pudo leer la revisión de Dali." action={<TextButton testID="reintentar-revision" onPress={onRetry}>Reintentar</TextButton>} />;
  const published = state.review?.card ? { chatId: state.review.chatId, card: state.review.card } : null;
  if (!published) return <EmptyNote title="Dali todavía no publicó su revisión.">Llega a #general el domingo, con lo que pasó en la semana.</EmptyNote>;
  return (
    <View testID="tarjeta-revision-dali" className="gap-2">
      {published.card.kicker ? <Text className={KICKER}>{published.card.kicker}</Text> : null}
      <Text className="text-[15px] font-bold text-on-surface">{published.card.title}</Text>
      {published.card.fields.slice(0, CARD_FIELDS_MAX).map((field) => (
        <View key={field.label} className="flex-row justify-between gap-3">
          <Text className="shrink text-[13px] text-on-surface-variant">{field.label}</Text>
          <Text className="shrink text-right text-[13px] font-semibold text-on-surface">{field.value}</Text>
        </View>
      ))}
      <OutlineButton testID="abrir-revision-general" icon={<Hash size={16} color={colors['on-surface']} />} onPress={() => onOpenChat(published.chatId)}>
        Abrir en #general
      </OutlineButton>
    </View>
  );
}
