import { useState } from 'react';
import { Copy, Share2 } from 'lucide-react';
import { spaceInviteMessage, type ClientWorkspace } from '@lilachat/shared';
import { Avatar } from '../ui/Avatar';
import { FieldError, Overlay } from '../ui/Overlay';
import { copiarTexto } from '../chat/copiarTexto';
import { addToSpace } from './spacesApi';

/** A Peruvian mobile, as the server keeps it: nine digits. */
const PHONE_DIGITS = 9;
const groupedPhone = (phone: string) => phone.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');

/**
 * «Invitar personas» (design `e1-05-invitar`): the space's code to copy or
 * send by WhatsApp, and adding someone by number — in at once if they already
 * use Lilachat, otherwise invited until they sign up with it. Only those who
 * can invite see the code.
 */
export function InviteToSpaceDialog(props: { space: ClientWorkspace; jwt: string; onClose: () => void }) {
  const { space } = props;
  const [phone, setPhone] = useState('');
  const [added, setAdded] = useState<{ phone: string; status: string }[]>([]);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const digits = phone.replace(/\D/g, '');
  const message = space.joinCode ? spaceInviteMessage({ spaceName: space.name, code: space.joinCode }) : '';

  const copy = async () => {
    if (space.joinCode && (await copiarTexto(space.joinCode))) setCopied(true);
  };
  const add = async () => {
    if (digits.length !== PHONE_DIGITS) return setError('Escribe los 9 dígitos del celular.');
    const response = await addToSpace(props.jwt, space.id, digits);
    if (!response.ok) return setError(response.message);
    setAdded((before) => [{ phone: digits, status: response.data.member.status }, ...before.filter((one) => one.phone !== digits)]);
    setPhone('');
    setError('');
  };

  return (
    <Overlay title={`Invitar a ${space.name}`} onClose={props.onClose}>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{space.name}</p>
      <h3 className="mt-1 text-xl font-bold tracking-tight">Invitar personas</h3>
      <p className="mt-1 text-sm text-on-surface-variant">Comparte el acceso o agrega a tu equipo por su número de celular.</p>
      {space.joinCode ? (
        <>
          <div data-testid="tarjeta-codigo-espacio" className="mt-4 overflow-hidden rounded-xl border border-outline/15">
            <div className="h-[3px] bg-primary" />
            <div className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Código del espacio</p>
                <span className="rounded-full border border-en-linea/40 bg-en-linea/10 px-2 text-[11px] font-bold text-en-linea">ACTIVO</span>
              </div>
              <p data-testid="codigo-espacio" className="my-3 select-all text-center font-mono text-3xl font-bold tracking-[0.2em]">{space.joinCode}</p>
              <div className="flex gap-2">
                <button type="button" data-testid="btn-copiar-codigo" onClick={() => void copy()} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-outline/25 text-sm font-semibold hover:bg-background">
                  <Copy size={16} className="text-primary" /> {copied ? 'Copiado' : 'Copiar'}
                </button>
                <a data-testid="btn-whatsapp-codigo" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-outline/25 text-sm font-semibold hover:bg-background">
                  <Share2 size={16} className="text-en-linea" /> WhatsApp
                </a>
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-outline/15 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Agregar por número</p>
            <p className="mt-1 text-[13px] text-on-surface-variant">Entra al toque si ya usa Lilachat; si no, cuando entre con ese número.</p>
            <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); void add(); }}>
              <div className="flex h-11 min-w-0 flex-1 items-center rounded-xl border border-outline/25 bg-background px-3 focus-within:border-primary">
                <span className="mr-2 border-r border-outline/20 pr-2 text-sm text-on-surface-variant">+51</span>
                <input data-testid="input-telefono-espacio" value={phone} inputMode="tel" maxLength={11} onChange={(event) => { setPhone(event.target.value); setError(''); }} placeholder="987 111 222" className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" />
              </div>
              <button type="submit" data-testid="btn-agregar-telefono" className="h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary">Agregar</button>
            </form>
            <FieldError>{error}</FieldError>
            {added.length ? <p className="mb-1 mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Agregados recientes</p> : null}
            {added.map((one) => (
              <div key={one.phone} className="flex min-h-[52px] items-center gap-3 border-t border-outline/10">
                <Avatar name={one.phone} size={36} />
                <span className="flex-1 text-sm">{groupedPhone(one.phone)}</span>
                <span className={`rounded-full border px-2 text-[11px] font-bold ${one.status === 'active' ? 'border-en-linea/40 bg-en-linea/10 text-en-linea' : 'border-primary/30 bg-primary/10 text-primary'}`}>{one.status === 'active' ? 'AGREGADO' : 'INVITADO'}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-4 rounded-xl bg-surface-variant p-4 text-sm text-on-surface-variant">El código lo tienen los admins del espacio: pídeselo a uno de ellos.</p>
      )}
    </Overlay>
  );
}
