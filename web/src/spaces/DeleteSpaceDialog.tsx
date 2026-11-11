import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { confirmsSpaceName, type ClientWorkspace } from '@lilachat/shared';
import { FieldError, Overlay } from '../ui/Overlay';
import { deleteSpace } from './spacesApi';

/**
 * «Eliminar espacio» (José 10/11), for its owner: what goes away is said
 * plainly and the name is typed to confirm, like GitHub. Personal chats stay.
 */
export function DeleteSpaceDialog(props: { space: ClientWorkspace; jwt: string; onDeleted: () => void; onClose: () => void }) {
  const { space } = props;
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = confirmsSpaceName(typed, space.name) && !busy;
  const remove = async () => {
    setBusy(true);
    const response = await deleteSpace(props.jwt, space.id, typed);
    setBusy(false);
    if (!response.ok) return setError(response.message);
    props.onDeleted();
  };
  return (
    <Overlay title="Eliminar espacio" onClose={props.onClose} footer={
      <button type="button" data-testid="eliminar-espacio-confirmar" disabled={!ready} onClick={() => void remove()} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-error text-sm font-semibold text-white transition-opacity disabled:opacity-40">
        <Trash2 size={16} /> Eliminar espacio
      </button>
    }>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-error">No se puede deshacer desde la app</p>
      <h3 className="mt-1 text-lg font-bold tracking-tight">{`¿Eliminar ${space.name}?`}</h3>
      <ul className="mt-3 space-y-2 text-sm leading-5 text-on-surface-variant">
        <li>Nadie podrá entrar al espacio ni ver sus canales, chats y archivos.</li>
        <li>Las apps conectadas se desinstalan y el código para unirse deja de funcionar.</li>
        <li>Los chats personales de cada persona siguen igual.</li>
      </ul>
      <label htmlFor="eliminar-espacio-nombre" className="mb-1.5 mt-4 block text-sm font-semibold">{`Escribe «${space.name}» para confirmar`}</label>
      <input id="eliminar-espacio-nombre" data-testid="eliminar-espacio-nombre" value={typed} autoComplete="off" onChange={(event) => setTyped(event.target.value)} className="h-11 w-full rounded-xl border border-outline/25 bg-background px-3 text-sm outline-none focus:border-error" />
      <FieldError>{error}</FieldError>
    </Overlay>
  );
}
