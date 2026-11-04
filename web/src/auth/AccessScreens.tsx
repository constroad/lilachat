import { useState } from 'react';
import { ENLACE_DE_DESCARGA, formatPhoneDisplay } from '@lilachat/shared';
import { peekPendingJoin } from '../spaces/pendingJoin';
import { peekPendingCallLink } from '../calls/pendingCallLink';
import type { Credential } from '../api';
import { markWelcomeSeen } from '../spaces/welcomeSeen';
import { markNotesSeen } from '../ui/WhatsNewDialog';
import { YourSpacesPage } from '../spaces/YourSpacesPage';
import { EmailSignIn } from './EmailSignIn';
import type { EmailLink } from './emailLink';
import { IngresoPorTelefono } from './IngresoPorTelefono';
import { PantallaDeVincular } from './PantallaDeVincular';

/**
 * The doors of the web: the phone's QR, like WhatsApp Web (W5), the email and its
 * code, like Slack (spec INGRESO-POR-ESPACIO), or the number. A narrow screen opens
 * by the email: a phone cannot scan its own QR.
 */
const ANCHO_PARA_QR = '(min-width: 768px)';

const abrePorQr = (): boolean => typeof window.matchMedia === 'function' && window.matchMedia(ANCHO_PARA_QR).matches;

type Door = 'qr' | 'email' | 'phone' | 'personal';

export function AccessScreens({ onReady, emailLink }: { onReady: (credential: Credential) => void; emailLink?: EmailLink | null }) {
  const [door, setDoor] = useState<Door>(() => (!emailLink && abrePorQr() ? 'qr' : 'email'));
  const [arrived, setArrived] = useState<{ credential: Credential; account: string } | null>(null);
  const [invited] = useState(() => peekPendingJoin() !== null);
  const [calledIn] = useState(() => peekPendingCallLink() !== null);
  // Nothing is «new» to someone who just arrived.
  const ready = (credential: Credential) => {
    markNotesSeen();
    onReady(credential);
  };
  // A join or a call link already says where this person goes.
  const arrive = (credential: Credential, account: string) => (invited || calledIn ? ready(credential) : setArrived({ credential, account }));
  const fromPhone = (credential: Credential) => {
    if (door === 'phone') return arrive(credential, formatPhoneDisplay(credential.phone));
    markWelcomeSeen();
    ready(credential);
  };
  if (arrived) return <YourSpacesPage credential={arrived.credential} account={arrived.account} onEnter={ready} />;
  return (
    <>
      {invited ? <JoinLinkBanner /> : null}
      {calledIn ? (
        <p data-testid="aviso-enlace-de-llamada" className="mx-auto mt-4 w-[calc(100%-32px)] max-w-md rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm">
          <span className="font-semibold">Te enviaron un enlace de llamada.</span> Entra con tu correo o tu número y se abrirá la llamada.
        </p>
      ) : null}
      {door === 'qr' ? <PantallaDeVincular onReady={ready} onUsarTelefono={() => setDoor('email')} /> : null}
      {door === 'email' ? <EmailSignIn link={emailLink} onVerified={arrive} onUsePhone={() => setDoor('phone')} onUsePersonal={() => setDoor('personal')} onUseQr={() => setDoor('qr')} /> : null}
      {door === 'phone' || door === 'personal' ? (
        <>
          <IngresoPorTelefono onReady={fromPhone} onUsarQr={() => setDoor('qr')} />
          <button type="button" data-testid="btn-atras-telefono" onClick={() => setDoor('email')} className="fixed inset-x-0 bottom-3 mx-auto w-fit py-2 text-sm text-on-surface-variant hover:underline">
            Entrar con mi correo
          </button>
        </>
      ) : null}
    </>
  );
}

/** Someone opened a space's invitation here (pending 47): on a phone, the app; here, after entering, the space. */
function JoinLinkBanner() {
  return (
    <div data-testid="aviso-invitacion" className="mx-auto mt-4 flex w-[calc(100%-32px)] max-w-md flex-col gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm">
      <p className="font-semibold">Te invitaron a un espacio de Lilachat.</p>
      <p className="text-on-surface-variant">En el teléfono, descarga la app y vuelve a tocar el enlace. Aquí, entra con tu correo o tu número y te unes al espacio.</p>
      <a href={ENLACE_DE_DESCARGA} className="self-start font-semibold text-primary underline-offset-2 hover:underline">Descargar Lilachat</a>
    </div>
  );
}
