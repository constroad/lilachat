import { useEffect, useState } from 'react';
import { ChevronRight, SquareCheckBig } from 'lucide-react';
import { checklistSummaryLine, checklistsBadge, type ChecklistSummary } from '@lilachat/shared';
import { api } from '../../api';

/** How many the card shows before «Ver los N checklists». */
const VISIBLE = 3;

/**
 * «Checklists» in the chat info on the web, like the app's (backlog 30;
 * design `k-05-checklists-del-chat`): progress and what is late; a click goes
 * to its card in the chat.
 */
export function ChecklistsCard(props: { chatId: string; jwt: string; onOpen: (seq: number) => void }) {
  const [checklists, setChecklists] = useState<ChecklistSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [all, setAll] = useState(false);
  useEffect(() => {
    let current = true;
    void api<{ checklists: ChecklistSummary[] }>(`/agenda/checklists?chatId=${props.chatId}`, { method: 'GET', jwt: props.jwt }).then((response) => {
      if (!current) return;
      if (response.ok) setChecklists(response.data.checklists);
      else setFailed(true);
    });
    return () => {
      current = false;
    };
  }, [props.chatId, props.jwt]);

  if (failed) return <p className="mx-4 mt-3 text-[13px] text-on-surface-variant">No se pudieron cargar los checklists.</p>;
  if (!checklists?.length) return null;
  const shown = all ? checklists : checklists.slice(0, VISIBLE);
  return (
    <section data-testid="tarjeta-checklists" className="mx-4 mt-3 overflow-hidden rounded-xl bg-surface">
      <div className="h-[3px] bg-primary" />
      {/* Kicker, title and how many are open (design `k-05-checklists-del-chat`). */}
      <div className="flex items-center gap-3 px-4 pb-3 pt-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Control operativo</p>
          <p className="mt-0.5 text-[15px] font-bold">Checklists del chat</p>
        </div>
        <span data-testid="checklists-activos" className="shrink-0 rounded-md border border-outline/30 bg-background px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{checklistsBadge(checklists)}</span>
      </div>
      {shown.map((checklist) => {
        const line = checklistSummaryLine(checklist);
        const { cardSeq } = checklist;
        return (
          <button key={checklist._id} type="button" data-testid={`checklist-del-chat-${checklist._id}`} disabled={!cardSeq} onClick={() => cardSeq && props.onOpen(cardSeq)} className="flex min-h-[60px] w-full items-center gap-3 border-t border-outline/10 px-4 py-2.5 text-left hover:bg-background disabled:cursor-default">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><SquareCheckBig size={17} /></span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{checklist.title}</span>
                {line.complete ? <span className="shrink-0 rounded-md border border-en-linea/30 bg-en-linea/10 px-2 py-0.5 text-[11px] font-bold uppercase text-en-linea">Completo</span> : null}
              </span>
              <span className="my-1 block h-1 overflow-hidden rounded-full bg-primary/10"><span className="block h-full rounded-full bg-primary" style={{ width: `${checklist.total ? (checklist.done / checklist.total) * 100 : 0}%` }} /></span>
              <span className="block text-[12px] text-on-surface-variant">
                {line.progress}
                {line.late ? <span className="font-semibold text-error">{` · ${line.late}`}</span> : null}
              </span>
            </span>
            {cardSeq ? <ChevronRight size={16} className="shrink-0 text-on-surface-variant" /> : null}
          </button>
        );
      })}
      {checklists.length > VISIBLE ? (
        <button type="button" data-testid="btn-ver-todos-checklists" onClick={() => setAll((before) => !before)} className="min-h-[44px] w-full border-t border-outline/10 text-sm font-semibold text-primary">
          {all ? 'Ver menos' : `Ver los ${checklists.length} checklists`}
        </button>
      ) : null}
    </section>
  );
}
