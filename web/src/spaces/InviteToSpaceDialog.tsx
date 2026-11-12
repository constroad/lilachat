import { useState } from 'react';
import { Copy, Mail, Share2 } from 'lucide-react';
import { EMAIL_INVITE_HINT, emailInviteBadge, spaceInviteMessage, type ClientWorkspace, type SpaceEmailInvite } from '@lilachat/shared';
import { Avatar } from '../ui/Avatar';
import { FieldError, Overlay } from '../ui/Overlay';
import { copiarTexto } from '../chat/copiarTexto';
import { addToSpace, inviteToSpaceByEmail } from './spacesApi';

/** A Peruvian mobile, as the server keeps it: nine digits. */
const PHONE_DIGITS = 9;
const groupedPhone = (phone: string) => phone.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BADGE_TONE: Record<ReturnType<typeof emailInviteBadge>['tone'], string> = {
  ok: 'border-en-linea/40 bg-en-linea/10 text-en-linea',
  info: 'border-primary/30 bg-primary/10 text-primary',
  warn: 'border-warning/30 bg-warning/10 text-warning',
};

/** An invited email: whether Lilachat's email went, and «Reenviar» when it did not (José 12/11). */
function EmailInviteRow(props: { invite: SpaceEmailInvite; sending: boolean; onResend: () => void }) {
  const { invite } = props;
  const badge = emailInviteBadge(invite);
  const unsent = invite.status === 'invited' && !invite.emailSent;
  return (
    <div data-testid={`invitado-correo-${invite.email}`} className="mt-3 border-t border-outline/10 pt-2">
      <div className="flex min-h-[44px] items-center gap-3">
        <Mail size={16} className="shrink-0 text-on-surface-variant" />
        <span className="min-w-0 flex-1 break-all text-sm">{invite.email}</span>
        <span className={`shrink-0 rounded-full border px-2 text-[11px] font-bold ${BADGE_TONE[badge.tone]}`}>{badge.label}</span>
      </div>
      {unsent ? (
        <div className="flex items-center gap-2 pb-1">
          <p className="min-w-0 flex-1 text-[12px] text-error">{invite.emailError ?? 'El correo no salió.'}</p>
          <button type="button" data-testid={`reenviar-correo-${invite.email}`} disabled={props.sending} onClick={props.onResend} className="h-10 shrink-0 rounded-lg border border-primary/30 px-3 text-[13px] font-semibold text-primary disabled:opacity-60">{props.sending ? 'Enviando…' : 'Reenviar'}</button>
        </div>
      ) : null}
    </div>
  );
}

/** «Invitar por correo»: Lilachat sends the email (José 12/11), and a failed one is resent from its row. */
function EmailInviteCard({ space, jwt }: { space: ClientWorkspace; jwt: string }) {
  const [email, setEmail] = useState('');
  const [emailed, setEmailed] = useState<SpaceEmailInvite[]>([]);
  const [emailError, setEmailError] = useState('');
  const [sending, setSending] = useState<string | null>(null);
  const typed = email.trim().toLowerCase();
  const sendInvite = async (wanted: string) => {
    setSending(wanted);
    const response = await inviteToSpaceByEmail(jwt, space.id, wanted);
    setSending(null);
    if (!response.ok) return setEmailError(response.message);
    setEmailed((before) => [response.data, ...before.filter((one) => one.email !== response.data.email)]);
    setEmailError('');
    if (wanted === typed) setEmail('');
  };
  const inviteByEmail = () => (EMAIL_PATTERN.test(typed) ? void sendInvite(typed) : setEmailError('Escribe un correo válido.'));
  return (
    <div data-testid="tarjeta-invitar-correo" className="mt-4 overflow-hidden rounded-xl border border-outline/15">
      <div className="h-[3px] bg-primary" />
      <div className="p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Invitar por correo</p>
        <p className="mt-1 text-[13px] text-on-surface-variant">{EMAIL_INVITE_HINT}</p>
        <form noValidate className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); inviteByEmail(); }}>
          <input data-testid="input-correo-espacio" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setEmailError(''); }} placeholder="nombre@empresa.pe" autoComplete="off" className="h-11 min-w-0 flex-1 rounded-xl border border-outline/25 bg-background px-3 text-sm outline-none focus:border-primary" />
          <button type="submit" data-testid="btn-invitar-correo" disabled={sending !== null} className="flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-60"><Mail size={16} /> {sending !== null && sending === typed ? 'Enviando…' : 'Invitar'}</button>
        </form>
        <FieldError>{emailError}</FieldError>
        {emailed.map((one) => <EmailInviteRow key={one.email} invite={one} sending={sending === one.email} onResend={() => void sendInvite(one.email)} />)}
      </div>
    </div>
  );
}

/**
 * «Invitar personas» (design `e1-05-invitar`). A company invites by email first
 * (José, 21/10 and 22/10): the server keeps the invitation and the person
 * joins on their own when they verify that email in their profile (one account
 * per person, the phone); Lilachat sends the email (constroad-auth, José 12/11). Then
 * the code by WhatsApp or copied, and adding someone by number. Only those who
 * can invite see these.
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
      <p className="mt-1 text-sm text-on-surface-variant">Invita por correo, envía el código por WhatsApp o agrega a tu equipo por su número de celular.</p>
      {space.joinCode ? (
        <>
          <EmailInviteCard space={space} jwt={props.jwt} />
          <div data-testid="tarjeta-codigo-espacio" className="mt-4 overflow-hidden rounded-xl border border-outline/15">
            <div className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Código del espacio</p>
                <span className="rounded-full border border-en-linea/40 bg-en-linea/10 px-2 text-[11px] font-bold text-en-linea">ACTIVO</span>
              </div>
              <p data-testid="codigo-espacio" className="my-3 select-all text-center font-mono text-3xl font-bold tracking-[0.2em]">{space.joinCode}</p>
              <div className="flex gap-2">
                <a data-testid="btn-whatsapp-codigo" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-outline/25 text-sm font-semibold hover:bg-background">
                  <Share2 size={16} className="text-en-linea" /> WhatsApp
                </a>
                <button type="button" data-testid="btn-copiar-codigo" onClick={() => void copy()} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-outline/25 text-sm font-semibold hover:bg-background">
                  <Copy size={16} className="text-primary" /> {copied ? 'Copiado' : 'Copiar'}
                </button>
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
