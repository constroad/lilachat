import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { SPACE_RUBROS, type ClientWorkspace } from '@lilachat/shared';
import { FieldError, Overlay, PrimaryButton } from '../ui/Overlay';
import { SpaceLogo } from './SpaceLogo';
import { createSpace } from './spacesApi';

const NAME_MAX = 60;

/**
 * «Crea el espacio de tu empresa» (design `e1-04-crear-espacio`): the name,
 * what it does and whether an admin approves who comes in with the code.
 * Whoever creates it is the owner; the logo is the initials until there is a
 * picture. The design's logo upload and «¿cuántas personas?» wait for a place
 * to keep them on the server.
 */
export function CreateSpaceDialog(props: { jwt: string; onCreated: (space: ClientWorkspace) => void; onJoinInstead: () => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const [rubro, setRubro] = useState<string>(SPACE_RUBROS[0]);
  const [approval, setApproval] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const clean = name.trim();

  const create = async () => {
    if (!clean || busy) return;
    setBusy(true);
    const response = await createSpace(props.jwt, { name: clean, rubro, joinPolicy: approval ? 'approval' : 'open' });
    setBusy(false);
    if (!response.ok) return setError(response.message);
    props.onCreated(response.data.workspace);
  };

  return (
    <Overlay title="Nuevo espacio" onClose={props.onClose} footer={
      <PrimaryButton testId="btn-crear-espacio" disabled={!clean || busy} onClick={() => void create()}>
        <span className="flex items-center gap-2">{busy ? 'Creando…' : 'Crear espacio'} <ArrowRight size={16} /></span>
      </PrimaryButton>
    }>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Nuevo espacio</p>
      <h3 className="mt-1 text-xl font-bold tracking-tight">Crea el espacio de tu empresa</h3>
      <p className="mt-1 text-sm text-on-surface-variant">Serás el dueño. Lo personal de cada miembro no se ve aquí.</p>
      <div className="mt-5 flex items-center gap-3">
        <SpaceLogo space={{ name: clean || 'Espacio' }} size={52} />
        <p className="text-[13px] leading-5 text-on-surface-variant">El logo son las iniciales del nombre hasta que subas una imagen.</p>
      </div>
      <label htmlFor="nombre-espacio" className="mb-1.5 mt-5 block text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Nombre de la empresa</label>
      <input id="nombre-espacio" data-testid="input-nombre-espacio" value={name} maxLength={NAME_MAX} autoFocus onChange={(event) => { setName(event.target.value); setError(''); }} placeholder="CONSTROAD" className="h-11 w-full rounded-xl border border-outline/25 bg-background px-3 text-sm outline-none focus:border-primary" />
      <label htmlFor="rubro-espacio" className="mb-1.5 mt-4 block text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Rubro</label>
      <select id="rubro-espacio" data-testid="select-rubro" value={rubro} onChange={(event) => setRubro(event.target.value)} className="h-11 w-full rounded-xl border border-outline/25 bg-background px-3 text-sm outline-none focus:border-primary">
        {SPACE_RUBROS.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      <button type="button" role="switch" aria-checked={approval} data-testid="toggle-aprobar" onClick={() => setApproval((before) => !before)} className="mt-4 flex w-full items-center gap-3 rounded-xl border border-outline/20 p-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Aprobar a quien entre con el código</span>
          <span className="block text-[12px] leading-4 text-on-surface-variant">Recibirás una solicitud cada vez que alguien nuevo use el código, antes de ver los canales.</span>
        </span>
        <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${approval ? 'bg-primary' : 'bg-outline/40'}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-transform ${approval ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
        </span>
      </button>
      <FieldError>{error}</FieldError>
      <button type="button" data-testid="crear-espacio-unirme" onClick={props.onJoinInstead} className="mt-3 h-11 w-full text-sm font-semibold text-primary">¿Tienes un código? Unirme a una empresa</button>
    </Overlay>
  );
}
