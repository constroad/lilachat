import { useState, type ReactNode } from 'react';
import { Briefcase, Calendar, Copy, Hash, MessageCircle, Smartphone, type LucideIcon } from 'lucide-react';
import { formatPhoneDisplay, joinedLabel, type ClientWorkspace, type ClientWorkspaceMember } from '@lilachat/shared';
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
    <div className="flex min-h-[52px] items-center gap-3 border-t border-outline/10">
      <span className="grid h-9 w-9 place-items-center rounded-lg border border-outline/15 text-on-surface-variant"><Icon size={16} /></span>
      <span className="flex-1 text-sm text-on-surface-variant">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
      {extra}
    </div>
  );
  return (
    <Overlay title="Perfil de colaborador" onClose={props.onClose}>
      <div className="flex flex-col items-center text-center">
        <MemberAvatar member={member} size={88} online={props.online} />
        <h3 className="mt-3 text-xl font-bold tracking-tight">{memberName(member)}</h3>
        {memberLine(member) ? <p className="text-sm text-on-surface-variant">{memberLine(member)}</p> : null}
        <div className="mt-2 flex gap-2"><RolePill role={member.role} />{props.online ? <OnlinePill /> : null}</div>
        {props.isMe || !member.userId ? null : (
          <button type="button" data-testid="perfil-mensaje" onClick={props.onMessage} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-on-primary"><MessageCircle size={16} /> Mensaje</button>
        )}
      </div>
      <div className="mt-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Datos</p>
        <p className="mb-2 font-bold">Información laboral</p>
        {row(Smartphone, 'Teléfono', formatPhoneDisplay(member.phone), (
          <button type="button" data-testid="perfil-copiar-telefono" aria-label="Copiar teléfono" title={copied ? 'Copiado' : 'Copiar'} onClick={() => void copiarTexto(member.phone ?? "").then(setCopied)} className="grid h-9 w-9 place-items-center rounded-full text-primary hover:bg-primary/10"><Copy size={16} /></button>
        ))}
        {member.joinedAt ? row(Calendar, 'Se unió', joinedLabel(member.joinedAt)) : null}
        {member.area ? row(Briefcase, 'Área', member.area) : null}
      </div>
      {props.commonChannels.length ? (
        <div className="mt-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Canales en común</p>
          {props.commonChannels.map((name) => <p key={name} className="mt-1.5 flex items-center gap-2 text-sm"><Hash size={14} className="text-primary" />{name}</p>)}
        </div>
      ) : null}
    </Overlay>
  );
}
