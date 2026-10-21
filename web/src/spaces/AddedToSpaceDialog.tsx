import { useEffect, useState } from 'react';
import { ArrowRight, ChevronRight, Hash, Users } from 'lucide-react';
import { formatPhoneDisplay, membersLabel, type ClientChannel, type ClientWorkspace } from '@lilachat/shared';
import { Overlay, PrimaryButton } from '../ui/Overlay';
import { SpaceLogo } from './SpaceLogo';
import { spaceChannels } from './spacesApi';

/** How many channels the welcome shows. */
const CHANNELS_SHOWN = 3;

/**
 * «José Zamora te agregó a CONSTROAD» (design `e1-13-te-agregaron`), once per
 * space someone else added me to: what I will find, who invited me, and
 * «Entrar» or «Más tarde».
 */
export function AddedToSpaceDialog(props: { space: ClientWorkspace; jwt: string; onEnter: () => void; onDirectory: () => void; onLater: () => void }) {
  const { space } = props;
  const [channels, setChannels] = useState<ClientChannel[]>([]);
  useEffect(() => {
    void spaceChannels(props.jwt, space.id).then((response) => response.ok && setChannels(response.data.channels.filter((channel) => channel.joined || channel.visibility === 'public').slice(0, CHANNELS_SHOWN)));
  }, [props.jwt, space.id]);
  const inviter = space.addedBy?.name?.trim() || (space.addedBy ? formatPhoneDisplay(space.addedBy.phone) : 'Alguien');
  return (
    <Overlay title="Nuevo espacio" onClose={props.onLater} footer={
      <div className="space-y-1">
        <PrimaryButton testId="te-agregaron-entrar" onClick={props.onEnter}><span className="flex items-center gap-2">{`Entrar a ${space.name}`} <ArrowRight size={16} /></span></PrimaryButton>
        <button type="button" data-testid="te-agregaron-mas-tarde" onClick={props.onLater} className="h-11 w-full text-sm font-semibold text-on-surface-variant">Más tarde</button>
      </div>
    }>
      <div data-testid="te-agregaron" className="flex flex-col items-center text-center">
        <SpaceLogo space={space} size={72} />
        <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Nuevo espacio</p>
        <h3 className="mt-1 text-xl font-bold tracking-tight">{`${inviter} te agregó a ${space.name}`}</h3>
        <p className="mt-2 text-sm leading-5 text-on-surface-variant">Aquí verás los canales y chats de tu empresa. Tus chats personales siguen aparte.</p>
      </div>
      <div className="mt-4 rounded-xl border border-outline/15 p-3">
        <div className="flex items-center justify-between border-b border-outline/10 pb-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Lo que encontrarás</span>
          <span className="rounded-md border border-primary/30 bg-primary/10 px-2 text-[11px] font-bold uppercase leading-5 text-primary">{membersLabel(space.members)}</span>
        </div>
        {channels.map((channel) => (
          <div key={channel.id} className="flex min-h-[48px] items-center gap-3 border-b border-outline/10">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-outline/15 text-primary"><Hash size={15} /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{channel.name}</span>{channel.descripcion ? <span className="block truncate text-[12px] text-on-surface-variant">{channel.descripcion}</span> : null}</span>
          </div>
        ))}
        <button type="button" data-testid="te-agregaron-directorio" onClick={props.onDirectory} className="flex min-h-[48px] w-full items-center gap-3 text-left">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-outline/15 text-primary"><Users size={15} /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-bold">Directorio de equipo</span><span className="block text-[12px] text-on-surface-variant">{`${membersLabel(space.members)} activos`}</span></span>
          <ChevronRight size={16} className="text-outline" />
        </button>
      </div>
      {space.addedBy ? <p className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">{`Invitado por ${inviter}`}<span className="block text-[12px] text-on-surface-variant">{formatPhoneDisplay(space.addedBy.phone)}</span></p> : null}
    </Overlay>
  );
}
