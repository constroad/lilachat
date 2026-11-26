import { useMemo, useState } from 'react';
import { ArrowLeft, Bot, CalendarClock, MessageSquare, Phone, Send, ShieldCheck, X } from 'lucide-react';
import { NEXT_ACTION_LABEL, followUpsOf, levelOf, nextActionWhenOf, overdueLabelOf, overdueOf, prospectNameOf, type FollowUpItem, type ProspectView } from '@lilachat/shared';
import { FieldError } from '../../ui/Overlay';
import { EmptyNote, Kicker, OriginPill, OutlineButton, ProspectAvatar, ScorePill, SolidButton, StagePill, TextButton } from './daliParts';
import { NextActionDialog } from './NextActionDialog';
import type { SheetProps } from './ProspectSheet';
import type { ProspectList } from './prospectsApi';
import { sendChange, sendFollowUp, type ChangeOutcome } from './sellerDesk';

type Props = Omit<SheetProps, 'prospect' | 'onOpenConversation'> & { list: ProspectList | null; onOpenProspect: (prospect: ProspectView) => void; onClose: () => void };

/**
 * «Seguimientos de hoy» (dl-05): my next actions due by tonight and the follow-ups Dali drafted, the late ones first.
 * Dali proposes, you approve: a draft leaves only with a seller's OK, edited or as it came. Stitch's daily counter,
 * «Prioridad alta» and the WhatsApp Business foot do not go (no source; Dali is not WhatsApp Business).
 */
export function FollowUpsSheet(props: Props) {
  const { now } = props;
  const followUps = useMemo(() => followUpsOf(props.list?.prospects ?? [], props.me, now), [props.list, props.me, now]);
  const late = followUps.items.filter((item) => Date.parse(item.at) < now.getTime());
  const today = followUps.items.filter((item) => Date.parse(item.at) >= now.getTime());
  return (
    <div data-testid="seguimientos-hoy" className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b border-outline/15 bg-surface px-2 py-2">
        {props.phone ? <button type="button" aria-label="Volver" onClick={props.onClose} className="grid h-11 w-11 place-items-center rounded-full hover:bg-background"><ArrowLeft size={20} /></button> : null}
        <span className={`min-w-0 flex-1 ${props.phone ? '' : 'pl-2'}`}>
          <Kicker className="text-primary">Dali</Kicker>
          <span className="block text-base font-extrabold tracking-tight">Seguimientos de hoy</span>
        </span>
        {props.phone ? null : <button type="button" aria-label="Cerrar" onClick={props.onClose} className="grid h-11 w-11 place-items-center rounded-full text-on-surface-variant hover:bg-background"><X size={20} /></button>}
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <p className="flex items-center gap-2 rounded-xl border border-outline/15 bg-surface px-3 py-2.5 text-[13px]">
          <ShieldCheck size={18} className="shrink-0 text-primary" />
          <span><span className="font-bold">Dali propone, tú apruebas.</span> Nada se le envía al cliente sin tu OK.</span>
        </p>
        {followUps.items.length === 0 ? <EmptyNote title="Nada pendiente para hoy.">Lo que agendes o lo que Dali proponga para hoy aparece aquí.</EmptyNote> : null}
        <Group title={`Atrasados · ${late.length}`} danger items={late} {...props} />
        <Group title={`Para hoy · ${today.length}`} items={today} {...props} />
      </div>
    </div>
  );
}

function Group(props: Props & { title: string; danger?: boolean; items: FollowUpItem[] }) {
  if (props.items.length === 0) return null;
  return (
    <section className="space-y-2.5">
      <Kicker className={props.danger ? 'text-error' : ''}>{props.title}</Kicker>
      {props.items.map((item) => <FollowUpCard key={`${item.prospect.id}-${item.kind}`} {...props} item={item} danger={props.danger} />)}
    </section>
  );
}

function FollowUpCard(props: Props & { item: FollowUpItem; danger?: boolean }) {
  const { prospect } = props.item;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(prospect.followUpDraft?.text ?? '');
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const settle = (outcome: ChangeOutcome) => {
    setPlanning(false);
    if (outcome.ok) return props.onChanged(outcome.prospect);
    if (outcome.stale) props.onStale();
    setError(outcome.message);
  };
  const run = async (work: () => Promise<ChangeOutcome>) => {
    setBusy(true);
    setError('');
    settle(await work());
    setBusy(false);
  };
  const isDraft = props.item.kind === 'draft' && Boolean(prospect.followUpDraft);
  return (
    <article data-testid={`seguimiento-${prospect.id}`} className={`rounded-xl border border-outline/15 bg-surface px-4 py-3 ${props.danger ? 'shadow-[inset_3px_0_0_rgb(var(--c-error))]' : 'shadow-[inset_3px_0_0_rgb(var(--c-primary))]'}`}>
      <CardHead prospect={prospect} />
      <Why prospect={prospect} item={props.item} now={props.now} />
      {isDraft ? (
        <div className="mt-2 rounded-lg border border-outline/15 bg-surface-variant/30 px-3 py-2">
          <Kicker className="flex items-center gap-1.5 text-primary"><Bot size={14} /> Borrador de Dali</Kicker>
          {editing ? <textarea data-testid="editar-borrador" value={text} maxLength={1000} rows={4} onChange={(event) => setText(event.target.value)} className="mt-1 w-full resize-none rounded-lg border border-outline/30 bg-surface px-2 py-1.5 text-sm" /> : <p className="mt-1 text-sm leading-5">{`«${prospect.followUpDraft!.text}»`}</p>}
        </div>
      ) : null}
      <FieldError>{error}</FieldError>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {isDraft ? <SolidButton testId="enviar-borrador" disabled={busy || !text.trim()} onClick={() => void run(() => sendFollowUp(props.jwt, props.spaceId, prospect, text.trim()))}><Send size={16} /> Enviar</SolidButton> : null}
        {isDraft && !editing ? <OutlineButton testId="editar-seguimiento" onClick={() => setEditing(true)}>Editar</OutlineButton> : null}
        {prospect.phone ? <a href={`tel:+${prospect.phone}`} aria-label="Llamar" className="grid h-10 w-10 place-items-center rounded-full border border-outline/30 text-primary hover:bg-background"><Phone size={16} /></a> : null}
        <TextButton testId="reprogramar-seguimiento" tone="neutral" onClick={() => setPlanning(true)}><CalendarClock size={14} /> {prospect.nextAction ? 'Reprogramar' : 'Agendar'}</TextButton>
        <TextButton tone="neutral" onClick={() => props.onOpenProspect(prospect)}><MessageSquare size={14} /> Conversación</TextButton>
        {levelOf(prospect.score) === 'cold' ? <TextButton testId="cerrar-solo-consulta" tone="neutral" onClick={() => void run(() => sendChange(props.jwt, props.spaceId, prospect, { result: { outcome: 'lost', reason: 'not_a_buyer' } }))}>Cerrar como solo consulta</TextButton> : null}
      </div>
      {planning ? <NextActionDialog jwt={props.jwt} spaceId={props.spaceId} prospect={prospect} now={props.now} onDone={settle} onClose={() => setPlanning(false)} /> : null}
    </article>
  );
}

function CardHead({ prospect }: { prospect: ProspectView }) {
  const name = prospectNameOf(prospect);
  return (
    <div className="flex items-start gap-3">
      <ProspectAvatar name={name} size="lg" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold">{name}</span>
        {prospect.service ? <span className="block truncate text-[13px] text-on-surface-variant">{prospect.service.name}</span> : null}
        <span className="mt-1.5 flex flex-wrap gap-1.5"><OriginPill prospect={prospect} /><ScorePill score={prospect.score} /><StagePill prospect={prospect} /></span>
      </span>
    </div>
  );
}

/** Why it is here: what is late on it, or the next action that is due. */
function Why({ prospect, item, now }: { prospect: ProspectView; item: FollowUpItem; now: Date }) {
  const overdue = overdueOf(prospect, now);
  const action = item.kind === 'action' && prospect.nextAction ? `${NEXT_ACTION_LABEL[prospect.nextAction.kind]} · ${nextActionWhenOf(prospect.nextAction.at, now)}` : null;
  const text = action ?? (overdue ? overdueLabelOf(overdue, now) : 'Dali propone escribirle hoy');
  return (
    <p className={`mt-2 flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-[13px] ${overdue ? 'border-error/30 bg-error/5 text-error' : 'border-outline/15'}`}>
      <span className="min-w-0 truncate">{text}</span>
      {prospect.assignee ? <span className="shrink-0 text-on-surface-variant">{`Atiende ${prospect.assignee.name.split(' ')[0]}`}</span> : null}
    </p>
  );
}
