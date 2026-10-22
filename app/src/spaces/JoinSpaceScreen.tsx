import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { ArrowLeft, ArrowRight, Check, Lock } from 'lucide-react-native';
import { formatClock, normalizeJoinCode, spaceSubtitle, type WorkspacePreview } from '@lilachat/shared';
import { Modal } from '../ui/Modal';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';
import { SpaceLogo } from './SpaceSwitcherSheet';
import { joinSpace, leaveSpace, previewSpace } from './spacesApi';

/** A pause after the last key before asking for the preview. */
const PREVIEW_DELAY_MS = 350;

/**
 * «Unirme a un espacio» (E1; designs `e1-02-unirse-codigo` and
 * `e1-03-solicitud-enviada`): the code (or the whole link) shows the space
 * before joining; an open space lets in at once, otherwise the request waits
 * for an admin and can be withdrawn. Personal chats are never shared.
 */
export function JoinSpaceScreen(props: { visible: boolean; jwt: string; onJoined: (spaceId: string) => void; onClose: () => void; /** From a join link (pending 47): already written. */ initialCode?: string | null }) {
  const colors = useColores();
  const margins = useMargenes();
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<WorkspacePreview | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [requested, setRequested] = useState<{ space: WorkspacePreview; at: string } | null>(null);
  const code = normalizeJoinCode(text);

  // Mounted behind the screen: each opening starts clean, with the link's code when it came from one.
  useEffect(() => {
    if (!props.visible) return;
    setText(props.initialCode ?? '');
    setPreview(null);
    setError('');
    setRequested(null);
  }, [props.visible, props.initialCode]);

  useEffect(() => {
    setPreview(null);
    if (!code) return;
    let current = true;
    const timer = setTimeout(() => {
      void previewSpace(props.jwt, code).then((response) => {
        if (!current) return;
        if (response.ok) {
          setPreview(response.data);
          setError('');
        } else setError(response.status === 404 ? 'No encontramos un espacio con ese código.' : (response.message ?? 'No se pudo revisar el código.'));
      });
    }, PREVIEW_DELAY_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [code, props.jwt]);

  const join = async () => {
    if (!code || !preview || busy) return;
    setBusy(true);
    const response = await joinSpace(props.jwt, code);
    setBusy(false);
    if (!response.ok) return setError(response.message ?? 'No se pudo entrar al espacio.');
    if (response.data.status === 'active') return props.onJoined(response.data.workspaceId);
    setRequested({ space: preview, at: new Date().toISOString() });
  };
  const withdraw = async () => {
    if (!requested) return;
    const response = await leaveSpace(props.jwt, requested.space.id);
    if (!response.ok) return setError(response.message ?? 'No se pudo cancelar la solicitud.');
    props.onClose();
  };

  return (
    <Modal visible={props.visible} animationType="slide" onRequestClose={props.onClose}>
      <View testID="pantalla-unirse" className="flex-1 bg-background px-5" style={{ paddingTop: margins.cabecera, paddingBottom: margins.pie + 12 }}>
        {requested ? (
          <View className="flex-1 items-center justify-center" testID="solicitud-enviada">
            <SpaceLogo space={requested.space} size={88} />
            <Text className="mt-5 text-[12px] font-bold uppercase tracking-widest text-primary">Solicitud enviada</Text>
            <Text className="mt-1 text-center text-[24px] font-bold text-on-surface">{`Pediste unirte a ${requested.space.name}`}</Text>
            <Text className="mt-2 text-center text-[15px] leading-[22px] text-on-surface-variant">Te avisamos cuando un admin apruebe tu ingreso. Mientras tanto puedes usar tus chats personales.</Text>
            <View className="mt-3 flex-row items-center gap-2">
              <Text className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[12px] font-bold text-primary">PENDIENTE</Text>
              <Text className="text-[13px] text-on-surface-variant">{`Enviada hoy ${formatClock(requested.at)}`}</Text>
            </View>
          </View>
        ) : (
          <View className="flex-1">
            <Pressable testID="unirse-volver" onPress={props.onClose} accessibilityLabel="Volver" className="mb-4 h-11 w-11 items-center justify-center rounded-full border border-outline/15">
              <ArrowLeft size={20} color={colors['on-surface']} />
            </Pressable>
            <Text className="text-[12px] font-bold uppercase tracking-widest text-primary">Unirme a un espacio</Text>
            <Text className="mt-1 text-[26px] font-bold leading-[32px] text-on-surface">Escribe el código de tu empresa</Text>
            <Text className="mt-1 text-[15px] text-on-surface-variant">Te lo manda un admin por WhatsApp o en un enlace.</Text>
            <Text className="mb-2 mt-6 text-[12px] font-bold uppercase tracking-widest text-primary">Código de ingreso</Text>
            <View className={`min-h-[60px] flex-row items-center rounded-2xl border bg-surface px-4 ${preview ? 'border-primary' : 'border-outline/25'}`}>
              <TextInput testID="input-codigo-espacio" value={text} onChangeText={setText} autoCapitalize="characters" autoCorrect={false} placeholder="CONS-7K3P o el enlace" placeholderTextColor={colors['on-surface-variant']} className="flex-1 font-mono text-[20px] tracking-widest text-on-surface" />
              {preview ? (
                <View className="flex-row items-center gap-1 rounded-lg border border-en-linea/40 bg-en-linea/10 px-2 py-1">
                  <Check size={14} color={colors['en-linea']} />
                  <Text className="text-[12px] font-bold text-en-linea">VÁLIDO</Text>
                </View>
              ) : code && !error ? <ActivityIndicator color={colors.primary} /> : null}
            </View>
            {error ? <Text testID="error-codigo" className="mt-2 text-[13px] text-error">{error}</Text> : null}
            {preview ? (
              <View testID="vista-previa-espacio" className="mt-4 overflow-hidden rounded-2xl border border-outline/15 bg-surface">
                <View className="h-[3px] bg-primary" />
                <View className="p-4">
                  <Text className="text-[11px] font-bold uppercase tracking-widest text-primary">Vista previa del espacio</Text>
                  <View className="mt-3 flex-row items-center gap-3">
                    <SpaceLogo space={preview} size={52} />
                    <View className="min-w-0 flex-1">
                      <Text numberOfLines={1} className="text-[18px] font-bold text-on-surface">{preview.name}</Text>
                      <Text className="text-[14px] text-on-surface-variant">{spaceSubtitle(preview)}</Text>
                    </View>
                  </View>
                  <Text className={`mt-3 self-start rounded-md border px-2 py-1 text-[12px] font-bold ${preview.joinPolicy === 'approval' ? 'border-primary/30 bg-primary/10 text-primary' : 'border-en-linea/40 bg-en-linea/10 text-en-linea'}`}>
                    {preview.joinPolicy === 'approval' ? 'UN ADMIN APRUEBA TU INGRESO' : 'ENTRAS DE INMEDIATO'}
                  </Text>
                </View>
              </View>
            ) : null}
            <View className="mt-4 flex-row items-center justify-center gap-2">
              <Lock size={14} color={colors.primary} />
              <Text className="text-[13px] text-on-surface-variant">Tus chats personales no se comparten con la empresa</Text>
            </View>
          </View>
        )}
        {requested ? (
          <View className="gap-3">
            <Pressable testID="solicitud-ir-a-chats" onPress={props.onClose} className="min-h-[52px] flex-row items-center justify-center gap-2 rounded-2xl border border-outline/20 bg-surface">
              <Text className="text-[16px] font-bold text-on-surface">Ir a mis chats</Text>
              <ArrowRight size={18} color={colors['on-surface']} />
            </Pressable>
            <Pressable testID="solicitud-cancelar" onPress={() => void withdraw()} className="min-h-[44px] items-center justify-center">
              <Text className="text-[15px] font-semibold text-error">Cancelar solicitud</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable testID="btn-unirse" disabled={!preview || busy} onPress={() => void join()} className={`min-h-[56px] flex-row items-center justify-center gap-2 rounded-2xl bg-primary ${!preview || busy ? 'opacity-50' : ''}`}>
            <Text className="text-[17px] font-bold text-on-primary">{preview?.joinPolicy === 'open' ? 'Entrar' : 'Pedir acceso'}</Text>
            <ArrowRight size={18} color={colors['on-primary']} />
          </Pressable>
        )}
      </View>
    </Modal>
  );
}
