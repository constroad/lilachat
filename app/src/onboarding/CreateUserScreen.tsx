import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { Camera, Mail, Plus } from 'lucide-react-native';
import type { MyProfile } from '@lilachat/shared';
import { saveProfile } from '../api/profileApi';
import type { Credential } from '../auth/credentialStore';
import { elegirFotoRedonda } from '../chat/fotoDeGrupo';
import { aplicarPerfil, subirFotoDePerfil } from '../settings/perfilPropio';
import { SpaceLogo } from '../spaces/SpaceSwitcherSheet';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';

const AVATAR_SIZE = 112;

/**
 * «Crea tu usuario» (design `i-04-crea-tu-usuario`): an account born from an
 * email writes its name once, and the photo is optional. There is no password:
 * the code is the way in. Without a space chosen yet, it speaks of Lilachat.
 */
export function CreateUserScreen(props: { credential: Credential; email: string | null; space?: { name: string; logoUrl?: string }; onDone: (profile: MyProfile) => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const { credential, space } = props;
  const [name, setName] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<'photo' | 'save' | null>(null);
  const [error, setError] = useState('');
  const ready = Boolean(name.trim()) && busy === null;

  const addPhoto = async () => {
    const choice = await elegirFotoRedonda({ titulo: 'Tu foto', mensaje: 'Así te verán en Lilachat.', nombrePorDefecto: 'perfil.jpg' });
    if (choice.tipo !== 'foto') return;
    setBusy('photo');
    setError('');
    const uploaded = await subirFotoDePerfil(credential.jwt, choice.foto);
    setBusy(null);
    if (!uploaded.ok) return setError(uploaded.motivo);
    setPhotoUrl(uploaded.perfil.avatarUrl);
  };

  const finish = async () => {
    if (!ready) return;
    setBusy('save');
    setError('');
    const saved = await saveProfile(credential.jwt, { name: name.trim() });
    setBusy(null);
    if (!saved.ok) return setError(saved.message ?? 'No se pudo guardar. Inténtalo de nuevo.');
    const profile = saved.data.profile;
    await aplicarPerfil(credential, { name: profile.name, phone: profile.phone, avatarUrl: profile.avatarUrl });
    props.onDone(profile);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-background" testID="pantalla-crea-tu-usuario">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingTop: margins.cabecera + 16, paddingBottom: margins.pie + 16, paddingHorizontal: 24 }}>
        {space ? (
          <View className="flex-row items-center gap-2 self-start rounded-lg border border-outline/20 bg-surface-variant/40 py-1.5 pl-2 pr-3">
            <SpaceLogo space={space} size={28} />
            <Text className="text-[13px] font-semibold tracking-wide text-on-surface">{space.name}</Text>
          </View>
        ) : null}
        <Text className="mt-6 text-3xl font-bold text-on-surface">Crea tu usuario</Text>
        <Text className="mt-1 text-base leading-6 text-on-surface-variant">Así te verán en {space?.name ?? 'Lilachat'}.</Text>

        <Pressable testID="btn-agregar-foto" accessibilityRole="button" accessibilityLabel="Agregar foto" disabled={busy !== null} onPress={() => void addPhoto()} className="mt-8 items-center">
          <View style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}>
            <View className="h-full w-full items-center justify-center overflow-hidden rounded-full border border-dashed border-outline/40 bg-surface-variant/40">
              {photoUrl ? <Image source={{ uri: photoUrl }} style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }} contentFit="cover" /> : busy === 'photo' ? <ActivityIndicator color={colors.primary} /> : <Camera size={32} color={colors.outline} />}
            </View>
            <View className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full bg-primary">
              <Plus size={18} color={colors['on-primary']} />
            </View>
          </View>
          <Text className="mt-3 text-[15px] font-semibold text-primary">Agregar foto</Text>
          <Text className="text-[13px] text-on-surface-variant">Opcional</Text>
        </Pressable>

        <Text className="mb-2 mt-7 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Nombre completo</Text>
        <TextInput testID="input-nombre-completo" className="h-[52px] rounded-lg border border-outline/20 bg-surface-variant/40 px-4 text-base text-on-surface" placeholder="Nombre y apellido" placeholderTextColor={colors.outline} autoCapitalize="words" autoComplete="name" value={name} onChangeText={setName} />
        {props.email ? (
          <View className="mt-3 flex-row items-center gap-2">
            <Mail size={16} color={colors['on-surface-variant']} />
            <Text className="min-w-0 flex-1 text-[13px] text-on-surface-variant" numberOfLines={1}>Entras con <Text className="font-medium text-on-surface">{props.email}</Text></Text>
          </View>
        ) : null}
        {error ? <Text testID="error-crea-usuario" className="mt-3 text-sm text-error">{error}</Text> : null}

        <View className="min-h-8 flex-1" />
        <Pressable testID="btn-entrar-espacio" accessibilityRole="button" disabled={!ready} onPress={() => void finish()} className={`min-h-[52px] items-center justify-center rounded-lg ${ready ? 'bg-primary' : 'bg-primary/30'}`}>
          {busy === 'save' ? <ActivityIndicator color={colors['on-primary']} /> : <Text className={`text-base font-bold ${ready ? 'text-on-primary' : 'text-on-surface-variant'}`}>{space ? `Entrar a ${space.name}` : 'Entrar'}</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
