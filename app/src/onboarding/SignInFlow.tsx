import { useState } from 'react';
import { formatPhoneDisplay } from '@lilachat/shared';
import type { Credential } from '../auth/credentialStore';
import { markWelcomeSeen } from '../spaces/welcomeSeen';
import { YourSpacesScreen } from '../spaces/YourSpacesScreen';
import { EmailCodeScreen } from './EmailCodeScreen';
import { OtpScreen } from './OtpScreen';
import { PhoneScreen } from './PhoneScreen';
import { WorkspaceEntryScreen } from './WorkspaceEntryScreen';

type Step =
  | { name: 'entry' }
  | { name: 'email-code'; email: string }
  /** `personal`: «Usar sin espacio de trabajo», straight to the chats. */
  | { name: 'phone'; personal: boolean }
  | { name: 'phone-code'; phone: string; personal: boolean }
  | { name: 'spaces'; credential: Credential; account: string };

/** The way in (spec INGRESO-POR-ESPACIO): email and code like Slack, the phone as an option, then the spaces. */
export function SignInFlow({ onDone }: { onDone: (credential: Credential) => void }) {
  const [step, setStep] = useState<Step>({ name: 'entry' });

  if (step.name === 'email-code') {
    return <EmailCodeScreen email={step.email} onBack={() => setStep({ name: 'entry' })} onDone={(credential) => setStep({ name: 'spaces', credential, account: step.email })} />;
  }
  if (step.name === 'phone') {
    return <PhoneScreen onBack={() => setStep({ name: 'entry' })} onCodeRequested={(phone) => setStep({ name: 'phone-code', phone, personal: step.personal })} />;
  }
  if (step.name === 'phone-code') {
    const finish = (credential: Credential) => {
      if (!step.personal) return setStep({ name: 'spaces', credential, account: formatPhoneDisplay(step.phone) });
      markWelcomeSeen();
      onDone(credential);
    };
    return <OtpScreen phone={step.phone} onBack={() => setStep({ name: 'phone', personal: step.personal })} onDone={finish} />;
  }
  if (step.name === 'spaces') {
    return <YourSpacesScreen credential={step.credential} account={step.account} onEnter={() => onDone(step.credential)} />;
  }
  return (
    <WorkspaceEntryScreen
      onCodeRequested={(email) => setStep({ name: 'email-code', email })}
      onUsePhone={() => setStep({ name: 'phone', personal: false })}
      onUsePersonal={() => setStep({ name: 'phone', personal: true })}
    />
  );
}
