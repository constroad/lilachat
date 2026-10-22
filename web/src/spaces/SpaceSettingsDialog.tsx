import { useState } from 'react';
import { Check, KeyRound } from 'lucide-react';
import { membersLabel, SPACE_RUBROS, type ClientWorkspace } from '@lilachat/shared';
import { FieldError, Overlay, PrimaryButton } from '../ui/Overlay';
import { SpaceLogo } from './SpaceLogo';
import { removeSpaceLogo, updateSpace, uploadSpaceLogo } from './spacesApi';
import { IntegrationsSection } from './IntegrationsSection';

const NAME_MAX = 60;

/**
 * «Ajustes del espacio» (design `e1-12-ajustes-espacio`), for admins: the
 * name, the trade, whether an admin approves who comes in, and a new code
 * (the old one stops working), and its logo: an image, or its initials.
 */
export function SpaceSettingsDialog(props: { space: ClientWorkspace; jwt: string; onSaved: (space: ClientWorkspace) => void; onClose: () => void }) {
  const { space } = props;
  const [name, setName] = useState(space.name);
  const [rubro, setRubro] = useState(space.rubro ?? '');
  const [approval, setApproval] = useState(space.joinPolicy === 'approval');
  const [code, setCode] = useState(space.joinCode);
  const [logoUrl, setLogoUrl] = useState(space.logoUrl);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const clean = name.trim();
  const changed = clean !== space.name || rubro !== (space.rubro ?? '') || approval !== (space.joinPolicy === 'approval');

  const save = async (change: Parameters<typeof updateSpace>[2]) => {
    setBusy(true);
    const response = await updateSpace(props.jwt, space.id, change);
    setBusy(false);
    if (!response.ok) return setError(response.message);
    setError('');
    setCode(response.data.workspace.joinCode);
    props.onSaved(response.data.workspace);
  };
  const changeLogo = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    const sent = await uploadSpaceLogo(props.jwt, space.id, file);
    setBusy(false);
    if (!sent.ok) return setError(sent.message);
    setError('');
    setLogoUrl(sent.workspace.logoUrl);
    props.onSaved(sent.workspace);
  };
  const removeLogo = async () => {
    const response = await removeSpaceLogo(props.jwt, space.id);
    if (!response.ok) return setError(response.message);
    setLogoUrl(undefined);
    props.onSaved(response.data.workspace);
  };
  const newCode = () => {
    if (window.confirm('¿Cambiar el código? El actual deja de funcionar; quienes ya están en el espacio siguen igual.')) void save({ newCode: true });
  };

  return (
    <Overlay title="Ajustes del espacio" onClose={props.onClose} footer={
      <PrimaryButton testId="ajustes-espacio-guardar" disabled={!clean || !changed || busy} onClick={() => void save({ name: clean, rubro: rubro || undefined, joinPolicy: approval ? 'approval' : 'open' })}>
        <span className="flex items-center gap-2"><Check size={16} /> Guardar</span>
      </PrimaryButton>
    }>
      <p className="flex items-center gap-2 text-sm text-on-surface-variant"><span className="rounded-md border border-en-linea/40 bg-en-linea/10 px-2 text-[11px] font-bold leading-5 text-en-linea">ACTIVO</span>{`${membersLabel(space.members)} activos`}</p>
      <FieldError>{error}</FieldError>
      <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Espacio</p>
      <div className="mt-2 flex items-center gap-3">
        <SpaceLogo space={{ name: clean || space.name, logoUrl }} size={52} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Logo del espacio</p>
          <p className="text-[12px] text-on-surface-variant">Una imagen cuadrada, o las iniciales del nombre.</p>
          <div className="mt-2 flex items-center gap-2">
            <label className={`flex h-9 cursor-pointer items-center rounded-lg border border-outline/25 px-3 text-sm font-semibold hover:bg-background ${busy ? 'pointer-events-none opacity-50' : ''}`}>
              Cambiar logo
              <input data-testid="ajustes-logo-archivo" type="file" accept="image/*" className="sr-only" onChange={(event) => void changeLogo(event.target.files?.[0])} />
            </label>
            {logoUrl ? <button type="button" data-testid="ajustes-quitar-logo" onClick={() => void removeLogo()} className="h-9 px-2 text-sm font-semibold text-on-surface-variant">Restablecer</button> : null}
          </div>
        </div>
      </div>
      <label htmlFor="nombre-ajustes" className="mb-1.5 mt-4 block text-sm font-semibold">Nombre del espacio</label>
      <input id="nombre-ajustes" data-testid="input-nombre-ajustes" value={name} maxLength={NAME_MAX} onChange={(event) => setName(event.target.value)} className="h-11 w-full rounded-xl border border-outline/25 bg-background px-3 text-sm outline-none focus:border-primary" />
      <label htmlFor="rubro-ajustes" className="mb-1.5 mt-4 block text-sm font-semibold">Rubro</label>
      <select id="rubro-ajustes" data-testid="select-rubro-ajustes" value={rubro} onChange={(event) => setRubro(event.target.value)} className="h-11 w-full rounded-xl border border-outline/25 bg-background px-3 text-sm outline-none focus:border-primary">
        {rubro && !SPACE_RUBROS.includes(rubro as (typeof SPACE_RUBROS)[number]) ? <option value={rubro}>{rubro}</option> : null}
        {!rubro ? <option value="">Sin rubro</option> : null}
        {SPACE_RUBROS.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Ingreso</p>
      <div className="mt-2 flex items-center gap-3 rounded-xl bg-background p-3">
        <KeyRound size={16} className="text-primary" />
        <span data-testid="codigo-ajustes" className="flex-1 select-all font-mono text-lg font-bold tracking-widest">{code}</span>
        <button type="button" data-testid="ajustes-cambiar-codigo" disabled={busy} onClick={newCode} className="h-9 rounded-lg border border-outline/25 bg-surface px-3 text-sm font-semibold text-primary">Cambiar código</button>
      </div>
      <button type="button" role="switch" aria-checked={approval} data-testid="ajustes-aprobar" onClick={() => setApproval((before) => !before)} className="mt-3 flex w-full items-center gap-3 rounded-xl border border-outline/20 p-3 text-left">
        <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Aprobar a quien entre con el código</span><span className="block text-[12px] leading-4 text-on-surface-variant">Recibirás una solicitud cada vez que alguien nuevo use el código, antes de ver los canales.</span></span>
        <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${approval ? 'bg-primary' : 'bg-outline/40'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-transform ${approval ? 'translate-x-[22px]' : 'translate-x-0.5'}`} /></span>
      </button>
      <IntegrationsSection jwt={props.jwt} spaceId={space.id} />
    </Overlay>
  );
}
