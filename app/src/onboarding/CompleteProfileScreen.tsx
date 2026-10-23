import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { birthdayFieldError, birthdayFromFields, canFinishProfile, type MyProfile } from '@lilachat/shared';
import { getProfile, saveProfile } from '../api/profileApi';
import type { Credential } from '../auth/credentialStore';
import { aplicarPerfil } from '../settings/perfilPropio';
import { Logo } from '../ui/Logo';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';
import { EmailVerifyField } from './EmailVerifyField';

const FIELD = 'h-[52px] rounded-lg border border-outline/20 bg-surface-variant/40 px-4 text-base text-on-surface';
const Label = ({ children }: { children: string }) => <Text className="mb-2 mt-6 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">{children}</Text>;
const pad = (value?: number) => (value ? String(value) : '');

/**
 * «Completa tu perfil» (José, 21/10; backlog 17): name and birthday are
 * required to use Lilachat. A new account lands here after the code; an older
 * one that lacks something, the next time it opens. It cannot be skipped. The
 * email is optional (22/10, backlog 51): the phone already proved who it is,
 * and only the backup asks for it.
 */
export function CompleteProfileScreen(props: { credential: Credential; profile: MyProfile; onDone: (profile: MyProfile) => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const { credential, profile } = props;
  const [name, setName] = useState(profile.name ?? credential.name ?? '');
  const [day, setDay] = useState(pad(profile.birthday?.day));
  const [month, setMonth] = useState(pad(profile.birthday?.month));
  const [year, setYear] = useState(pad(profile.birthday?.year));
  const [busy, setBusy] = useState<'save' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const birthday = birthdayFromFields({ day, month, year });
  const ready = canFinishProfile({ name, birthdayOk: birthday.ok });
  const birthdayHint = birthdayFieldError({ day, month, year });

  const finish = async () => {
    // «Continuar» is off until the birthday is valid; its error shows under the boxes.
    if (!birthday.ok) return;
    setBusy('save');
    setError(null);
    const saved = await saveProfile(credential.jwt, { name: name.trim(), birthday: birthday.birthday });
    const fresh = saved.ok ? saved.data.profile : null;
    if (!fresh) {
      setBusy(null);
      return setError(saved.ok ? 'No se pudo guardar.' : (saved.message ?? 'No se pudo guardar.'));
    }
    await aplicarPerfil(credential, { name: fresh.name, phone: fresh.phone, avatarUrl: fresh.avatarUrl });
    // What the server says is missing decides: another device could have completed it meanwhile.
    const latest = fresh.missing.length ? await getProfile(credential.jwt) : saved;
    setBusy(null);
    if (latest.ok && latest.data.profile.missing.length === 0) props.onDone(latest.data.profile);
    else setError('Falta completar algo: revisa tu nombre y tu cumpleaños.');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-background" testID="pantalla-completa-perfil">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: margins.cabecera + 24, paddingBottom: margins.pie + 24, paddingHorizontal: 24 }}>
        <View className="items-center">
          <Logo tamano={56} />
          <Text className="mt-4 text-2xl font-bold text-on-surface">Completa tu perfil</Text>
          <Text className="mt-2 text-center text-[15px] leading-6 text-on-surface-variant">Para usar Lilachat necesitamos tu nombre y tu cumpleaños.</Text>
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

        <Label>Tu correo (opcional)</Label>
        <EmailVerifyField jwt={credential.jwt} email={profile.email} verified={profile.emailVerified} hint="Lo necesitas solo para activar la copia de seguridad." />

        {error ? <Text className="mt-6 text-center text-sm text-error">{error}</Text> : null}
        <Pressable testID="perfil-continuar" disabled={!ready || busy !== null} onPress={() => void finish()} className={`mt-8 min-h-[52px] items-center justify-center rounded-lg ${ready ? 'bg-primary' : 'bg-primary/30'}`}>
          {busy === 'save' ? <ActivityIndicator color={colors['on-primary']} /> : <Text className={`text-base font-bold ${ready ? 'text-on-primary' : 'text-on-surface-variant'}`}>Continuar</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
