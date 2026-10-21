import { useState } from 'react';
import { CircleCheck, Hash, Lock, Plus, type LucideIcon } from 'lucide-react';
import { normalizeChannelName, type ChannelVisibility, type ClientChannel, type ClientWorkspace } from '@lilachat/shared';
import { FieldError, Overlay, PrimaryButton } from '../ui/Overlay';
import { createChannel } from './spacesApi';

const DESCRIPTION_MAX = 200;

/**
 * «Crear canal» (design `e2-16-crear-canal`): its name as it will read
 * («Obra Surco» becomes #obra-surco), what it is for, and whether anyone in
 * the space can join or only by invitation. The design's «canal de obra» and
 * people picker wait for the server to keep them.
 */
export function CreateChannelDialog(props: { jwt: string; space: ClientWorkspace; onCreated: (channel: ClientChannel) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<ChannelVisibility>('public');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const slug = normalizeChannelName(name);

  const create = async () => {
    if (!slug || busy) return;
    setBusy(true);
    const response = await createChannel(props.jwt, props.space.id, { name: slug, descripcion: description.trim() || undefined, visibility });
    setBusy(false);
    if (!response.ok) return setError(response.message);
    props.onCreated(response.data.channel);
  };
  const choice = (key: ChannelVisibility, title: string, hint: string, Icon: LucideIcon) => (
    <button key={key} type="button" data-testid={`privacidad-${key}`} aria-pressed={visibility === key} onClick={() => setVisibility(key)} className={`flex-1 rounded-xl border p-3 text-left ${visibility === key ? 'border-primary bg-primary/5' : 'border-outline/20'}`}>
      <span className="flex items-center gap-1.5">
        <Icon size={15} className={visibility === key ? 'text-primary' : 'text-on-surface-variant'} />
        <span className="flex-1 text-sm font-bold">{title}</span>
        {visibility === key ? <CircleCheck size={16} className="text-primary" /> : null}
      </span>
      <span className="mt-1 block text-[12px] text-on-surface-variant">{hint}</span>
    </button>
  );

  return (
    <Overlay title="Crear canal" onClose={props.onClose} footer={
      <PrimaryButton testId="btn-confirmar-canal" disabled={!slug || busy} onClick={() => void create()}>
        <span className="flex items-center gap-2"><Plus size={16} /> {busy ? 'Creando…' : 'Crear canal'}</span>
      </PrimaryButton>
    }>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Nuevo canal</p>
      <p className="mt-1 text-sm text-on-surface-variant">{`Los canales ordenan los temas de obra, cuadrillas y despachos de ${props.space.name}.`}</p>
      <label htmlFor="nombre-canal" className="mb-1.5 mt-4 block text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Nombre del canal</label>
      <div className={`flex h-11 items-center rounded-xl border bg-background px-3 ${slug ? 'border-primary' : 'border-outline/25'}`}>
        <span className="mr-1 text-primary">#</span>
        <input id="nombre-canal" data-testid="input-nombre-canal" value={name} autoFocus autoComplete="off" spellCheck={false} onChange={(event) => { setName(event.target.value); setError(''); }} placeholder="obra-surco" className="min-w-0 flex-1 bg-transparent font-mono text-sm outline-none" />
        {slug ? <CircleCheck size={18} className="text-en-linea" /> : null}
      </div>
      <p className="mt-1 text-[12px] text-on-surface-variant">{slug && slug !== name.trim() ? `Quedará como #${slug}` : 'Minúsculas, números o guiones, sin espacios.'}</p>
      <label htmlFor="descripcion-canal" className="mb-1.5 mt-4 block text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Descripción</label>
      <textarea id="descripcion-canal" data-testid="input-descripcion-canal" value={description} maxLength={DESCRIPTION_MAX} rows={2} onChange={(event) => setDescription(event.target.value)} placeholder="Coordinación diaria de la obra Surco" className="w-full resize-none rounded-xl border border-outline/25 bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
      <p className="mb-1.5 mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Privacidad del canal</p>
      <div className="flex gap-2">
        {choice('public', 'Público', 'Cualquiera del espacio puede unirse.', Hash)}
        {choice('private', 'Privado', 'Solo por invitación.', Lock)}
      </div>
      <FieldError>{error}</FieldError>
    </Overlay>
  );
}
