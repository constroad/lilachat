import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { birthdayFieldError, birthdayFromFields, canFinishProfile, normalizeEmail, type MyProfile } from '@lilachat/shared';
import { getProfile, requestEmailCode, saveProfile, verifyEmailCode } from './profileApi';

const FIELD = 'h-11 rounded-xl border border-outline/25 bg-background px-3 text-[15px] outline-none focus:border-primary';
const Label = ({ children }: { children: string }) => <p className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">{children}</p>;
const pad = (value?: number) => (value ? String(value) : '');

/**
 * «Completa tu perfil» on the web, like the app's (José, 21/10; backlog 17):
 * name and birthday are required to use Lilachat, and this page cannot be
 * skipped. The email is optional (22/10, backlog 51) and proved with a code to
 * that address; only the phone's backup asks for it.
 */
export function CompleteProfileScreen(props: { jwt: string; profile: MyProfile; onDone: (profile: MyProfile) => void }) {
  const { jwt, profile } = props;
  const [name, setName] = useState(profile.name ?? '');
  const [day, setDay] = useState(pad(profile.birthday?.day));
  const [month, setMonth] = useState(pad(profile.birthday?.month));
  const [year, setYear] = useState(pad(profile.birthday?.year));
  const [visible, setVisible] = useState(profile.birthdayVisible);
  const [email, setEmail] = useState(profile.email ?? '');
  const [emailVerified, setEmailVerified] = useState(profile.emailVerified);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'code' | 'verify' | 'save' | null>(null);
  const [error, setError] = useState<{ field: 'email' | 'save'; text: string } | null>(null);
  const birthday = birthdayFromFields({ day, month, year });
  const birthdayHint = birthdayFieldError({ day, month, year });
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
    const saved = await saveProfile(jwt, { name: name.trim(), birthday: birthday.birthday, birthdayVisible: visible });
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
      <form data-testid="pantalla-completa-perfil" onSubmit={(event) => (event.preventDefault(), void finish())} className="w-full max-w-md rounded-2xl border border-outline/15 bg-surface p-6 shadow-sm">
        <img src="/icons/icon-192.png" alt="" className="h-12 w-12 rounded-xl" />
        <h1 className="mt-4 text-xl font-bold tracking-tight">Completa tu perfil</h1>
        <p className="mt-1 text-[14px] text-on-surface-variant">Para usar Lilachat necesitamos tu nombre y tu cumpleaños.</p>

        <Label>Tu nombre</Label>
        <input data-testid="perfil-nombre" className={`${FIELD} w-full`} placeholder="Nombre y apellido" autoComplete="name" maxLength={60} value={name} onChange={(event) => setName(event.target.value)} />

        <Label>Tu cumpleaños</Label>
        <div className="flex gap-2">
          <input data-testid="perfil-dia" className={`${FIELD} w-20 text-center`} placeholder="Día" inputMode="numeric" maxLength={2} value={day} onChange={(event) => setDay(event.target.value)} />
          <input data-testid="perfil-mes" className={`${FIELD} w-20 text-center`} placeholder="Mes" inputMode="numeric" maxLength={2} value={month} onChange={(event) => setMonth(event.target.value)} />
          <input data-testid="perfil-anio" className={`${FIELD} min-w-0 flex-1 text-center`} placeholder="Año (opcional)" inputMode="numeric" maxLength={4} value={year} onChange={(event) => setYear(event.target.value)} />
        </div>
        {birthdayHint ? <p data-testid="perfil-error-cumple" role="alert" className="mt-2 text-[13px] text-error">{birthdayHint}</p> : null}
        <label className="mt-3 flex cursor-pointer items-center gap-3 text-[14px]">
          <input data-testid="perfil-visible" type="checkbox" checked={visible} onChange={(event) => setVisible(event.target.checked)} className="h-4 w-4 accent-primary" />
          Que mis chats vean mi cumpleaños
        </label>

        <Label>Tu correo (opcional)</Label>
        {emailVerified ? (
          <div data-testid="perfil-correo-ok" className="flex h-11 items-center gap-2 rounded-xl border border-en-linea/30 bg-en-linea/10 px-3">
            <CheckCircle2 size={18} className="text-en-linea" />
            <span className="min-w-0 flex-1 truncate">{normalizeEmail(email) || email}</span>
            <button type="button" data-testid="perfil-cambiar-correo" onClick={() => (setEmailVerified(false), setCodeSent(false), setCode(''))} className="text-sm font-semibold text-primary">Cambiar</button>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <input data-testid="perfil-correo" type="email" className={`${FIELD} min-w-0 flex-1`} placeholder="tucorreo@ejemplo.com" autoComplete="email" value={email} onChange={(event) => (setEmail(event.target.value), setCodeSent(false))} />
              <button type="button" data-testid="perfil-enviar-codigo" disabled={busy !== null} onClick={() => void sendCode()} className="h-11 shrink-0 rounded-xl border border-primary/40 px-3 text-sm font-semibold text-primary disabled:opacity-60">{busy === 'code' ? 'Enviando…' : codeSent ? 'Reenviar' : 'Enviar código'}</button>
            </div>
            {codeSent ? (
              <div className="mt-2 flex gap-2">
                <input data-testid="perfil-codigo" className={`${FIELD} min-w-0 flex-1 text-center tracking-widest`} placeholder="Código de 6 dígitos" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} />
                <button type="button" data-testid="perfil-verificar" disabled={code.length < 6 || busy !== null} onClick={() => void verify()} className="h-11 shrink-0 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-50">{busy === 'verify' ? 'Verificando…' : 'Verificar'}</button>
              </div>
            ) : null}
            <p className="mt-2 text-[13px] text-on-surface-variant">{codeSent ? 'Te enviamos un código a ese correo.' : 'Lo necesitas solo para activar la copia de seguridad del teléfono.'}</p>
          </>
        )}
        {error?.field === 'email' ? <p role="alert" className="mt-2 text-[13px] text-error">{error.text}</p> : null}

        {error?.field === 'save' ? <p role="alert" className="mt-5 text-center text-[13px] text-error">{error.text}</p> : null}
        <button type="submit" data-testid="perfil-continuar" disabled={!ready || busy !== null} className="mt-6 h-11 w-full rounded-full bg-primary text-sm font-semibold text-on-primary disabled:opacity-50">{busy === 'save' ? 'Guardando…' : 'Continuar'}</button>
      </form>
    </main>
  );
}
