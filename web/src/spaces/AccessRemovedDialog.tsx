import { ArrowRight, Check, Lock, MessageCircle } from 'lucide-react';
import { formatPhoneDisplay, spaceSubtitle, type ClientWorkspace } from '@lilachat/shared';
import { Overlay, PrimaryButton } from '../ui/Overlay';
import { SpaceLogo } from './SpaceLogo';

/**
 * «Ya no tienes acceso a este espacio» (design `e1-14-acceso-desactivado`): an
 * admin deactivated me. My personal chats stay; I can go back to them or write
 * to one of the space's admins in my personal account.
 */
export function AccessRemovedDialog(props: { space: ClientWorkspace; onPersonal: () => void; onTalkTo: (admin: { userId: string; name?: string; phone: string }) => void }) {
  const { space } = props;
  const admins = space.admins ?? [];
  return (
    <Overlay title={space.name} onClose={props.onPersonal} footer={
      <div className="space-y-1">
        <PrimaryButton testId="sin-acceso-personal" onClick={props.onPersonal}><span className="flex items-center gap-2">Ir a mis chats personales <ArrowRight size={16} /></span></PrimaryButton>
        {admins[0] ? <button type="button" data-testid="sin-acceso-hablar" onClick={() => props.onTalkTo(admins[0]!)} className="flex h-11 w-full items-center justify-center gap-2 text-sm font-semibold text-primary"><MessageCircle size={16} /> Hablar con un admin</button> : null}
      </div>
    }>
      <div data-testid="sin-acceso" className="flex flex-col items-center text-center">
        <span className="grid h-20 w-20 place-items-center rounded-full bg-error/10 text-error"><Lock size={34} /></span>
        <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">{space.name}</p>
        <h3 className="mt-1 text-xl font-bold tracking-tight">Ya no tienes acceso a este espacio</h3>
        <p className="mt-2 text-sm leading-5 text-on-surface-variant">{`Un admin desactivó tu cuenta en ${space.name}. Tus chats personales siguen igual.`}</p>
        <span className="mt-3 rounded-full border border-error/30 bg-error/10 px-3 text-[12px] font-bold leading-6 text-error">DESACTIVADO</span>
      </div>
      <div className="mt-4 rounded-xl border border-outline/15 p-3">
        <div className="flex items-center gap-3"><SpaceLogo space={space} size={44} /><span className="min-w-0"><span className="block font-bold">{space.name}</span><span className="block text-[13px] text-on-surface-variant">{spaceSubtitle(space)}</span></span></div>
        <p className="mt-3 flex gap-2 border-t border-outline/10 pt-3 text-sm"><Check size={16} className="shrink-0 text-en-linea" />{`Tus mensajes, llamadas y contactos fuera de ${space.name} siguen intactos.`}</p>
        {admins.length ? (
          <div className="mt-3 border-t border-outline/10 pt-3">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Administradores del espacio</p>
            <div className="flex flex-wrap gap-2">{admins.map((admin) => <span key={admin.userId} className="rounded-lg border border-outline/20 px-2.5 py-1 text-sm">{admin.name || formatPhoneDisplay(admin.phone)}</span>)}</div>
          </div>
        ) : null}
      </div>
    </Overlay>
  );
}
