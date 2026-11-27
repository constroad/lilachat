import { useContext, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Bell, BellRing, CheckCircle2, ChevronRight, MessageCircle, Phone, RotateCcw } from 'lucide-react';
import { LOSS_REASON_LABEL, prospectNameOf, shownProspectPhone, stripReminderOf, type ProspectView } from '@lilachat/shared';
import type { OwnHeader } from '../../chat/Conversation';
import { OriginPill, OutlineButton, Pill, ProspectAvatar, SheetInColumn, SolidButton, TextButton } from './daliParts';
import { NextActionDialog } from './NextActionDialog';
import { ProspectSheet } from './ProspectSheet';
import { ResultDialog } from './ResultDialog';
import { sendChange, sendHandBack, useProspectOfChat, type ChangeOutcome } from './sellerDesk';

type Props = {
  jwt: string;
  spaceId: string;
  chatId: string;
  /** The channel's name: the header's initials while the prospect loads. */
  chatName?: string;
  me: string;
  phone?: boolean;
  onNotice: (text: string) => void;
};

export type ProspectChatParts = { ownHeader: OwnHeader; strip: ReactNode };

/** Keeps the header's height while the prospect loads: the line under the name never comes and goes. */
const NO_LINE = ' ';

/**
 * A prospect's conversation (dl-01 v3, dl-02), read once by its chat (a phone has no inbox on screen). The header gets
 * the client's initials, phone and origin, «Llamar» (the phone's dialer, never a Lilachat call), the ficha and
 * «Marcar resultado»; the strip under it says who attends it and whether Dali is paused, with «Tomar» and «Devolver a
 * Dali».
 */
export function ProspectChat(props: Props & { children: (parts: ProspectChatParts) => ReactNode }) {
  const { prospect, setProspect, reload } = useProspectOfChat(props.jwt, props.spaceId, props.chatId);
  const [open, setOpen] = useState<'sheet' | 'result' | 'next' | null>(null);
  const [now] = useState(() => new Date());
  // A wide inbox shows the ficha in its third column; elsewhere it opens from the header.
  const inColumn = useContext(SheetInColumn);
  useEffect(() => {
    setOpen(null);
  }, [props.chatId]);
  const settle = (outcome: ChangeOutcome) => {
    if (open === 'result' || open === 'next') setOpen(null);
    if (outcome.ok) return setProspect(outcome.prospect);
    props.onNotice(outcome.message);
    if (outcome.stale) reload();
  };
  const parts: ProspectChatParts = prospect
    ? {
        ownHeader: { avatar: <HeaderInitials name={prospectNameOf(prospect)} phone={props.phone} />, subtitle: <HeaderLine prospect={prospect} />, actions: <HeaderActions phone={props.phone} withSheet={inColumn} prospect={prospect} onSheet={() => setOpen('sheet')} onResult={() => setOpen('result')} /> },
        strip: <Strip prospect={prospect} phone={props.phone} now={now} onRemind={() => setOpen('next')} onTake={async () => settle(await sendChange(props.jwt, props.spaceId, prospect, { assignee: 'me' }))} onHandBack={async () => settle(await sendHandBack(props.jwt, props.spaceId, prospect))} />,
      }
    : { ownHeader: { avatar: <HeaderInitials name={props.chatName ?? ''} phone={props.phone} />, subtitle: NO_LINE, actions: null }, strip: null };
  return (
    <>
      {props.children(parts)}
      {prospect && open === 'next' ? <NextActionDialog jwt={props.jwt} spaceId={props.spaceId} prospect={prospect} now={now} onDone={settle} onClose={() => setOpen(null)} /> : null}
      {prospect && open === 'result' ? <ResultDialog jwt={props.jwt} spaceId={props.spaceId} prospect={prospect} onDone={settle} onClose={() => setOpen(null)} /> : null}
      {prospect && open === 'sheet'
        ? createPortal(
            <div className="fixed inset-0 z-30 flex justify-end bg-black/40" onClick={() => setOpen(null)}>
              <div className="h-full w-full max-w-md" onClick={(event) => event.stopPropagation()}>
                <ProspectSheet jwt={props.jwt} spaceId={props.spaceId} me={props.me} prospect={prospect} now={now} phone={props.phone} onChanged={setProspect} onStale={reload} onNotice={props.onNotice} onClose={() => setOpen(null)} />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/** A phone gives the name every pixel it can: the initials and the ficha's button are a bit smaller there. */
function HeaderInitials({ name, phone }: { name: string; phone?: boolean }) {
  return <ProspectAvatar name={name} size={phone ? 'md' : 'lg'} />;
}

/** «+51 949 123 824 · META» (dl-02): the number on one line; without a name, the title already is the number. */
function HeaderLine({ prospect }: { prospect: ProspectView }) {
  return (
    <>
      {prospect.name ? <span className="min-w-0 truncate whitespace-nowrap">{shownProspectPhone(prospect.phone)}</span> : null}
      <OriginPill prospect={prospect} />
    </>
  );
}

function HeaderActions(props: { phone?: boolean; withSheet: boolean; prospect: ProspectView; onSheet: () => void; onResult: () => void }) {
  const { prospect } = props;
  const dial = `tel:+${prospect.phone}`;
  return (
    <>
      {/* dl-01 v4: «Llamar» lives here; the ficha beside it no longer repeats it (one call button on the screen). */}
      {!prospect.phone ? null : props.phone ? (
        <a href={dial} data-testid="cabecera-llamar" aria-label="Llamar" className="grid h-10 w-10 place-items-center rounded-full border border-outline/30 text-primary hover:bg-background"><Phone size={18} /></a>
      ) : (
        <a href={dial} data-testid="cabecera-llamar" className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-outline/30 px-3 text-[13px] font-semibold hover:bg-background"><Phone size={16} /> Llamar</a>
      )}
      {props.withSheet ? null : props.phone ? (
        <button type="button" data-testid="cabecera-ficha" onClick={props.onSheet} className="inline-flex h-10 items-center gap-0.5 rounded-xl border border-outline/30 pl-3 pr-2 text-[13px] font-semibold hover:bg-background">Ficha <ChevronRight size={14} /></button>
      ) : <OutlineButton testId="cabecera-ficha" onClick={props.onSheet}>Ficha <ChevronRight size={16} /></OutlineButton>}
      {props.phone || prospect.result ? null : <SolidButton testId="cabecera-marcar-resultado" onClick={props.onResult}><CheckCircle2 size={16} /> Marcar resultado</SolidButton>}
    </>
  );
}

function Strip(props: { prospect: ProspectView; phone?: boolean; now: Date; onRemind: () => void; onTake: () => void; onHandBack: () => void }) {
  const { prospect } = props;
  const open = !prospect.result;
  return (
    <div data-testid="franja-prospecto" className="flex items-center gap-2 border-b border-outline/15 bg-surface px-3 py-2">
      <Who prospect={prospect} phone={props.phone} />
      <span className="flex-1" />
      {open && prospect.attendedBy === 'human' ? <TextButton testId="franja-devolver-a-dali" onClick={props.onHandBack}><RotateCcw size={14} /> Devolver a Dali</TextButton> : null}
      {open && !prospect.assignee ? <TextButton testId="franja-tomar" onClick={props.onTake}>Tomar</TextButton> : null}
      <RemindButton prospect={prospect} phone={props.phone} now={props.now} onClick={props.onRemind} />
    </div>
  );
}

/** José 27/11: a reminder to insist, from the chat itself; it is the prospect's «Próxima acción» (dl-09). */
function RemindButton(props: { prospect: ProspectView; phone?: boolean; now: Date; onClick: () => void }) {
  const reminder = stripReminderOf(props.prospect, props.now);
  if (!reminder) return null;
  const Icon = reminder.planned ? BellRing : Bell;
  const tone = reminder.late ? 'text-error' : 'text-primary';
  const label = reminder.planned ? `Recordatorio: ${reminder.label}` : reminder.label;
  return props.phone ? (
    <button type="button" data-testid="franja-recordatorio" aria-label={label} title={label} onClick={props.onClick} className={`grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-background ${tone}`}><Icon size={18} /></button>
  ) : (
    <button type="button" data-testid="franja-recordatorio" title={label} onClick={props.onClick} className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold hover:bg-background ${tone}`}><Icon size={14} /> {reminder.label}</button>
  );
}

function Who({ prospect, phone }: { prospect: ProspectView; phone?: boolean }) {
  if (prospect.result) {
    const won = prospect.result.outcome === 'won';
    return <Pill tone={won ? 'ok' : 'error'}>{won ? 'Ganado' : `Perdido${prospect.result.reason ? ` · ${LOSS_REASON_LABEL[prospect.result.reason]}` : ''}`}</Pill>;
  }
  const paused = prospect.attendedBy === 'human';
  const state = paused ? (phone ? 'Dali en pausa' : 'Dali está en pausa: le contesta una persona') : phone ? 'Dali conversa' : 'Dali sigue conversando';
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Pill tone={prospect.assignee ? 'primary' : 'warn'}>{prospect.assignee ? `Atiende ${prospect.assignee.name}` : 'Sin asignar'}</Pill>
      <span className="min-w-0 truncate text-[13px] text-on-surface-variant">{state}</span>
    </span>
  );
}

/** Over the composer of a prospect's channel: what is written there leaves Lilachat. */
export function WhatsAppHint() {
  return (
    <p data-testid="aviso-whatsapp" className="flex items-center gap-1.5 px-1 pb-1 text-[12px] text-on-surface-variant">
      <MessageCircle size={14} className="shrink-0" /> Se envía al cliente por WhatsApp
    </p>
  );
}
