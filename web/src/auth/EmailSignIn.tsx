import { useEffect, useRef, useState, type RefObject } from 'react';
import { ArrowLeft, Smartphone } from 'lucide-react';
import { countdownLabel, normalizeEmail } from '@lilachat/shared';
import { api, deviceId, type Credential } from '../api';
import { Logo } from '../ui/Logo';

const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;

type SignedIn = { jwt: string; user: { id: string; name: string | null; phone: string } };

/**
 * «Entra a tu espacio de trabajo» and «Revisa tu correo» (designs `i-01`, `i-02`):
 * the email and its code first, like Slack; the phone and the QR stay one click
 * away, and a discreet link keeps the personal use.
 */
export function EmailSignIn(props: { onVerified: (credential: Credential, email: string) => void; onUsePhone: () => void; onUsePersonal: () => void; onUseQr: () => void }) {
  const [rawEmail, setRawEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  const email = normalizeEmail(rawEmail);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);
  useEffect(() => {
    if (sent) codeRef.current?.focus();
  }, [sent]);

  const request = async () => {
    if (!email) return setError('Escribe un correo válido.');
    setBusy(true);
    setError('');
    const result = await api('/auth/email/request', { body: { email } });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    setSent(true);
    setSeconds(RESEND_SECONDS);
  };

  const verify = async (value: string) => {
    setBusy(true);
    setError('');
    // `cliente: 'web'` (W0): the device secret comes back in an HttpOnly cookie, not in the body.
    const result = await api<SignedIn>('/auth/email/verify', { body: { email, code: value, deviceId: deviceId(), cliente: 'web' } });
    setBusy(false);
    if (!result.ok) {
      setCode('');
      return setError(result.status === 503 ? 'No pudimos verificar el código. Inténtalo de nuevo.' : 'El código no es correcto o ya venció.');
    }
    props.onVerified({ jwt: result.data.jwt, userId: result.data.user.id, phone: result.data.user.phone, name: result.data.user.name ?? undefined, deviceId: deviceId() }, email);
  };

  const onCode = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    setError('');
    if (digits.length === CODE_LENGTH) void verify(digits);
  };

  if (sent) return <CodeStep email={email} code={code} error={error} busy={busy} seconds={seconds} codeRef={codeRef} onCode={onCode} onResend={() => void request()} onBack={() => setSent(false)} />;
  return <EmailStep rawEmail={rawEmail} error={error} busy={busy} onEmail={(text) => { setRawEmail(text); setError(''); }} onSubmit={() => void request()} doors={props} />;
}

function CodeStep(props: { email: string; code: string; error: string; busy: boolean; seconds: number; codeRef: RefObject<HTMLInputElement>; onCode: (text: string) => void; onResend: () => void; onBack: () => void }) {
  const { email, code, error, busy, seconds, codeRef, onCode } = props;
  return (
    <main className="grid min-h-full place-items-center px-4" data-testid="pantalla-codigo-correo">
      <div className="w-full max-w-sm">
        <button type="button" data-testid="btn-atras-correo" aria-label="Volver" onClick={props.onBack} className="-ml-2 grid h-11 w-11 place-items-center rounded-full hover:bg-surface-variant"><ArrowLeft size={22} /></button>
        <h1 className="mt-5 text-3xl font-bold tracking-tight">Revisa tu correo</h1>
        <p className="mt-2 text-[15px] leading-6 text-on-surface-variant">Enviamos un código de 6 dígitos a</p>
        <p className="text-[15px] font-semibold leading-6">{email}</p>
        <label className="relative mt-7 flex justify-between">
          {Array.from({ length: CODE_LENGTH }, (_unused, index) => (
            <span key={index} className={`grid h-14 w-12 place-items-center rounded-lg border bg-surface text-2xl font-semibold ${index === code.length ? 'border-primary' : 'border-outline/25'}`}>{code[index] ?? ''}</span>
          ))}
          <input ref={codeRef} data-testid="input-codigo" aria-label="Código" inputMode="numeric" autoComplete="one-time-code" maxLength={CODE_LENGTH} value={code} onChange={(event) => onCode(event.target.value)} className="absolute inset-0 opacity-0" />
        </label>
        {error ? <p data-testid="error-acceso" className="mt-3 text-sm text-error">{error}</p> : null}
        <button type="button" data-testid="btn-reenviar" disabled={busy || seconds > 0} onClick={props.onResend} className="mt-5 block py-2 text-sm font-semibold text-primary disabled:font-normal disabled:text-on-surface-variant">
          {seconds > 0 ? `Reenviar el código en ${countdownLabel(seconds)}` : 'Reenviar el código'}
        </button>
        <button type="button" data-testid="btn-cambiar-correo" onClick={props.onBack} className="block py-2 text-[15px] font-semibold text-primary">Cambiar de correo</button>
      </div>
    </main>
  );
}

type Doors = { onUsePhone: () => void; onUsePersonal: () => void; onUseQr: () => void };

function EmailStep(props: { rawEmail: string; error: string; busy: boolean; onEmail: (text: string) => void; onSubmit: () => void; doors: Doors }) {
  const { rawEmail, error, busy, doors } = props;
  return (
    <main className="grid min-h-full place-items-center px-4" data-testid="pantalla-entrar">
      <div className="w-full max-w-sm py-8">
        <div className="flex items-center justify-center gap-2"><Logo size={40} /><span className="text-[22px] font-bold">Lilachat</span></div>
        <h1 className="mt-10 text-[26px] font-bold leading-8 tracking-tight">Entra a tu espacio de trabajo</h1>
        <p className="mt-2 text-[15px] leading-[22px] text-on-surface-variant">Escribe tu correo de trabajo. Te enviamos un código para entrar.</p>
        <label className="mt-7 block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant" htmlFor="correo">Correo</label>
        <input
          id="correo"
          data-testid="input-correo"
          type="email"
          autoFocus
          autoComplete="email"
          placeholder="nombre@empresa.com"
          value={rawEmail}
          onChange={(event) => props.onEmail(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && props.onSubmit()}
          className="mt-2 h-12 w-full rounded-lg border border-outline/25 bg-surface px-4 text-base outline-none placeholder:text-on-surface-variant focus:border-primary"
        />
        {error ? <p data-testid="error-acceso" className="mt-2 text-sm text-error">{error}</p> : null}
        <button type="button" data-testid="btn-continuar-correo" disabled={busy} onClick={props.onSubmit} className="mt-4 h-12 w-full rounded-lg bg-primary text-sm font-bold text-on-primary disabled:opacity-40">{busy ? 'Enviando…' : 'Continuar'}</button>
        <div className="my-5 flex items-center gap-3 text-[13px] text-on-surface-variant"><span className="h-px flex-1 bg-outline/20" />o<span className="h-px flex-1 bg-outline/20" /></div>
        <button type="button" data-testid="btn-entrar-telefono" onClick={doors.onUsePhone} className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-outline/30 text-[15px] font-semibold hover:bg-surface-variant/50"><Smartphone size={18} />Entrar con mi número de teléfono</button>
        <button type="button" data-testid="btn-usar-qr" onClick={doors.onUseQr} className="mt-3 w-full py-2 text-sm font-semibold text-primary hover:underline">Vincular con el código QR del teléfono</button>
        <button type="button" data-testid="btn-sin-espacio" onClick={doors.onUsePersonal} className="mt-6 w-full py-2 text-sm text-on-surface-variant hover:underline">Usar sin espacio de trabajo</button>
      </div>
    </main>
  );
}
