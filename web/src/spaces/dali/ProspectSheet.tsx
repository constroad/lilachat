import { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ArrowLeft, ChevronDown, MessageSquare, RotateCcw, X } from 'lucide-react';
import { prospectNameOf, type ClientWorkspaceMember, type ProspectView } from '@lilachat/shared';
import { spaceMembers } from '../spacesApi';
import { Kicker, OutlineButton, SolidButton, TextButton } from './daliParts';
import { ClientDocumentsCard } from './ClientDocumentsCard';
import { NextActionDialog } from './NextActionDialog';
import { AttendsLine, Card, ContactCard, NextActionCard, OriginCard, QuoteCard, ScoreCard, StageCard, UnderstoodCard } from './prospectSheetBlocks';
import { ResultDialog } from './ResultDialog';
import { sendChange, sendHandBack, type ChangeOutcome, type SellerPatch } from './sellerDesk';

export type SheetProps = {
  jwt: string;
  spaceId: string;
  me: string;
  prospect: ProspectView;
  now: Date;
  /** The prospect as the server answered a change: the list and the strip show it at once. */
  onChanged: (prospect: ProspectView) => void;
  /** Someone changed it first: read it again. */
  onStale: () => void;
  onNotice: (text: string) => void;
  /** Its own header with ← (phone) or ✕ (side panel); the inbox's third column goes without it. */
  onClose?: () => void;
  phone?: boolean;
  /** From the funnel, the panel or the review: open its conversation in the inbox. */
  onOpenConversation?: () => void;
  /** The inbox's third column: the conversation's header already has «Marcar resultado». */
  resultInHeader?: boolean;
};

/**
 * The ficha of a prospect (dl-03): contact, origin, Dali's score with its reasons, what Dali understood, the quote,
 * the stage, who attends it, the next action and the result. The decisions are the seller's (version-checked PATCH);
 * what Dali knows is read only. Stitch's pencils on each field do not go: the fields are agentes'.
 */
export function ProspectSheet(props: SheetProps) {
  const { prospect, now } = props;
  const [dialog, setDialog] = useState<'next' | 'result' | null>(null);
  const settle = (outcome: ChangeOutcome): void => {
    setDialog(null);
    if (outcome.ok) return props.onChanged(outcome.prospect);
    props.onNotice(outcome.message);
    if (outcome.stale) props.onStale();
  };
  const change = async (patch: SellerPatch) => settle(await sendChange(props.jwt, props.spaceId, prospect, patch));
  const handBack = async () => settle(await sendHandBack(props.jwt, props.spaceId, prospect));

  return (
    <div data-testid="ficha-prospecto" className="flex h-full min-h-0 flex-col bg-background">
      {props.onClose ? <SheetHeader name={prospectNameOf(prospect)} phone={props.phone} onClose={props.onClose} /> : null}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        <ContactCard prospect={prospect} />
        <OriginCard prospect={prospect} />
        <ScoreCard prospect={prospect} />
        <UnderstoodCard prospect={prospect} />
        <ClientDocumentsCard jwt={props.jwt} spaceId={props.spaceId} prospect={prospect} />
        <QuoteCard prospect={prospect} />
        <StageCard prospect={prospect} />
        <Card testId="ficha-atiende">
          <Kicker>Atiende</Kicker>
          <div className="mt-2 flex items-center gap-2">
            <span className="min-w-0 flex-1"><AttendsLine prospect={prospect} /></span>
            <AssigneeControl jwt={props.jwt} spaceId={props.spaceId} me={props.me} prospect={prospect} onChange={(assignee) => void change({ assignee })} />
          </div>
          {prospect.attendedBy === 'human' ? (
            <div className="mt-2 flex items-center gap-2 border-t border-outline/10 pt-2 text-[13px] text-on-surface-variant">
              <span className="min-w-0 flex-1">Dali está en pausa: le contesta una persona.</span>
              <TextButton testId="devolver-a-dali" onClick={() => void handBack()}><RotateCcw size={14} /> Devolver a Dali</TextButton>
            </div>
          ) : null}
        </Card>
        {prospect.result ? null : <NextActionCard prospect={prospect} now={now} onPlan={() => setDialog('next')} />}
      </div>
      {props.resultInHeader && !prospect.result ? null : <SheetFooter prospect={prospect} onResult={() => setDialog('result')} onReopen={() => void change({ result: null })} onOpenConversation={props.onOpenConversation} />}
      {dialog === 'next' ? <NextActionDialog jwt={props.jwt} spaceId={props.spaceId} prospect={prospect} now={now} onDone={settle} onClose={() => setDialog(null)} /> : null}
      {dialog === 'result' ? <ResultDialog jwt={props.jwt} spaceId={props.spaceId} prospect={prospect} onDone={settle} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}

function SheetHeader({ name, phone, onClose }: { name: string; phone?: boolean; onClose: () => void }) {
  return (
    <header className="flex items-center gap-2 border-b border-outline/15 bg-surface px-2 py-2">
      {phone ? <button type="button" data-testid="cerrar-ficha" aria-label="Volver" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full hover:bg-background"><ArrowLeft size={20} /></button> : null}
      <span className={`min-w-0 flex-1 ${phone ? '' : 'pl-2'}`}>
        <Kicker className="text-primary">Prospecto</Kicker>
        <span className="block truncate text-base font-extrabold tracking-tight">{name}</span>
      </span>
      {phone ? null : <button type="button" data-testid="cerrar-ficha" aria-label="Cerrar" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full text-on-surface-variant hover:bg-background"><X size={20} /></button>}
    </header>
  );
}

function SheetFooter(props: { prospect: ProspectView; onResult: () => void; onReopen: () => void; onOpenConversation?: () => void }) {
  return (
    <footer className="flex flex-wrap gap-2 border-t border-outline/15 bg-surface px-4 py-3">
      {props.onOpenConversation ? <OutlineButton testId="abrir-conversacion" onClick={props.onOpenConversation}><MessageSquare size={16} /> Abrir conversación</OutlineButton> : null}
      {props.prospect.result ? (
        <>
          <OutlineButton testId="reabrir-prospecto" onClick={props.onReopen}><RotateCcw size={16} /> Reabrir</OutlineButton>
          <span className="min-w-0 flex-1" />
          <OutlineButton testId="cambiar-resultado" onClick={props.onResult}>Cambiar resultado</OutlineButton>
        </>
      ) : <span className="min-w-0 flex-1"><SolidButton wide testId="marcar-resultado" onClick={props.onResult}>Marcar resultado</SolidButton></span>}
    </footer>
  );
}

/** Reparto is free (agentes 16/11): anyone takes one; whoever has it can pass it to a member or let it go. */
function AssigneeControl(props: { jwt: string; spaceId: string; me: string; prospect: ProspectView; onChange: (assignee: SellerPatch['assignee']) => void }) {
  const [members, setMembers] = useState<ClientWorkspaceMember[] | null>(null);
  if (!props.prospect.assignee) return <SolidButton testId="tomar-prospecto" onClick={() => props.onChange('me')}>Tomar</SolidButton>;
  const load = (open: boolean) => {
    if (!open || members) return;
    void spaceMembers(props.jwt, props.spaceId, 'active').then((answer) => setMembers(answer.ok ? answer.data.members : []));
  };
  const mine = props.prospect.assignee.id === props.me;
  return (
    <DropdownMenu.Root onOpenChange={load}>
      <DropdownMenu.Trigger asChild>
        <button type="button" data-testid="reasignar-prospecto" className="inline-flex h-9 items-center gap-1 rounded-lg border border-outline/30 px-3 text-[13px] font-semibold hover:bg-background">Reasignar <ChevronDown size={14} /></button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className="z-40 max-h-80 min-w-[220px] overflow-y-auto rounded-xl border border-outline/15 bg-surface p-1 shadow-lg">
          {mine ? null : <MenuItem testId="tomarlo-yo" label="Tomarlo yo" onSelect={() => props.onChange('me')} />}
          {(members ?? []).filter((member) => member.userId && member.userId !== props.prospect.assignee?.id && member.userId !== props.me).map((member) => (
            <MenuItem key={member.id} label={member.name ?? 'Miembro'} onSelect={() => props.onChange({ id: member.userId! })} />
          ))}
          {members === null ? <p className="px-3 py-2 text-[13px] text-on-surface-variant">Cargando miembros…</p> : null}
          <DropdownMenu.Separator className="my-1 h-px bg-outline/15" />
          <MenuItem testId="soltar-prospecto" label="Dejarlo sin asignar" onSelect={() => props.onChange(null)} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MenuItem({ label, onSelect, testId }: { label: string; onSelect: () => void; testId?: string }) {
  return <DropdownMenu.Item data-testid={testId} onSelect={onSelect} className="flex min-h-[40px] cursor-pointer select-none items-center rounded-lg px-3 text-sm outline-none data-[highlighted]:bg-background">{label}</DropdownMenu.Item>;
}
