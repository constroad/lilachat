import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';
import { birthdayFieldError, birthdayFromFields, canFinishProfile, normalizeEmail, type MyProfile } from '@lilachat/shared';
import { getProfile, requestEmailCode, saveProfile, verifyEmailCode } from '../api/profileApi';
import type { Credential } from '../auth/credentialStore';
import { aplicarPerfil } from '../settings/perfilPropio';
import { Interruptor } from '../ui/Interruptor';
import { Logo } from '../ui/Logo';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';

const FIELD = 'h-[52px] rounded-lg border border-outline/20 bg-surface-variant/40 px-4 text-base text-on-surface';
const Label = ({ children }: { children: string }) => <Text className="mb-2 mt-6 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">{children}</Text>;
const pad = (value?: number) => (value ? String(value) : '');

/**
 * «Completa tu perfil» (José, 21/10; backlog 17): name, birthday and a verified
 * email are required to use Lilachat. A new account lands here after the code;
 * an older one that lacks something, the next time it opens. It cannot be
 * skipped. The email is proved like the phone: a code to that address.
 */
export function CompleteProfileScreen(props: { credential: Credential; profile: MyProfile; onDone: (profile: MyProfile) => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const { credential, profile } = props;
  const [name, setName] = useState(profile.name ?? credential.name ?? '');
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
  const ready = canFinishProfile({ name, birthdayOk: birthday.ok, emailVerified });
  const birthdayHint = birthdayFieldError({ day, month, year });

  const sendCode = async () => {
    const clean = normalizeEmail(email);
    if (!clean) return setError({ field: 'email', text: 'Ese correo no parece válido.' });
    setBusy('code');
    setError(null);
    const sent = await requestEmailCode(credential.jwt, clean);
    setBusy(null);
    if (sent.ok) setCodeSent(true);
    else setError({ field: 'email', text: sent.message ?? 'No se pudo enviar el código.' });
  };
  const verify = async () => {
    setBusy('verify');
    setError(null);
    const result = await verifyEmailCode(credential.jwt, normalizeEmail(email), code);
    setBusy(null);
    if (result.ok) setEmailVerified(true);
    else setError({ field: 'email', text: result.message ?? 'No se pudo verificar.' });
  };
  const finish = async () => {
    // «Continuar» is off until the birthday is valid; its error shows under the boxes.
    if (!birthday.ok) return;
    setBusy('save');
    setError(null);
    const saved = await saveProfile(credential.jwt, { name: name.trim(), birthday: birthday.birthday, birthdayVisible: visible });
    const fresh = saved.ok ? saved.data.profile : null;
    if (!fresh) {
      setBusy(null);
      return setError({ field: 'save', text: saved.ok ? 'No se pudo guardar.' : (saved.message ?? 'No se pudo guardar.') });
    }
    await aplicarPerfil(credential, { name: fresh.name, phone: fresh.phone, avatarUrl: fresh.avatarUrl });
    // What the server says is missing decides: the email of another device could have been proved meanwhile.
    const latest = fresh.missing.length ? await getProfile(credential.jwt) : saved;
    setBusy(null);
    if (latest.ok && latest.data.profile.missing.length === 0) props.onDone(latest.data.profile);
    else setError({ field: 'save', text: 'Falta completar algo: revisa el correo.' });
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-background" testID="pantalla-completa-perfil">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: margins.cabecera + 24, paddingBottom: margins.pie + 24, paddingHorizontal: 24 }}>
        <View className="items-center">
          <Logo tamano={56} />
          <Text className="mt-4 text-2xl font-bold text-on-surface">Completa tu perfil</Text>
          <Text className="mt-2 text-center text-[15px] leading-6 text-on-surface-variant">Para usar Lilachat necesitamos tu nombre, tu cumpleaños y tu correo.</Text>
        </View>

        <Label>Tu nombre</Label>
        <TextInput testID="perfil-nombre" className={FIELD} placeholder="Nombre y apellido" placeholderTextColor={colors.outline} value={name} onChangeText={setName} autoComplete="name" maxLength={60} />

        <Label>Tu cumpleaños</Label>
        <View className="flex-row gap-2">
          <TextInput testID="perfil-dia" className={`${FIELD} w-20 text-center`} placeholder="Día" placeholderTextColor={colors.outline} keyboardType="number-pad" maxLength={2} value={day} onChangeText={setDay} />
          <TextInput testID="perfil-mes" className={`${FIELD} w-20 text-center`} placeholder="Mes" placeholderTextColor={colors.outline} keyboardType="number-pad" maxLength={2} value={month} onChangeText={setMonth} />
          <TextInput testID="perfil-anio" className={`${FIELD} min-w-0 flex-1 text-center`} placeholder="Año (opcional)" placeholderTextColor={colors.outline} keyboardType="number-pad" maxLength={4} value={year} onChangeText={setYear} />
        </View>
        {birthdayHint ? <Text testID="perfil-error-cumple" className="mt-2 text-sm text-error">{birthdayHint}</Text> : null}
        <View className="mt-3 flex-row items-center gap-3">
          <Text className="min-w-0 flex-1 text-[14px] text-on-surface">Que mis chats vean mi cumpleaños</Text>
          <Interruptor testID="perfil-visible" value={visible} onValueChange={setVisible} />
        </View>

        <Label>Tu correo</Label>
        {emailVerified ? (
          <View testID="perfil-correo-ok" className="min-h-[52px] flex-row items-center gap-3 rounded-lg border border-en-linea/30 bg-en-linea/10 px-4">
            <CheckCircle2 size={20} color={colors['en-linea']} />
            <Text className="min-w-0 flex-1 text-base text-on-surface" numberOfLines={1}>{normalizeEmail(email) || email}</Text>
            <Pressable testID="perfil-cambiar-correo" onPress={() => (setEmailVerified(false), setCodeSent(false), setCode(''))} hitSlop={8}>
              <Text className="text-sm font-semibold text-primary">Cambiar</Text>
            </Pressable>
          </View>
        ) : (
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
            <Text className="mt-2 text-[13px] text-on-surface-variant">{codeSent ? 'Te enviamos un código a ese correo.' : 'Te enviaremos un código para verificarlo.'}</Text>
          </>
        )}
        {error?.field === 'email' ? <Text className="mt-2 text-sm text-error">{error.text}</Text> : null}

        {error?.field === 'save' ? <Text className="mt-6 text-center text-sm text-error">{error.text}</Text> : null}
        <Pressable testID="perfil-continuar" disabled={!ready || busy !== null} onPress={() => void finish()} className={`mt-8 min-h-[52px] items-center justify-center rounded-lg ${ready ? 'bg-primary' : 'bg-primary/30'}`}>
          {busy === 'save' ? <ActivityIndicator color={colors['on-primary']} /> : <Text className={`text-base font-bold ${ready ? 'text-on-primary' : 'text-on-surface-variant'}`}>Continuar</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
