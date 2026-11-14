import { useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { birthdayDraftOf, birthdayFromFields, canFinishProfile, normalizeEmail, type MyProfile } from '@lilachat/shared';
import { BirthdayFields } from './BirthdayFields';
import { getProfile, requestEmailCode, saveProfile, verifyEmailCode } from './profileApi';

const FIELD = 'h-11 rounded-xl border border-outline/25 bg-background px-3 text-[15px] outline-none focus:border-primary';
const Label = ({ children }: { children: string }) => <p className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">{children}</p>;

type EmailFieldProps = {
  email: string; verified: boolean; codeSent: boolean; code: string; busy: 'code' | 'verify' | 'save' | null;
  onEmail: (value: string) => void; onCode: (value: string) => void; onSend: () => void; onVerify: () => void; onChange: () => void;
};

/** The optional email, proved with a code: its own piece so the screen stays one thing. */
function EmailField(props: EmailFieldProps) {
  return props.verified ? (
    <div data-testid="perfil-correo-ok" className="flex h-11 items-center gap-2 rounded-xl border border-en-linea/30 bg-en-linea/10 px-3">
      <CheckCircle2 size={18} className="text-en-linea" />
      <span className="min-w-0 flex-1 truncate">{normalizeEmail(props.email) || props.email}</span>
      <button type="button" data-testid="perfil-cambiar-correo" onClick={props.onChange} className="text-sm font-semibold text-primary">Cambiar</button>
    </div>
  ) : (
    <>
      <div className="flex gap-2">
        <input data-testid="perfil-correo" type="email" className={`${FIELD} min-w-0 flex-1`} placeholder="tucorreo@ejemplo.com" autoComplete="email" value={props.email} onChange={(event) => props.onEmail(event.target.value)} />
        <button type="button" data-testid="perfil-enviar-codigo" disabled={props.busy !== null} onClick={props.onSend} className="h-11 shrink-0 rounded-xl border border-primary/40 px-3 text-sm font-semibold text-primary disabled:opacity-60">{props.busy === 'code' ? 'Enviando…' : props.codeSent ? 'Reenviar' : 'Enviar código'}</button>
      </div>
      {props.codeSent ? (
        <div className="mt-2 flex gap-2">
          <input data-testid="perfil-codigo" className={`${FIELD} min-w-0 flex-1 text-center tracking-widest`} placeholder="Código de 6 dígitos" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={props.code} onChange={(event) => props.onCode(event.target.value)} />
          <button type="button" data-testid="perfil-verificar" disabled={props.code.length < 6 || props.busy !== null} onClick={props.onVerify} className="h-11 shrink-0 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-50">{props.busy === 'verify' ? 'Verificando…' : 'Verificar'}</button>
        </div>
      ) : null}
      <p className="mt-2 text-[13px] text-on-surface-variant">{props.codeSent ? 'Te enviamos un código a ese correo.' : 'Lo necesitas solo para activar la copia de seguridad del teléfono.'}</p>
    </>
  );
}

/**
 * «Completa tu perfil» on the web, like the app's (José, 21/10; backlog 17):
 * name and birthday are required to use Lilachat, and this page cannot be
 * skipped. The email is optional (22/10, backlog 51) and proved with a code to
 * that address; only the phone's backup asks for it. Opened from the birthday
 * reminder (José, 14/11) it gets `onCancel`: a way out, since nothing blocks.
 */
export function CompleteProfileScreen(props: { jwt: string; profile: MyProfile; onDone: (profile: MyProfile) => void; onCancel?: () => void }) {
  const { jwt, profile } = props;
  const [name, setName] = useState(profile.name ?? '');
  const [draft, setDraft] = useState(() => birthdayDraftOf(profile.birthday));
  const [email, setEmail] = useState(profile.email ?? '');
  const [emailVerified, setEmailVerified] = useState(profile.emailVerified);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'code' | 'verify' | 'save' | null>(null);
  const [error, setError] = useState<{ field: 'email' | 'save'; text: string } | null>(null);
  const birthday = birthdayFromFields(draft);
  const ready = canFinishProfile({ name, birthdayOk: birthday.ok });

  const sendCode = async () => {
    const clean = normalizeEmail(email);
    if (!clean) return setError({ field: 'email', text: 'Ese correo no parece válido.' });
    setBusy('code');
    setError(null);
    const sent = await requestEmailCode(jwt, clean);
    setBusy(null);
    if (sent.ok) setCodeSent(true);
    else setError({ field: 'email', text: sent.message });
  };
  const verify = async () => {
    setBusy('verify');
    setError(null);
    const result = await verifyEmailCode(jwt, normalizeEmail(email), code);
    setBusy(null);
    if (result.ok) setEmailVerified(true);
    else setError({ field: 'email', text: result.message });
  };
  const finish = async () => {
    if (!birthday.ok) return;
    setBusy('save');
    setError(null);
    const saved = await saveProfile(jwt, { name: name.trim(), birthday: birthday.birthday });
    if (!saved.ok) {
      setBusy(null);
      return setError({ field: 'save', text: saved.message });
    }
    // What the server says is missing decides: another device may have completed it meanwhile.
    const latest = saved.data.profile.missing.length ? await getProfile(jwt) : saved;
    setBusy(null);
    if (latest.ok && latest.data.profile.missing.length === 0) props.onDone(latest.data.profile);
    else setError({ field: 'save', text: 'Falta completar algo: revisa tu nombre y tu cumpleaños.' });
  };

  return (
    <main className="grid min-h-full place-items-center px-4 py-8">
      <form data-testid="pantalla-completa-perfil" onSubmit={(event) => (event.preventDefault(), void finish())} className="relative w-full max-w-md rounded-2xl border border-outline/15 bg-surface p-6 shadow-sm">
        {props.onCancel ? (
          <button type="button" data-testid="perfil-cerrar" aria-label="Cerrar" onClick={props.onCancel} className="absolute right-2 top-2 grid h-11 w-11 place-items-center rounded-full text-on-surface-variant hover:bg-background"><X size={18} /></button>
        ) : null}
        <img src="/icons/icon-192.png" alt="" className="h-12 w-12 rounded-xl" />
        <h1 className="mt-4 text-xl font-bold tracking-tight">Completa tu perfil</h1>
        <p className="mt-1 text-[14px] text-on-surface-variant">Para usar Lilachat necesitamos tu nombre y tu cumpleaños.</p>

        <Label>Tu nombre</Label>
        <input data-testid="perfil-nombre" className={`${FIELD} w-full`} placeholder="Nombre y apellido" autoComplete="name" maxLength={60} value={name} onChange={(event) => setName(event.target.value)} />

        <Label>Tu cumpleaños</Label>
        <BirthdayFields value={draft} onChange={setDraft} fieldClass={FIELD} />

        <Label>Tu correo (opcional)</Label>
        <EmailField email={email} verified={emailVerified} codeSent={codeSent} code={code} busy={busy}
          onEmail={(value) => (setEmail(value), setCodeSent(false))} onCode={setCode} onSend={() => void sendCode()} onVerify={() => void verify()}
          onChange={() => (setEmailVerified(false), setCodeSent(false), setCode(''))} />
        {error?.field === 'email' ? <p role="alert" className="mt-2 text-[13px] text-error">{error.text}</p> : null}

        {error?.field === 'save' ? <p role="alert" className="mt-5 text-center text-[13px] text-error">{error.text}</p> : null}
        <button type="submit" data-testid="perfil-continuar" disabled={!ready || busy !== null} className="mt-6 h-11 w-full rounded-full bg-primary text-sm font-semibold text-on-primary disabled:opacity-50">{busy === 'save' ? 'Guardando…' : 'Continuar'}</button>
      </form>
    </main>
  );
}
