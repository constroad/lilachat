import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { X } from 'lucide-react-native';
import { birthdayDraftOf, birthdayFromFields, canFinishProfile, type MyProfile } from '@lilachat/shared';
import { getProfile, saveProfile } from '../api/profileApi';
import type { Credential } from '../auth/credentialStore';
import { aplicarPerfil } from '../settings/perfilPropio';
import { Logo } from '../ui/Logo';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';
import { BirthdayFields } from './BirthdayFields';
import { EmailVerifyField } from './EmailVerifyField';

const FIELD = 'h-[52px] rounded-lg border border-outline/20 bg-surface-variant/40 px-4 text-base text-on-surface';
const Label = ({ children }: { children: string }) => <Text className="mb-2 mt-6 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">{children}</Text>;

/**
 * «Completa tu perfil» (José, 21/10; backlog 17): name and birthday are
 * required to use Lilachat. A new account lands here after the code; an older
 * one that lacks something, the next time it opens. It cannot be skipped. The
 * email is optional (22/10, backlog 51): the phone already proved who it is,
 * and only the backup asks for it. Opened from the birthday reminder (José,
 * 14/11) it gets `onCancel`: a way out, since nothing blocks.
 */
export function CompleteProfileScreen(props: { credential: Credential; profile: MyProfile; onDone: (profile: MyProfile) => void; onCancel?: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const { credential, profile } = props;
  const [name, setName] = useState(profile.name ?? credential.name ?? '');
  const [draft, setDraft] = useState(() => birthdayDraftOf(profile.birthday));
  const [busy, setBusy] = useState<'save' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const birthday = birthdayFromFields(draft);
  const ready = canFinishProfile({ name, birthdayOk: birthday.ok });

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
        {props.onCancel ? (
          <Pressable testID="perfil-cerrar" accessibilityRole="button" accessibilityLabel="Cerrar" onPress={props.onCancel} hitSlop={8} className="h-11 w-11 items-center justify-center self-end">
            <X size={20} color={colors['on-surface-variant']} />
          </Pressable>
        ) : null}
        <View className="items-center">
          <Logo tamano={56} />
          <Text className="mt-4 text-2xl font-bold text-on-surface">Completa tu perfil</Text>
          <Text className="mt-2 text-center text-[15px] leading-6 text-on-surface-variant">Para usar Lilachat necesitamos tu nombre y tu cumpleaños.</Text>
        </View>

        <Label>Tu nombre</Label>
        <TextInput testID="perfil-nombre" className={FIELD} placeholder="Nombre y apellido" placeholderTextColor={colors.outline} value={name} onChangeText={setName} autoComplete="name" maxLength={60} />

        <Label>Tu cumpleaños</Label>
        <BirthdayFields value={draft} onChange={setDraft} fieldClass={FIELD} />

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
