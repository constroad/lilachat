import { useState } from 'react';
import { Hash, Lock, Plus, Search } from 'lucide-react';
import { filterChannels, membersLabel, type ChannelFilter, type ClientChannel, type ClientWorkspace } from '@lilachat/shared';
import { FieldError, Overlay } from '../ui/Overlay';
import { CreateChannelDialog } from './CreateChannelDialog';
import { joinChannel } from './spacesApi';
import { channelsCache, fetchChannels, useCached } from './spaceCache';

const TABS: { key: ChannelFilter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'public', label: 'Públicos' },
  { key: 'private', label: 'Privados' },
];

/**
 * «Canales» of a space (design `e2-15-explorar-canales`): the public ones and
 * my private ones, searched by name or description, Todos · Públicos ·
 * Privados; «Unirme» to a public one opens it, a joined one opens with a
 * click, and «Crear canal» (design `e2-16`). A private channel is joined by
 * invitation only.
 */
export function ChannelsDialog(props: { space: ClientWorkspace; jwt: string; onOpenChannel: (channel: ClientChannel) => void; onClose: () => void }) {
  const { space, jwt } = props;
  // The space's channels paint at once from what was seen and refresh behind (22/10).
  const listed = useCached(channelsCache, `${space.id}:channels`, fetchChannels(jwt, space.id));
  const channels = listed.value ?? null;
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<ChannelFilter>('all');
  const [creating, setCreating] = useState(false);
  const [joinError, setError] = useState('');
  const error = joinError || (channels ? '' : (listed.error ?? ''));

  if (creating) return <CreateChannelDialog jwt={jwt} space={space} onCreated={props.onOpenChannel} onClose={() => setCreating(false)} />;
  const shown = filterChannels(channels ?? [], { query, visibility: tab });
  const join = async (channel: ClientChannel) => {
    const response = await joinChannel(jwt, space.id, channel.id);
    if (!response.ok) return setError(response.message);
    props.onOpenChannel(response.data.channel);
  };

  return (
    <Overlay title={`Canales de ${space.name}`} onClose={props.onClose} wide>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{space.name}</p>
          <h3 className="text-2xl font-bold tracking-tight">Canales</h3>
          <p className="mt-1 text-sm text-on-surface-variant">Temas y obras para coordinar frentes, cuadrillas y despachos.</p>
        </div>
        <button type="button" data-testid="btn-crear-canal" onClick={() => setCreating(true)} className="flex h-11 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary">
          <Plus size={16} /> Crear canal
        </button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div role="tablist" className="flex rounded-xl border border-outline/20 p-1">
          {TABS.map(({ key, label }) => (
            <button key={key} type="button" role="tab" data-testid={`canales-${key}`} aria-selected={tab === key} onClick={() => setTab(key)} className={`h-9 rounded-lg px-3 text-sm font-semibold ${tab === key ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-background'}`}>
              {`${label} (${shown.counts[key]})`}
            </button>
          ))}
        </div>
        <label className="flex h-11 min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-outline/20 bg-background px-3">
          <Search size={16} className="text-on-surface-variant" />
          <input data-testid="buscar-canales" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar canales" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </label>
      </div>
      <FieldError>{error}</FieldError>
      <div className="mt-3 divide-y divide-outline/10 overflow-hidden rounded-xl border border-outline/15">
        {channels === null ? [0, 1, 2].map((index) => <div key={index} className="h-20 animate-pulse bg-background" />) : null}
        {channels !== null && shown.channels.length === 0 ? <p className="p-6 text-center text-sm text-on-surface-variant">{query ? 'Ningún canal coincide con la búsqueda.' : 'Todavía no hay canales: crea el primero.'}</p> : null}
        {shown.channels.map((channel) => (
          <div key={channel.id} data-testid={`canal-${channel.name}`} className="flex min-h-[76px] items-center gap-3 p-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">{channel.visibility === 'private' ? <Lock size={18} /> : <Hash size={18} />}</span>
            <button type="button" disabled={!channel.joined} onClick={() => props.onOpenChannel(channel)} className="min-w-0 flex-1 text-left disabled:cursor-default">
              <span className="flex items-center gap-2">
                <span className="truncate font-bold">{`#${channel.name}`}</span>
                {channel.visibility === 'private' ? <span className="rounded border border-outline/25 px-1.5 text-[10px] font-bold text-on-surface-variant">PRIVADO</span> : null}
              </span>
              {channel.descripcion ? <span className="block truncate text-[13px] text-on-surface-variant">{channel.descripcion}</span> : null}
              <span className="block text-[12px] text-on-surface-variant">{membersLabel(channel.members)}</span>
            </button>
            {channel.joined ? (
              <span className="rounded-md border border-en-linea/40 bg-en-linea/10 px-2 text-[11px] font-bold text-en-linea">UNIDO</span>
            ) : channel.visibility === 'public' ? (
              <button type="button" data-testid={`unirme-${channel.name}`} onClick={() => void join(channel)} className="h-10 rounded-xl border border-primary px-3.5 text-sm font-semibold text-primary hover:bg-primary/5">Unirme</button>
            ) : (
              <span className="text-[12px] text-on-surface-variant">Solo con invitación</span>
            )}
          </div>
        ))}
      </div>
    </Overlay>
  );
}
