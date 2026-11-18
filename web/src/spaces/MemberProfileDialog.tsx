import { useState, type ReactNode } from 'react';
import { Briefcase, Calendar, Copy, Hash, MessageCircle, Smartphone, type LucideIcon } from 'lucide-react';
import { formatPhoneDisplay, isRealPhone, joinedLabel, type ClientWorkspace, type ClientWorkspaceMember } from '@lilachat/shared';
import { Overlay } from '../ui/Overlay';
import { copiarTexto } from '../chat/copiarTexto';
import { MemberAvatar, memberLine, memberName, OnlinePill, RolePill } from './memberWeb';

/**
 * «Perfil de colaborador» (design `e1-09-perfil-miembro`): who they are in
 * the space, «Mensaje» to write to them there, their phone to copy, when they
 * joined, their area and the channels we share.
 */
export function MemberProfileDialog(props: { space: ClientWorkspace; member: ClientWorkspaceMember; isMe: boolean; online: boolean; commonChannels: string[]; onMessage: () => void; onClose: () => void }) {
  const { member } = props;
  const [copied, setCopied] = useState(false);
  const row = (Icon: LucideIcon, label: string, value: string, extra?: ReactNode) => (
    // At 390 px a long value (an area, a role) wraps in its own column: the icon, the label and the copy button stay whole.
    <div className="flex min-h-[52px] min-w-0 items-center gap-3 border-t border-outline/10 py-1.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-outline/15 text-on-surface-variant"><Icon size={16} /></span>
      <span className="shrink-0 text-sm text-on-surface-variant">{label}</span>
      <span className="min-w-0 flex-1 break-words text-right text-sm font-semibold">{value}</span>
      {extra}
    </div>
  );
  return (
    <Overlay title="Perfil de colaborador" onClose={props.onClose}>
      <div className="flex flex-col items-center text-center">
        <MemberAvatar member={member} size={88} online={props.online} />
        <h3 className="mt-3 max-w-full break-words text-xl font-bold tracking-tight">{memberName(member)}</h3>
        {memberLine(member) ? <p className="max-w-full break-words text-sm text-on-surface-variant">{memberLine(member)}</p> : null}
        <div className="mt-2 flex flex-wrap justify-center gap-2"><RolePill role={member.role} />{props.online ? <OnlinePill /> : null}</div>
        {props.isMe || !member.userId ? null : (
          <button type="button" data-testid="perfil-mensaje" onClick={props.onMessage} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-on-primary"><MessageCircle size={16} /> Mensaje</button>
        )}
      </div>
      <div className="mt-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Datos</p>
        <p className="mb-2 font-bold">Información laboral</p>
        {isRealPhone(member.phone) ? row(Smartphone, 'Teléfono', formatPhoneDisplay(member.phone), (
          <button type="button" data-testid="perfil-copiar-telefono" aria-label="Copiar teléfono" title={copied ? 'Copiado' : 'Copiar'} onClick={() => void copiarTexto(member.phone ?? "").then(setCopied)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-primary hover:bg-primary/10"><Copy size={16} /></button>
        )) : null}
        {member.joinedAt ? row(Calendar, 'Se unió', joinedLabel(member.joinedAt)) : null}
        {member.area ? row(Briefcase, 'Área', member.area) : null}
      </div>
      {props.commonChannels.length ? (
        <div className="mt-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Canales en común</p>
          {props.commonChannels.map((name) => <p key={name} className="mt-1.5 flex items-center gap-2 text-sm"><Hash size={14} className="shrink-0 text-primary" /><span className="min-w-0 break-words [overflow-wrap:anywhere]">{name}</span></p>)}
        </div>
      ) : null}
    </Overlay>
  );
}
