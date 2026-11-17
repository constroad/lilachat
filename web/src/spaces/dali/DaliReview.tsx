import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowUpRight, Hash } from 'lucide-react';
import { REVIEW_TAG_LABEL, moneyOf, weekReviewOf, type ProspectView, type ReviewTag } from '@lilachat/shared';
import { EmptyNote, Kicker, OutlineButton, Pill, ProspectAvatar, SkeletonRows, TextButton } from './daliParts';
import { fetchReview, type DaliReviewCard, type ProspectList } from './prospectsApi';
import { TeachDaliDialog } from './TeachDaliDialog';

type Props = { jwt: string; spaceId: string; list: ProspectList | null; now: Date; phone?: boolean; onOpenProspect: (prospect: ProspectView) => void; onOpenChat: (chatId: string) => void; onNotice: (text: string) => void };
type Review = ReturnType<typeof weekReviewOf>;
const TAG_TONE: Record<ReviewTag, 'error' | 'warn' | 'neutral'> = { late: 'error', following: 'warn', dropped: 'neutral' };

/**
 * The weekly review (dl-10 v3): the last whole week in Lima. Won and lost (an ACTION per reason), late answers to a
 * hot prospect, quotes nobody follows, what Dali could not answer (with «Enseñarle a Dali») and the conversations worth
 * reading. Dali's own card in #general goes beside it. Stitch's «Publicar en #ventas», the «causes», the «Revisado»
 * boxes and the WhatsApp Business foot do not go: nothing behind them yet.
 */
export function DaliReview(props: Props) {
  const { list, now } = props;
  const review = useMemo(() => weekReviewOf(list?.prospects ?? [], now), [list, now]);
  const [card, setCard] = useState<DaliReviewCard | null>(null);
  const [teach, setTeach] = useState<{ question: string; count: number } | null>(null);
  useEffect(() => {
    void fetchReview(props.jwt, props.spaceId).then((answer) => setCard(answer.ok ? answer.data.review : null));
  }, [props.jwt, props.spaceId]);
  if (!list) return <div className="p-4"><SkeletonRows /></div>;
  return (
    <div data-testid="revision-dali" className="space-y-4 px-4 py-4 sm:px-6">
      <div>
        <Kicker>{`Lo que aprendimos · ${review.week.label}`}</Kicker>
        <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">Revisión de la semana</h2>
      </div>
      <Figures review={review} admin={list.admin} />
      <div className={`grid gap-4 ${props.phone ? '' : 'lg:grid-cols-2'}`}>
        <Block title="Por qué perdimos">
          {review.lost.reasons.length ? review.lost.reasons.map((reason) => (
            <div key={reason.key} className="rounded-lg border border-outline/15 px-3 py-2.5">
              <p className="flex items-center gap-2 text-sm font-bold">{reason.label}<Pill tone="primary">{reason.count}</Pill></p>
              <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface-variant/60"><span className="block h-full rounded-full bg-primary" style={{ width: `${(reason.count / review.lost.count) * 100}%` }} /></span>
              <p className="mt-2 text-[13px] font-semibold text-primary">{`Acción: ${reason.action}`}</p>
            </div>
          )) : <p className="text-sm text-on-surface-variant">No se perdió ninguno esta semana.</p>}
        </Block>
        <Block title="Dali no supo responder">
          {review.questions.length ? review.questions.map((one) => (
            <div key={one.question} className="flex items-center gap-2 border-b border-outline/10 py-2 last:border-b-0">
              <p className="min-w-0 flex-1 text-sm font-semibold">{`«${one.question}»`} <span className="text-[12px] font-normal text-on-surface-variant">{`×${one.count}`}</span></p>
              <OutlineButton testId="revision-ensenar" onClick={() => setTeach(one)}>Enseñarle a Dali</OutlineButton>
            </div>
          )) : <p className="text-sm text-on-surface-variant">Dali respondió todo lo que le preguntaron.</p>}
        </Block>
        <Block title="Conversaciones para revisar">
          {review.toReview.length ? review.toReview.map((item) => (
            <div key={item.prospect.id} className="flex items-center gap-3 border-b border-outline/10 py-2 last:border-b-0">
              <ProspectAvatar name={item.name} />
              <span className="flex min-w-0 flex-1 items-center gap-2"><span className="truncate text-sm font-bold">{item.name}</span><Pill tone={TAG_TONE[item.tag]}>{REVIEW_TAG_LABEL[item.tag]}</Pill></span>
              <TextButton onClick={() => props.onOpenProspect(item.prospect)}>Leer <ArrowUpRight size={14} /></TextButton>
            </div>
          )) : <p className="text-sm text-on-surface-variant">Nada pendiente de revisar.</p>}
        </Block>
        <DaliCard card={card} onOpenChat={props.onOpenChat} />
      </div>
      <p className="border-t border-outline/15 pt-3 text-[12px] text-on-surface-variant">La semana va de lunes a domingo, en hora de Lima, con los prospectos de este espacio.</p>
      {teach ? <TeachDaliDialog jwt={props.jwt} spaceId={props.spaceId} question={teach.question} asked={teach.count} onClose={() => setTeach(null)} onTaught={() => { setTeach(null); props.onNotice('Dali ya tiene esa respuesta.'); }} /> : null}
    </div>
  );
}

function Figures({ review, admin }: { review: Review; admin: boolean }) {
  const won = review.won.amounts.map((one) => (one.currency === 'PEN' ? moneyOf(one.amount) : `${one.currency} ${one.amount.toFixed(2)}`)).join(' + ');
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Figure testId="revision-ganados" label="Ganados" value={review.won.count} pill={admin && won ? won : undefined} note={review.won.by.length ? `Cerró ${review.won.by.join(', ')}` : undefined} />
      <Figure testId="revision-perdidos" label="Se perdieron" value={review.lost.count} />
      <Figure testId="revision-tarde" label="Respondimos tarde" value={review.late.count} note="A un caliente, después de 15 min" />
      <Figure testId="revision-sin-seguimiento" label="Cotizaciones sin seguimiento" value={review.quotesWithoutFollowUp.count} note={review.quotesWithoutFollowUp.late ? `${review.quotesWithoutFollowUp.late} sin respuesta hace más de 3 días` : undefined} />
      <Figure testId="revision-no-supo" label="Dali no supo responder" value={review.questions.reduce((total, one) => total + one.count, 0)} />
    </div>
  );
}

function Figure({ label, value, pill, note, testId }: { label: string; value: number; pill?: string; note?: string; testId: string }) {
  return (
    <div data-testid={testId} className="rounded-xl border border-outline/15 bg-surface px-4 py-3">
      <Kicker>{label}</Kicker>
      <p className="mt-1 flex items-center gap-2"><span className="text-3xl font-extrabold tabular-nums">{value}</span>{pill ? <Pill tone="ok">{pill}</Pill> : null}</p>
      {note ? <p className="text-[12px] text-on-surface-variant">{note}</p> : null}
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 space-y-2 rounded-xl border border-outline/15 bg-surface px-4 py-3">
      <h3 className="text-base font-bold">{title}</h3>
      {children}
    </section>
  );
}

/** The latest review card Dali posted in #general (agentes builds it on Sundays), with a way to open it. */
function DaliCard({ card, onOpenChat }: { card: DaliReviewCard | null; onOpenChat: (chatId: string) => void }) {
  return (
    <Block title="La revisión de Dali">
      {card?.card ? (
        <div className="space-y-2">
          {card.card.kicker ? <Kicker>{card.card.kicker}</Kicker> : null}
          <p className="text-sm font-bold">{card.card.title}</p>
          {card.card.fields.slice(0, 4).map((field) => <p key={field.label} className="flex justify-between gap-3 text-[13px]"><span className="text-on-surface-variant">{field.label}</span><span className="font-semibold">{field.value}</span></p>)}
          <OutlineButton testId="abrir-revision-general" onClick={() => onOpenChat(card.chatId)}><Hash size={16} /> Abrir en #general</OutlineButton>
        </div>
      ) : <EmptyNote title="Dali todavía no publicó su revisión.">Llega a #general el domingo, con lo que pasó en la semana.</EmptyNote>}
    </Block>
  );
}
