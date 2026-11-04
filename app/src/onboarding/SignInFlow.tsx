import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { formatPhoneDisplay } from '@lilachat/shared';
import type { Credential } from '../auth/credentialStore';
import { markNotesSeen } from '../settings/WhatsNewHost';
import { markWelcomeSeen } from '../spaces/welcomeSeen';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';
import { YourSpacesScreen } from '../spaces/YourSpacesScreen';
import { EmailCodeScreen } from './EmailCodeScreen';
import { OtpScreen } from './OtpScreen';
import { PhoneScreen } from './PhoneScreen';
import { useHardwareBack } from './useHardwareBack';
import { WorkspaceEntryScreen } from './WorkspaceEntryScreen';

type Step =
  | { name: 'entry' }
  | { name: 'email-code'; email: string }
  /** `personal`: «Usar sin espacio de trabajo», straight to the chats. */
  | { name: 'phone'; personal: boolean }
  | { name: 'phone-code'; phone: string; personal: boolean }
  | { name: 'spaces'; credential: Credential; account: string };

/** The number's screen with a way back to the email, on screen and on Android's back. */
function PhoneStep(props: { onBack: () => void; onCodeRequested: (phone: string) => void }) {
  const colors = useColores();
  const margins = useMargenes();
  useHardwareBack(props.onBack);
  return (
    <View className="flex-1">
      <PhoneScreen onCodeRequested={props.onCodeRequested} />
      <Pressable testID="btn-atras-telefono" accessibilityRole="button" accessibilityLabel="Volver" onPress={props.onBack} className="absolute left-4 h-11 w-11 items-center justify-center" style={{ top: margins.cabecera + 8 }}>
        <ArrowLeft size={24} color={colors['on-surface']} />
      </Pressable>
    </View>
  );
}

/** The way in (spec INGRESO-POR-ESPACIO): email and code like Slack, the phone as an option, then the spaces. */
export function SignInFlow(props: { onDone: (credential: Credential) => void }) {
  const [step, setStep] = useState<Step>({ name: 'entry' });
  const backToEntry = useCallback(() => setStep({ name: 'entry' }), []);
  // Nothing is «new» to someone who just arrived.
  const onDone = (credential: Credential) => {
    markNotesSeen();
    props.onDone(credential);
  };

  if (step.name === 'email-code') {
    return <EmailCodeScreen email={step.email} onBack={backToEntry} onDone={(credential) => setStep({ name: 'spaces', credential, account: step.email })} />;
  }
  if (step.name === 'phone') {
    return <PhoneStep onBack={backToEntry} onCodeRequested={(phone) => setStep({ name: 'phone-code', phone, personal: step.personal })} />;
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
    return <YourSpacesScreen credential={step.credential} account={step.account} onEnter={onDone} />;
  }
  return (
    <WorkspaceEntryScreen
      onCodeRequested={(email) => setStep({ name: 'email-code', email })}
      onUsePhone={() => setStep({ name: 'phone', personal: false })}
      onUsePersonal={() => setStep({ name: 'phone', personal: true })}
    />
  );
}
