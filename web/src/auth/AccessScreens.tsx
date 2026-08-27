import { useEffect, useRef, useState } from 'react';
import { normalizePeruPhone } from '@lilachat/shared';
import { api, deviceId, type Credential } from '../api';

/**
 * Acceso a la web: teléfono → código.
 *
 * Mismo contrato que la app (F1): el número es la identidad, el código llega por
 * WhatsApp y el correo es el RESPALDO que se PIDE — nunca sale solo, o el botón
 * de «mándamelo por correo» no significaría nada.
 */
const CODE_LENGTH = 6;

export function AccessScreens({ onReady }: { onReady: (credential: Credential) => void }) {
  const [phone, setPhone] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  useEffect(() => {
    if (sent) codeRef.current?.focus();
  }, [sent]);

  const request = async (preferEmail = false) => {
    const normalized = normalizePeruPhone(phone);
    if (!normalized) return setError('Escribe un celular válido de 9 dígitos.');

    setBusy(true);
    setError('');
    const result = await api('/auth/otp/request', { body: { phone: normalized, preferEmail } });
    setBusy(false);

    if (!result.ok) return setError(result.message);
    setSent(true);
    setSeconds(60);
  };

  const verify = async (value: string) => {
    setBusy(true);
    setError('');
    const result = await api<{
      jwt: string;
      deviceSecret?: string;
      user: { id: string; name: string | null; phone: string };
    }>('/auth/otp/verify', {
      body: { phone: normalizePeruPhone(phone), code: value, deviceId: deviceId() },
    });
    setBusy(false);

    if (!result.ok) {
      setCode('');
      return setError(
        result.status === 503
          ? 'No pudimos verificar el código. Inténtalo de nuevo.'
          : 'El código no es correcto o ya venció.'
      );
    }
    onReady({
      jwt: result.data.jwt,
      userId: result.data.user.id,
      phone: result.data.user.phone,
      name: result.data.user.name ?? undefined,
      deviceId: deviceId(),
      // Sin esto la sesión moría a las 24 h y había que pedir otro código.
      deviceSecret: result.data.deviceSecret,
    });
  };

  return (
    <main className="grid min-h-full place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary text-on-primary">
            <span className="text-2xl font-bold">L</span>
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">
            {sent ? 'Escribe tu código' : 'Entra a Lilachat'}
          </h1>
          <p className="mt-1 text-sm leading-5 text-on-surface-variant">
            {sent
              ? `Te lo mandamos por WhatsApp al ${phone}.`
              : 'Te enviamos un código por WhatsApp para confirmar que eres tú.'}
          </p>
        </div>

        {sent ? (
          <>
            <input
              ref={codeRef}
              data-testid="input-codigo"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={CODE_LENGTH}
              value={code}
              onChange={(event) => {
                const digits = event.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH);
                setCode(digits);
                setError('');
                // Al sexto dígito se envía solo: pedir un botón después de
                // teclear el código completo es un paso que nadie quiere dar.
                if (digits.length === CODE_LENGTH) void verify(digits);
              }}
              className="w-full rounded-xl border border-outline/25 bg-surface px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] outline-none focus:border-primary"
              placeholder="······"
            />

            {error ? (
              <p data-testid="error-acceso" className="mt-3 text-center text-sm text-error">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              data-testid="btn-reenviar"
              disabled={busy || seconds > 0}
              onClick={() => void request(false)}
              className="mt-6 w-full rounded-lg bg-primary py-3 text-sm font-bold text-on-primary disabled:opacity-40"
            >
              {seconds > 0 ? `Reenviar en ${seconds}s` : 'Reenviar por WhatsApp'}
            </button>

            {/* El respaldo se PIDE. Mandar los dos canales de una vez volvía
                inútil este botón y gastaba dos envíos por código. */}
            <button
              type="button"
              data-testid="btn-por-correo"
              disabled={busy}
              onClick={() => void request(true)}
              className="mt-2 w-full rounded-lg py-3 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-40"
            >
              Enviármelo por correo
            </button>

            <button
              type="button"
              onClick={() => {
                setSent(false);
                setCode('');
                setError('');
              }}
              className="mt-2 w-full py-2 text-xs text-on-surface-variant hover:underline"
            >
              Cambiar de número
            </button>
          </>
        ) : (
          <>
            <label className="block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Celular
            </label>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-outline/25 bg-surface px-3 focus-within:border-primary">
              <span className="text-sm font-semibold text-on-surface-variant">+51</span>
              <input
                data-testid="input-telefono"
                inputMode="numeric"
                autoFocus
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value.replace(/\D/g, '').slice(0, 11));
                  setError('');
                }}
                onKeyDown={(event) => event.key === 'Enter' && void request(false)}
                placeholder="902049935"
                className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none placeholder:text-on-surface-variant"
              />
            </div>

            {error ? (
              <p data-testid="error-acceso" className="mt-2 text-sm text-error">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              data-testid="btn-continuar"
              disabled={busy}
              onClick={() => void request(false)}
              className="mt-6 w-full rounded-lg bg-primary py-3 text-sm font-bold text-on-primary disabled:opacity-40"
            >
              {busy ? 'Enviando…' : 'Continuar'}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
