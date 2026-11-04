import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Smartphone } from 'lucide-react-native';
import { requestEmailSignIn } from '../api/client';
import { Logo } from '../ui/Logo';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';
import { normalizeEmailInput } from './machine';

/**
 * «Entra a tu espacio de trabajo» (design `i-01-entrar`): the first screen, like
 * Slack's. The email and its code first; the phone stays one tap away, and a
 * discreet link keeps the personal use. It always moves on with the generic
 * answer: this screen cannot know who has an account.
 */
export function WorkspaceEntryScreen(props: { onCodeRequested: (email: string) => void; onUsePhone: () => void; onUsePersonal: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const [rawEmail, setRawEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const email = normalizeEmailInput(rawEmail);
  const ready = Boolean(email) && !sending;

  const submit = async () => {
    if (!ready) return;
    setSending(true);
    setError('');
    const result = await requestEmailSignIn(email);
    setSending(false);
    if (!result.ok) return setError(result.status === 'network' ? 'Sin conexión. Revisa tu internet e inténtalo de nuevo.' : 'No se pudo enviar el código. Inténtalo de nuevo.');
    props.onCodeRequested(email);
  };

  return (
    <ScrollView testID="pantalla-entrar" className="flex-1 bg-background" keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingTop: margins.cabecera + 40, paddingBottom: margins.pie + 16, paddingHorizontal: 24 }}>
      <View className="flex-row items-center justify-center gap-2">
        <Logo tamano={40} />
        <Text className="text-[22px] font-bold text-on-surface">Lilachat</Text>
      </View>
      <Text className="mt-10 text-[26px] font-bold leading-[32px] text-on-surface">Entra a tu espacio de trabajo</Text>
      <Text className="mt-2 text-[15px] leading-[22px] text-on-surface-variant">Escribe tu correo de trabajo. Te enviamos un código para entrar.</Text>

      <Text className="mb-2 mt-8 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Correo</Text>
      <TextInput
        testID="input-correo"
        className="h-[52px] rounded-lg border border-outline/20 bg-surface-variant/40 px-4 text-base text-on-surface"
        placeholder="nombre@empresa.com"
        placeholderTextColor={colors.outline}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        returnKeyType="go"
        value={rawEmail}
        onChangeText={(text) => {
          setRawEmail(text);
          setError('');
        }}
        onSubmitEditing={() => void submit()}
      />
      {error ? <Text testID="error-correo" className="mt-3 text-sm text-error">{error}</Text> : null}

      <Pressable testID="btn-continuar-correo" accessibilityRole="button" disabled={!ready} onPress={() => void submit()} className={`mt-4 min-h-[52px] items-center justify-center rounded-lg ${ready ? 'bg-primary' : 'bg-primary/30'}`}>
        {sending ? <ActivityIndicator color={colors['on-primary']} /> : <Text className={`text-base font-bold ${ready ? 'text-on-primary' : 'text-on-surface-variant'}`}>Continuar</Text>}
      </Pressable>

      <View className="my-5 flex-row items-center gap-3">
        <View className="h-px flex-1 bg-outline/20" />
        <Text className="text-[13px] text-on-surface-variant">o</Text>
        <View className="h-px flex-1 bg-outline/20" />
      </View>

      <Pressable testID="btn-entrar-telefono" accessibilityRole="button" onPress={props.onUsePhone} className="min-h-[52px] flex-row items-center justify-center gap-2 rounded-lg border border-outline/30">
        <Smartphone size={18} color={colors['on-surface']} />
        <Text className="text-[15px] font-semibold text-on-surface">Entrar con mi número de teléfono</Text>
      </Pressable>

      <View className="min-h-8 flex-1" />
      <Pressable testID="btn-sin-espacio" accessibilityRole="button" onPress={props.onUsePersonal} className="min-h-[44px] items-center justify-center">
        <Text className="text-sm text-on-surface-variant">Usar sin espacio de trabajo</Text>
      </Pressable>
    </ScrollView>
  );
}
