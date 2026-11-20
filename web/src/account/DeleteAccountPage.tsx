import { useState } from 'react';
import { ACCOUNT_DELETION_TEXTS, deletionClosedLine } from '@lilachat/shared';
import type { Credential } from '../api';
import { EmailSignIn } from '../auth/EmailSignIn';
import { IngresoPorTelefono } from '../auth/IngresoPorTelefono';
import { PantallaDeVincular } from '../auth/PantallaDeVincular';
import { Logo } from '../ui/Logo';
import { DeleteAccountConfirm, DeletionExplanation } from './DeleteAccountConfirm';
import { takeDeletionCancelled, takeDeletionDeadline } from './deletionCancelledNotice';

type Step = { name: 'info' } | { name: 'signIn'; door: Door } | { name: 'confirm'; credential: Credential; cancelled: boolean } | { name: 'done'; deadline: Date };

/**
 * `https://lilachat.constroad.com/borrar-cuenta` (Google Play, José 19/11):
 * without a session of this browser. It explains, signs in with the code by
 * email or phone, or links with the phone's QR (the web's doors) and confirms with the word.
 */
export function DeleteAccountPage() {
  const [step, setStep] = useState<Step>(() => {
    const deadline = takeDeletionDeadline();
    return deadline ? { name: 'done', deadline } : { name: 'info' };
  });
  const signedIn = (credential: Credential) => setStep({ name: 'confirm', credential, cancelled: takeDeletionCancelled() });
  if (step.name === 'signIn') return <SignInStep door={step.door} onDoor={(door) => setStep({ name: 'signIn', door })} onSignedIn={signedIn} />;
  return (
    <main data-testid="pagina-borrar-cuenta" className="min-h-full bg-background px-4 py-8 text-on-surface">
      <div className="mx-auto w-full max-w-md">
        <div className="flex items-center justify-center gap-2"><Logo size={40} /><span className="text-[22px] font-bold">Lilachat</span></div>
        <h1 className="mt-8 text-[26px] font-bold leading-8 tracking-tight">Borrar tu cuenta de Lilachat</h1>
        {step.name === 'info' ? <InfoStep onContinue={() => setStep({ name: 'signIn', door: 'email' })} /> : null}
        {step.name === 'confirm' ? <ConfirmStep jwt={step.credential.jwt} cancelled={step.cancelled} onDeleted={(deadline) => setStep({ name: 'done', deadline })} /> : null}
        {step.name === 'done' ? <p data-testid="borrado-pedido" className="mt-6 rounded-lg bg-surface-variant/50 p-4 text-[15px] leading-6">{deletionClosedLine(step.deadline)}</p> : null}
      </div>
    </main>
  );
}

function InfoStep(props: { onContinue: () => void }) {
  return (
    <div className="mt-5 flex flex-col gap-3 text-sm">
      <DeletionExplanation />
      <p className="text-on-surface-variant">Para saber que eres tú, entra con el código que te enviamos a tu correo o por WhatsApp a tu número.</p>
      <button type="button" data-testid="btn-continuar-borrar" onClick={props.onContinue} className="mt-2 h-12 w-full rounded-lg bg-primary text-sm font-bold text-on-primary">Continuar</button>
    </div>
  );
}

function ConfirmStep(props: { jwt: string; cancelled: boolean; onDeleted: (deadline: Date) => void }) {
  return (
    <div className="mt-5">
      {props.cancelled ? (
        <p data-testid="aviso-borrado-cancelado" className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <span className="font-semibold">{ACCOUNT_DELETION_TEXTS.cancelledTitle}.</span> {ACCOUNT_DELETION_TEXTS.cancelledBody} Si igual quieres borrarla, confirma abajo.
        </p>
      ) : null}
      <DeleteAccountConfirm jwt={props.jwt} onDeleted={props.onDeleted} />
    </div>
  );
}

type Door = 'email' | 'phone' | 'qr';

/** The same three doors as the web's access: email, phone, or the phone's QR. */
function SignInStep(props: { door: Door; onDoor: (door: Door) => void; onSignedIn: (credential: Credential) => void }) {
  return (
    <>
      <p className="mx-auto mt-4 w-[calc(100%-32px)] max-w-md rounded-2xl border border-error/30 bg-error/5 p-4 text-sm">
        <span className="font-semibold">Borrar tu cuenta.</span> Entra con tu correo o tu número para confirmar que eres tú.
      </p>
      {props.door === 'email' ? <EmailSignIn onVerified={props.onSignedIn} onUsePhone={() => props.onDoor('phone')} onUsePersonal={() => props.onDoor('phone')} onUseQr={() => props.onDoor('qr')} /> : null}
      {props.door === 'phone' ? <IngresoPorTelefono onReady={props.onSignedIn} onUsarQr={() => props.onDoor('qr')} /> : null}
      {props.door === 'qr' ? <PantallaDeVincular onReady={props.onSignedIn} onUsarTelefono={() => props.onDoor('email')} /> : null}
      {props.door !== 'email' ? (
        <button type="button" data-testid="btn-atras-borrar" onClick={() => props.onDoor('email')} className="mx-auto block py-2 text-sm text-on-surface-variant hover:underline">Entrar con mi correo</button>
      ) : null}
    </>
  );
}
