import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { countdownLabel } from '@lilachat/shared';
import { requestEmailSignIn, verifyEmailSignIn } from '../api/client';
import { saveCredential, type Credential } from '../auth/credentialStore';
import { obtenerDeviceIdEstable } from '../auth/deviceId';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';
import { credentialOfSignIn, mapVerifyFailure, shouldAutoSubmitOtp } from './machine';
import { OtpBoxes } from './OtpBoxes';
import { useCountdown } from './useCountdown';
import { useHardwareBack } from './useHardwareBack';

const RESEND_SECONDS = 60;

/** «Revisa tu correo» (design `i-02-codigo-correo`): the sixth digit sends it, so there is no button. */
export function EmailCodeScreen({ email, onDone, onBack }: { email: string; onDone: (credential: Credential) => void; onBack: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const { secondsLeft, restart } = useCountdown(RESEND_SECONDS);
  const inputRef = useRef<TextInput>(null);
  useHardwareBack(onBack);

  const verify = async (candidate: string) => {
    if (verifying) return;
    setVerifying(true);
    setError('');
    const deviceId = await obtenerDeviceIdEstable();
    const result = await verifyEmailSignIn({ email, code: candidate, deviceId });
    setVerifying(false);
    if (!result.ok) return setError(mapVerifyFailure(result.status, result.message));
    const credential = credentialOfSignIn(result.data, deviceId);
    await saveCredential(credential);
    onDone(credential);
  };

  const onChange = (next: string) => {
    const digits = next.replace(/\D/g, '').slice(0, 6);
    const previous = code;
    setCode(digits);
    setError('');
    if (shouldAutoSubmitOtp(previous, digits)) void verify(digits);
  };

  return (
    <View testID="pantalla-codigo-correo" className="flex-1 bg-background px-6" style={{ paddingTop: margins.cabecera + 8 }}>
      <Pressable testID="btn-atras-correo" accessibilityRole="button" accessibilityLabel="Volver" onPress={onBack} className="-ml-2 h-11 w-11 items-center justify-center">
        <ArrowLeft size={24} color={colors['on-surface']} />
      </Pressable>
      <Text className="mt-6 text-3xl font-bold text-on-surface">Revisa tu correo</Text>
      <Text className="mt-3 text-base leading-6 text-on-surface-variant">Enviamos un código de 6 dígitos a</Text>
      <Text className="text-base font-semibold leading-6 text-on-surface">{email}</Text>

      <OtpBoxes code={code} inputRef={inputRef} onChange={onChange} />

      {verifying ? <ActivityIndicator className="mt-4 self-start" color={colors.primary} /> : null}
      {error ? <Text testID="error-otp" className="mt-3 text-sm text-error">{error}</Text> : null}

      <Pressable
        testID="btn-reenviar"
        disabled={secondsLeft > 0}
        onPress={() => {
          restart();
          void requestEmailSignIn(email);
        }}
        className="mt-5 min-h-[44px] justify-center"
      >
        {secondsLeft > 0 ? (
          <Text className="text-sm text-on-surface-variant">Reenviar el código en <Text className="font-semibold text-on-surface">{countdownLabel(secondsLeft)}</Text></Text>
        ) : (
          <Text className="text-sm font-semibold text-primary">Reenviar el código</Text>
        )}
      </Pressable>
      <Pressable testID="btn-cambiar-correo" onPress={onBack} className="min-h-[44px] justify-center">
        <Text className="text-[15px] font-semibold text-primary">Cambiar de correo</Text>
      </Pressable>
    </View>
  );
}
