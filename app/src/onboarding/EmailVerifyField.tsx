import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';
import { normalizeEmail } from '@lilachat/shared';
import { requestEmailCode, verifyEmailCode } from '../api/profileApi';
import { useColores } from '../ui/tema';

const FIELD = 'h-[52px] rounded-lg border border-outline/20 bg-surface-variant/40 px-4 text-base text-on-surface';

/**
 * The email, proved like the phone: a code to that address. Used by «Completa
 * tu perfil» (where it is optional since 22/10, backlog 51) and by the backup,
 * the one thing that requires it.
 */
export function EmailVerifyField(props: { jwt: string; email: string | null; verified: boolean; hint: string; onVerified?: (email: string) => void }) {
  const colors = useColores();
  const [email, setEmail] = useState(props.email ?? '');
  const [verified, setVerified] = useState(props.verified);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'code' | 'verify' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    const clean = normalizeEmail(email);
    if (!clean) return setError('Ese correo no parece válido.');
    setBusy('code');
    setError(null);
    const sent = await requestEmailCode(props.jwt, clean);
    setBusy(null);
    if (sent.ok) setCodeSent(true);
    else setError(sent.message ?? 'No se pudo enviar el código.');
  };
  const verify = async () => {
    const clean = normalizeEmail(email);
    setBusy('verify');
    setError(null);
    const result = await verifyEmailCode(props.jwt, clean, code);
    setBusy(null);
    if (!result.ok) return setError(result.message ?? 'No se pudo verificar.');
    setVerified(true);
    props.onVerified?.(clean);
  };

  if (verified) {
    return (
      <View testID="perfil-correo-ok" className="min-h-[52px] flex-row items-center gap-3 rounded-lg border border-en-linea/30 bg-en-linea/10 px-4">
        <CheckCircle2 size={20} color={colors['en-linea']} />
        <Text className="min-w-0 flex-1 text-base text-on-surface" numberOfLines={1}>{normalizeEmail(email) || email}</Text>
        <Pressable testID="perfil-cambiar-correo" onPress={() => (setVerified(false), setCodeSent(false), setCode(''))} hitSlop={8}>
          <Text className="text-sm font-semibold text-primary">Cambiar</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <>
      <View className="flex-row gap-2">
        <TextInput testID="perfil-correo" className={`${FIELD} min-w-0 flex-1`} placeholder="tucorreo@ejemplo.com" placeholderTextColor={colors.outline} keyboardType="email-address" autoCapitalize="none" autoComplete="email" value={email} onChangeText={(text) => (setEmail(text), setCodeSent(false))} />
        <Pressable testID="perfil-enviar-codigo" disabled={busy !== null} onPress={() => void sendCode()} className="h-[52px] justify-center rounded-lg border border-primary/40 px-4">
          {busy === 'code' ? <ActivityIndicator color={colors.primary} /> : <Text className="text-[14px] font-semibold text-primary">{codeSent ? 'Reenviar' : 'Enviar código'}</Text>}
        </Pressable>
      </View>
      {codeSent ? (
        <View className="mt-2 flex-row gap-2">
          <TextInput testID="perfil-codigo" className={`${FIELD} min-w-0 flex-1 text-center tracking-widest`} placeholder="Código de 6 dígitos" placeholderTextColor={colors.outline} keyboardType="number-pad" maxLength={6} value={code} onChangeText={setCode} autoComplete="one-time-code" />
          <Pressable testID="perfil-verificar" disabled={code.length < 6 || busy !== null} onPress={() => void verify()} className={`h-[52px] justify-center rounded-lg px-4 ${code.length >= 6 ? 'bg-primary' : 'bg-primary/30'}`}>
            {busy === 'verify' ? <ActivityIndicator color={colors['on-primary']} /> : <Text className="text-[14px] font-semibold text-on-primary">Verificar</Text>}
          </Pressable>
        </View>
      ) : null}
      <Text className="mt-2 text-[13px] text-on-surface-variant">{codeSent ? 'Te enviamos un código a ese correo.' : props.hint}</Text>
      {error ? <Text className="mt-2 text-sm text-error">{error}</Text> : null}
    </>
  );
}
