import { useState } from 'react';
import { Check, Lock } from 'lucide-react';
import { formatPhoneDisplay, requestedAgo, SPACE_AREAS, type ClientWorkspaceMember } from '@lilachat/shared';
import { MemberAvatar, memberName } from './memberWeb';

const TITLE_MAX = 60;

/** A request to come in (design `e1-11-solicitudes`): who, with which code and when, the area and title it will have, and «Rechazar» or «Aprobar». */
export function RequestCard(props: { request: ClientWorkspaceMember; spaceName: string; code?: string; busy: boolean; onApprove: (area: string | undefined, title: string | undefined) => void; onReject: () => void }) {
  const { request } = props;
  const [area, setArea] = useState<string | undefined>(request.area);
  const [title, setTitle] = useState(request.title ?? '');
  return (
    <div data-testid={`solicitud-${request.phone}`} className="mt-3 overflow-hidden rounded-xl border border-outline/15">
      <div className="h-[3px] bg-primary" />
      <div className="p-4">
        <div className="flex items-center gap-3">
          <MemberAvatar member={request} size={44} online={false} />
          <div className="min-w-0 flex-1"><p className="truncate font-bold">{memberName(request)}</p><p className="font-mono text-[13px] text-on-surface-variant">{formatPhoneDisplay(request.phone)}</p></div>
          <span className="rounded-md border border-primary/30 bg-primary/10 px-2 text-[11px] font-bold leading-5 text-primary">PENDIENTE</span>
        </div>
        {request.requestedAt ? <p className="mt-3 flex items-center gap-2 rounded-lg bg-background px-3 py-2 text-[13px] text-on-surface-variant"><Lock size={14} className="text-primary" />{`Entró con el código${props.code ? ` ${props.code}` : ''} ${requestedAgo(request.requestedAt)}`}</p> : null}
        <p className="mb-1.5 mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">{`Área en ${props.spaceName}`}</p>
        <div className="flex flex-wrap gap-2">
          {SPACE_AREAS.map((option) => (
            <button key={option} type="button" data-testid={`solicitud-area-${option}`} aria-pressed={area === option} onClick={() => setArea(area === option ? undefined : option)} className={`h-10 min-w-[72px] rounded-lg border px-3 text-sm font-semibold ${area === option ? 'border-primary bg-primary/10 text-primary' : 'border-outline/20 hover:bg-background'}`}>{option}</button>
          ))}
        </div>
        <label className="mb-1.5 mt-4 block text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Cargo
          <input data-testid="solicitud-cargo" value={title} maxLength={TITLE_MAX} onChange={(event) => setTitle(event.target.value)} placeholder="Chofer de volquete" className="mt-1.5 h-11 w-full rounded-xl border border-outline/25 bg-background px-3 text-sm font-normal normal-case tracking-normal text-on-surface outline-none focus:border-primary" />
        </label>
        <div className="mt-4 flex gap-2">
          <button type="button" data-testid="solicitud-rechazar" disabled={props.busy} onClick={props.onReject} className="h-11 flex-1 rounded-xl border border-outline/25 text-sm font-semibold hover:bg-background disabled:opacity-50">Rechazar</button>
          <button type="button" data-testid="solicitud-aprobar" disabled={props.busy} onClick={() => props.onApprove(area, title.trim() || undefined)} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-on-primary disabled:opacity-50"><Check size={16} /> Aprobar</button>
        </div>
      </div>
    </div>
  );
}
