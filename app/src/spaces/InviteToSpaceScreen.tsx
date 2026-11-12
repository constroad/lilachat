import { useState } from 'react';
import { Linking, Pressable, ScrollView, Share, Text, TextInput, ToastAndroid, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { ArrowLeft, Copy, Mail, Share2 } from 'lucide-react-native';
import { EMAIL_INVITE_HINT, emailInviteBadge, spaceInviteMessage, type ClientWorkspace, type SpaceEmailInvite } from '@lilachat/shared';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';
import { SpaceLogo } from './SpaceSwitcherSheet';
import { addToSpace, inviteToSpaceByEmail } from './spacesApi';

/** A Peruvian mobile, as the server keeps it: nine digits. */
const PHONE_DIGITS = 9;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BADGE_TONE: Record<ReturnType<typeof emailInviteBadge>['tone'], string> = {
  ok: 'border-en-linea/40 bg-en-linea/10 text-en-linea',
  info: 'border-primary/30 bg-primary/10 text-primary',
  warn: 'border-warning/30 bg-warning/10 text-warning',
};

/** An invited email: whether Lilachat's email went, and «Reenviar» when it did not (José 12/11). */
function EmailInviteRow(props: { invite: SpaceEmailInvite; sending: boolean; onResend: () => void }) {
  const colors = useColores();
  const { invite } = props;
  const badge = emailInviteBadge(invite);
  const unsent = invite.status === 'invited' && !invite.emailSent;
  return (
    <View testID={`invitado-correo-${invite.email}`} className="mt-3 border-t border-outline/10 pt-2">
      <View className="min-h-[48px] flex-row items-center gap-3">
        <Mail size={18} color={colors['on-surface-variant']} />
        <Text className="min-w-0 flex-1 text-[15px] text-on-surface">{invite.email}</Text>
        <Text className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${BADGE_TONE[badge.tone]}`}>{badge.label}</Text>
      </View>
      {unsent ? (
        <View className="flex-row items-center gap-2 pb-1">
          <Text className="min-w-0 flex-1 text-[13px] text-error">{invite.emailError ?? 'El correo no salió.'}</Text>
          <Pressable testID={`reenviar-correo-${invite.email}`} disabled={props.sending} onPress={props.onResend} className={`min-h-[44px] justify-center rounded-lg border border-primary/30 px-3 ${props.sending ? 'opacity-60' : ''}`}>
            <Text className="text-[14px] font-semibold text-primary">{props.sending ? 'Enviando…' : 'Reenviar'}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

type CardProps = { space: ClientWorkspace; jwt: string };

/** «Invitar por correo»: Lilachat sends the email (José 12/11), and a failed one is resent from its row. */
function EmailInviteCard({ space, jwt }: CardProps) {
  const colors = useColores();
  const [email, setEmail] = useState('');
  const [emailed, setEmailed] = useState<SpaceEmailInvite[]>([]);
  const [emailError, setEmailError] = useState('');
  const [sending, setSending] = useState<string | null>(null);
  const typed = email.trim().toLowerCase();
  const sendInvite = async (wanted: string) => {
    setSending(wanted);
    const response = await inviteToSpaceByEmail(jwt, space.id, wanted);
    setSending(null);
    if (!response.ok) return setEmailError(response.message ?? 'No se pudo invitar.');
    setEmailed((before) => [response.data, ...before.filter((one) => one.email !== response.data.email)]);
    setEmailError('');
    if (wanted === typed) setEmail('');
  };
  const inviteByEmail = () => (EMAIL_PATTERN.test(typed) ? void sendInvite(typed) : setEmailError('Escribe un correo válido.'));
  return (
    <View testID="tarjeta-invitar-correo" className="mt-5 overflow-hidden rounded-2xl border border-outline/15 bg-surface">
      <View className="h-[3px] bg-primary" />
      <View className="p-4">
        <Text className="text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">Invitar por correo</Text>
        <Text className="mt-1 text-[14px] text-on-surface-variant">{EMAIL_INVITE_HINT}</Text>
        <View className="mt-3 flex-row gap-3">
          <TextInput testID="input-correo-espacio" value={email} onChangeText={(value) => { setEmail(value); setEmailError(''); }} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} placeholder="nombre@empresa.pe" placeholderTextColor={colors['on-surface-variant']} className="min-h-[52px] flex-1 rounded-xl border border-outline/25 px-3 text-[16px] text-on-surface" />
          <Pressable testID="btn-invitar-correo" disabled={sending !== null} onPress={inviteByEmail} className={`min-h-[52px] flex-row items-center justify-center gap-2 rounded-xl bg-primary px-4 ${sending !== null ? 'opacity-60' : ''}`}>
            <Mail size={18} color={colors['on-primary']} />
            <Text className="text-[16px] font-bold text-on-primary">{sending !== null && sending === typed ? 'Enviando…' : 'Invitar'}</Text>
          </Pressable>
        </View>
        {emailError ? <Text testID="error-invitar-correo" className="mt-2 text-[13px] text-error">{emailError}</Text> : null}
        {emailed.map((one) => <EmailInviteRow key={one.email} invite={one} sending={sending === one.email} onResend={() => void sendInvite(one.email)} />)}
      </View>
    </View>
  );
}

/** «Agregar por número»: in at once if they already use Lilachat; otherwise when they enter with that number. */
function PhoneAddCard({ space, jwt }: CardProps) {
  const colors = useColores();
  const [phone, setPhone] = useState('');
  const [added, setAdded] = useState<{ phone: string; status: string }[]>([]);
  const [error, setError] = useState('');
  const digits = phone.replace(/\D/g, '');
  const add = async () => {
    if (digits.length !== PHONE_DIGITS) return setError('Escribe los 9 dígitos del celular.');
    const response = await addToSpace(jwt, space.id, digits);
    if (!response.ok) return setError(response.message ?? 'No se pudo agregar.');
    setAdded((before) => [{ phone: digits, status: response.data.member.status }, ...before.filter((one) => one.phone !== digits)]);
    setPhone('');
    setError('');
  };
  return (
    <View className="mt-4 rounded-2xl border border-outline/15 bg-surface p-4">
      <Text className="text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">Agregar por número</Text>
      <Text className="mt-1 text-[14px] text-on-surface-variant">Entra al toque si ya usa Lilachat; si no, cuando entre con ese número.</Text>
      <View className="mt-3 flex-row gap-3">
        <View className="min-h-[52px] flex-1 flex-row items-center rounded-xl border border-outline/25 px-3">
          <Text className="mr-2 border-r border-outline/20 pr-2 text-[15px] text-on-surface-variant">+51</Text>
          <TextInput testID="input-telefono-espacio" value={phone} onChangeText={(value) => { setPhone(value); setError(''); }} keyboardType="phone-pad" maxLength={11} placeholder="987 111 222" placeholderTextColor={colors['on-surface-variant']} className="flex-1 text-[17px] font-semibold text-on-surface" />
        </View>
        <Pressable testID="btn-agregar-telefono" onPress={() => void add()} className="min-h-[52px] items-center justify-center rounded-xl bg-primary px-5">
          <Text className="text-[16px] font-bold text-on-primary">Agregar</Text>
        </Pressable>
      </View>
      {error ? <Text testID="error-agregar-telefono" className="mt-2 text-[13px] text-error">{error}</Text> : null}
      {added.length ? <Text className="mb-1 mt-4 text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">Agregados recientes</Text> : null}
      {added.map((one) => (
        <View key={one.phone} className="min-h-[56px] flex-row items-center gap-3 border-t border-outline/10">
          <Avatar nombre={one.phone} tamano={40} />
          <Text className="flex-1 text-[15px] text-on-surface">{one.phone.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')}</Text>
          <Text className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${one.status === 'active' ? 'border-en-linea/40 bg-en-linea/10 text-en-linea' : 'border-primary/30 bg-primary/10 text-primary'}`}>{one.status === 'active' ? 'AGREGADO' : 'INVITADO'}</Text>
        </View>
      ))}
    </View>
  );
}

/** «Código del espacio»: by WhatsApp (with where to get the app) or copied. */
function JoinCodeCard({ space, code }: { space: ClientWorkspace; code: string }) {
  const colors = useColores();
  const message = spaceInviteMessage({ spaceName: space.name, code });
  const copy = async () => {
    await Clipboard.setStringAsync(code);
    ToastAndroid.show('Código copiado', ToastAndroid.SHORT);
  };
  const sendByWhatsApp = async () => {
    const opened = await Linking.openURL(`whatsapp://send?text=${encodeURIComponent(message)}`).then(() => true, () => false);
    if (!opened) await Share.share({ message, title: `Invitar a ${space.name}` });
  };
  return (
    <View testID="tarjeta-codigo-espacio" className="mt-4 overflow-hidden rounded-2xl border border-outline/15 bg-surface">
      <View className="p-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">Código del espacio</Text>
          <Text className="rounded-full border border-en-linea/40 bg-en-linea/10 px-2 py-0.5 text-[11px] font-bold text-en-linea">ACTIVO</Text>
        </View>
        <Text testID="codigo-espacio" selectable className="my-4 text-center font-mono text-[34px] font-bold tracking-[6px] text-on-surface">{code}</Text>
        <View className="flex-row gap-3">
          <Pressable testID="btn-whatsapp-codigo" onPress={() => void sendByWhatsApp()} className="min-h-[48px] flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-outline/20">
            <Share2 size={18} color={colors['en-linea']} />
            <Text className="text-[15px] font-semibold text-on-surface">WhatsApp</Text>
          </Pressable>
          <Pressable testID="btn-copiar-codigo" onPress={() => void copy()} className="min-h-[48px] flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-outline/20">
            <Copy size={18} color={colors.primary} />
            <Text className="text-[15px] font-semibold text-on-surface">Copiar</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/**
 * «Invitar personas» (E1; design `e1-05-invitar`). A company invites by email
 * first (José, 21/10 and 22/10): the server keeps the invitation and the
 * person joins on their own when they verify that email in their profile (one
 * account per person, the phone); Lilachat sends the email (constroad-auth,
 * José 12/11). Then the code by WhatsApp or copied, and adding someone by number. Only
 * those who can invite see these.
 */
export function InviteToSpaceScreen(props: { space: ClientWorkspace | null; jwt: string; onClose: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const { space } = props;
  if (!space) return null;
  return (
    <Modal visible animationType="slide" onRequestClose={props.onClose}>
      <View testID="pantalla-invitar-espacio" className="flex-1 bg-background" style={{ paddingTop: margins.cabecera }}>
        <View className="flex-row items-center gap-2 px-3 pb-2">
          <Pressable testID="invitar-volver" onPress={props.onClose} accessibilityLabel="Volver" className="h-11 w-11 items-center justify-center">
            <ArrowLeft size={22} color={colors.primary} />
          </Pressable>
          <SpaceLogo space={space} size={30} />
          <Text numberOfLines={1} className="flex-1 text-[20px] font-bold text-on-surface">{`Invitar a ${space.name}`}</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: margins.pie + 24 }} keyboardShouldPersistTaps="handled">
          <Text className="text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">{space.name}</Text>
          <Text className="mt-1 text-[26px] font-bold text-on-surface">Invitar personas</Text>
          <Text className="mt-1 text-[15px] text-on-surface-variant">Invita por correo, envía el código por WhatsApp o agrega a tu equipo por su número.</Text>
          {/* Keyed by the space: another space starts with empty fields, as before. */}
          {space.joinCode ? (
            <>
              <EmailInviteCard key={`correo-${space.id}`} space={space} jwt={props.jwt} />
              <JoinCodeCard space={space} code={space.joinCode} />
              <PhoneAddCard key={`numero-${space.id}`} space={space} jwt={props.jwt} />
            </>
          ) : (
            <Text className="mt-5 rounded-2xl bg-surface-variant p-4 text-[14px] text-on-surface-variant">El código lo tienen los admins del espacio: pídeselo a uno de ellos.</Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
