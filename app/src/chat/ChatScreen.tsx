import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  ArrowLeft,
  Lock,
  MoreVertical,
  Mic,
  Phone,
  Plus,
  Send,
  Smile,
  Video,
} from 'lucide-react-native';
import { formatDayLabel, startsNewDay } from '@lilachat/shared';
import type { Credential } from '../auth/credentialStore';
import { AttachSheet } from './AttachSheet';
import { CallScreen } from '../calls/CallScreen';
import { useCall } from '../calls/useCall';
import { CreateEventScreen } from '../agenda/CreateEventScreen';
import { CreatePollScreen } from '../agenda/CreatePollScreen';
import { CatchUpBanner } from './CatchUpBanner';
import { SecretChatBanner } from '../crypto/SecretChatBanner';
import { useSecretChat } from '../crypto/useSecretChat';
import { DaySeparator, MessageRow, isPending, type Row } from './MessageRow';
import { useChat } from './useChat';
import { useMargenes } from '../ui/useMargenes';

/**
 * La conversación (diseño Stitch «Chat de Grupo»). Burbuja propia a la derecha
 * en acento; la ajena a la izquierda en superficie — y la esquina-cola de 4px
 * apunta al emisor, que es el token `rounded-tail` de Vivid Pulse.
 */
export function ChatScreen({
  chatId,
  chatName,
  credential,
  othersReadSeq,
  othersDeliveredSeq,
  unread,
  encrypted,
  otherUserId,
  onBack,
}: {
  chatId: string;
  chatName: string;
  credential: Credential;
  othersReadSeq: number;
  othersDeliveredSeq: number;
  /** Cuántos sin leer traía la lista: decide si la banda de Lila aparece. */
  unread: number;
  /** Chat secreto (F9): cifra, y apaga a Lila. */
  encrypted?: boolean;
  otherUserId?: string | null;
  onBack: () => void;
}) {
  const margenes = useMargenes();
  const secreto = useSecretChat({
    credential,
    otherUserId: otherUserId ?? null,
    enabled: Boolean(encrypted),
  });
  const sesionLista = encrypted && secreto.estado === 'listo' ? secreto : null;
  const { messages, pending, connected, othersRead, send, sendMedia, markRead } = useChat({
    chatId,
    token: credential.jwt,
    seal: sesionLista?.seal,
    open: sesionLista?.open,
  });
  const [draft, setDraft] = useState('');
  const [attachOpen, setAttachOpen] = useState(false);
  // Crear desde la conversación: el chat YA está elegido, así que las pantallas
  // de crear no vuelven a preguntar dónde.
  const [creando, setCreando] = useState<'event' | 'poll' | null>(null);
  const [falloCifrado, setFalloCifrado] = useState(false);
  const llamada = useCall({ chatId, peerName: chatName });
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mediaError, setMediaError] = useState('');

  const upload = async (file: {
    uri: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  }) => {
    setUploading(true);
    setProgress(0);
    setMediaError('');
    const result = await sendMedia({ ...file, onProgress: setProgress });
    setUploading(false);
    // El fallo se DICE: una foto que desaparece sin explicación es lo que hace
    // que la gente deje de mandar fotos por la app.
    if (!result.ok) setMediaError(result.reason);
  };

  const pickFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setMediaError('Permite la cámara para poder tomar fotos.');
      return;
    }
    const shot = await ImagePicker.launchCameraAsync({ quality: 1 });
    const asset = shot.assets?.[0];
    if (shot.canceled || !asset) return;
    await upload({
      uri: asset.uri,
      fileName: asset.fileName ?? 'foto.jpg',
      mimeType: asset.mimeType ?? 'image/jpeg',
      sizeBytes: asset.fileSize ?? 0,
    });
  };

  const pickFromGallery = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      // `quality: 1` y sin edición: la foto se manda como está. Recomprimir es
      // justo la queja que esta app viene a no repetir.
      quality: 1,
      mediaTypes: ['images', 'videos'],
    });
    const asset = picked.assets?.[0];
    if (picked.canceled || !asset) return;
    await upload({
      uri: asset.uri,
      fileName: asset.fileName ?? 'archivo',
      mimeType: asset.mimeType ?? 'image/jpeg',
      sizeBytes: asset.fileSize ?? 0,
    });
  };

  const pickFile = async () => {
    const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    const asset = picked.assets?.[0];
    if (picked.canceled || !asset) return;
    await upload({
      uri: asset.uri,
      fileName: asset.name,
      mimeType: asset.mimeType ?? 'application/octet-stream',
      sizeBytes: asset.size ?? 0,
    });
  };

  const rows: Row[] = [...messages, ...pending];

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last) markRead(last.seq);
  }, [messages, markRead]);

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      testID="pantalla-chat"
    >
      {/* Header como el diseño: FLECHA (no la palabra «Atrás»), avatar del chat
          junto al nombre, y el menú al final. Video y llamada llegan con F10. */}
      <View className="flex-row items-center gap-2 border-b border-outline/10 bg-surface px-3 pb-3" style={{ paddingTop: margenes.cabecera }}>
        <Pressable onPress={onBack} testID="btn-volver" className="h-11 w-9 items-center justify-center">
          <ArrowLeft size={22} color="#0b1c30" />
        </Pressable>
        <View className="h-9 w-9 items-center justify-center rounded-full bg-primary/10">
          <Text className="text-sm font-bold text-primary">
            {chatName.slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-1.5">
            {/* El candado va PEGADO al nombre y no en una banda aparte: es una
                propiedad de con quién se está hablando, y tiene que verse en la
                misma mirada que el nombre. */}
            {encrypted ? <Lock size={13} color="#6b38d4" /> : null}
            <Text className="min-w-0 flex-1 text-base font-bold text-on-surface" numberOfLines={1}>
              {chatName}
            </Text>
          </View>
          {/* El estado de conexión se DICE: un mensaje que no sale sin
              explicación es lo que hace desconfiar de una app de mensajería. */}
          {!connected ? (
            <Text className="text-xs text-on-surface-variant" testID="estado-conexion">
              Sin conexión · se enviará cuando vuelva
            </Text>
          ) : null}
        </View>
        {/* Llamadas: dejan de ser inertes (F10). Solo en 1:1 — una llamada
            grupal es otra cosa (varias conexiones a la vez) y prometerla con el
            mismo botón sería mentir. */}
        {otherUserId ? (
          <>
            <Pressable
              testID="btn-videollamada"
              onPress={() => llamada.llamar(true)}
              className="h-11 w-9 items-center justify-center"
            >
              <Video size={20} color="#494454" />
            </Pressable>
            <Pressable
              testID="btn-llamada"
              onPress={() => llamada.llamar(false)}
              className="h-11 w-9 items-center justify-center"
            >
              <Phone size={20} color="#494454" />
            </Pressable>
          </>
        ) : null}
        <Pressable testID="btn-menu-chat" className="h-11 w-9 items-center justify-center">
          <MoreVertical size={20} color="#494454" />
        </Pressable>
      </View>

      {creando === 'event' ? (
        <CreateEventScreen
          visible
          credential={credential}
          fixedChat={{ id: chatId, name: chatName }}
          onClose={() => setCreando(null)}
          onCreated={() => setCreando(null)}
        />
      ) : creando === 'poll' ? (
        <CreatePollScreen
          visible
          credential={credential}
          fixedChat={{ id: chatId, name: chatName }}
          onClose={() => setCreando(null)}
          onCreated={() => setCreando(null)}
        />
      ) : null}

      {/* En un chat cifrado NO se ofrece «ponme al día»: Lila no puede leerlo,
          y un botón que siempre falla es peor que no tenerlo. */}
      {/* La pantalla de llamada se monta SOBRE el chat: al colgar se vuelve a
          la conversación, que es donde uno estaba. */}
      {llamada.state ? (
        <CallScreen
          visible
          state={llamada.state}
          peerName={chatName}
          video={llamada.video}
          muted={llamada.muted}
          speaker={llamada.speaker}
          onToggleMute={llamada.alternarMute}
          onToggleSpeaker={llamada.alternarAltavoz}
          onToggleVideo={llamada.alternarVideo}
          onAccept={llamada.contestar}
          onHangUp={() => {
            llamada.colgar();
            // Se cierra un instante después para que se vea «terminada» en vez
            // de desaparecer de golpe, que se siente como que se cortó sola.
            setTimeout(llamada.cerrar, 900);
          }}
        />
      ) : null}

      {falloCifrado ? (
        <Text className="px-4 pb-1 text-sm text-error" testID="error-cifrado">
          No se pudo cifrar el mensaje. No se envió.
        </Text>
      ) : null}

      {encrypted ? (
        <SecretChatBanner session={secreto} />
      ) : (
        <CatchUpBanner chatId={chatId} credential={credential} unread={unread} />
      )}

      <FlashList
        data={rows}
        testID="lista-mensajes"
        keyExtractor={(row) => (isPending(row) ? `p-${row.clientKey}` : `m-${row.seq}`)}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
        renderItem={({ item, index }) => {
          const previous = rows[index - 1];
          const next = rows[index + 1];
          const at = isPending(item) ? item.queuedAt : item.at;
          const previousAt = previous ? (isPending(previous) ? previous.queuedAt : previous.at) : undefined;
          return (
            <>
              {startsNewDay(at, previousAt) ? <DaySeparator label={formatDayLabel(at)} /> : null}
              <MessageRow
                item={item}
                previous={previous}
                next={next}
                myUserId={credential.userId}
                othersReadSeq={Math.max(othersReadSeq, othersRead)}
                othersDeliveredSeq={othersDeliveredSeq}
                senderInitial={chatName.slice(0, 1).toUpperCase()}
              />
            </>
          );
        }}
      />

      {uploading ? (
        <Text className="px-4 pb-1 text-sm text-on-surface-variant" testID="subida-progreso">
          Enviando archivo… {Math.round(progress * 100)}%
        </Text>
      ) : null}

      {mediaError ? (
        <Text className="px-4 pb-1 text-sm text-error" testID="error-media">
          {mediaError}
        </Text>
      ) : null}

      {/* La barra, tal como está COMPUESTA en el diseño — y no era «los mismos
          iconos en una fila»:
            · el «+» va PLANO, sin círculo de fondo;
            · hay UNA píldora larga y el emoji vive DENTRO, contra su borde;
            · a la derecha hay UN SOLO botón circular, y es excluyente:
              micrófono con el campo vacío, enviar apenas se escribe algo.
          La primera versión puso los cinco controles como hermanos: entraban
          todos, pero el campo quedaba tan angosto que el placeholder se partía
          en dos líneas. */}
      <View className="flex-row items-end gap-1.5 border-t border-outline/10 bg-surface px-3 pt-3" style={{ paddingBottom: margenes.pie }}>
        <Pressable
          testID="btn-adjuntar"
          onPress={() => setAttachOpen(true)}
          disabled={uploading}
          className="h-11 w-11 items-center justify-center"
        >
          {uploading ? <ActivityIndicator color="#6b38d4" /> : <Plus size={24} color="#494454" />}
        </Pressable>

        <View className="min-w-0 flex-1 flex-row items-end rounded-xl border border-outline/15 bg-background pr-1">
          <TextInput
            testID="input-mensaje"
            className="max-h-28 min-h-[44px] min-w-0 flex-1 px-4 py-2.5 text-base text-on-surface"
            placeholder="Escribe un mensaje"
            placeholderTextColor="#7b7486"
            multiline
            value={draft}
            onChangeText={setDraft}
          />
          <Pressable testID="btn-emoji" className="h-11 w-9 items-center justify-center">
            <Smile size={20} color="#7b7486" />
          </Pressable>
        </View>

        {draft.trim() ? (
          <Pressable
            testID="btn-enviar"
            onPress={() => {
              const text = draft;
              setDraft('');
              void (async () => {
                const resultado = await send(text);
                // Si NO se pudo cifrar, el mensaje no salió y hay que decirlo:
                // en un chat con candado, un envío que falla en silencio deja a
                // la persona creyendo que el otro lo recibió.
                if (!resultado?.ok) {
                  setDraft(text);
                  setFalloCifrado(true);
                }
              })();
            }}
            className="h-11 w-11 items-center justify-center rounded-full bg-primary"
          >
            <Send size={18} color="#ffffff" />
          </Pressable>
        ) : (
          // Inerte hasta que existan las notas de voz, pero ocupa su lugar: si
          // apareciera recién con la función, la barra cambiaría de forma.
          <View testID="btn-voz" className="h-11 w-11 items-center justify-center rounded-full bg-primary/30">
            <Mic size={18} color="#ffffff" />
          </View>
        )}
      </View>

      <AttachSheet
        visible={attachOpen}
        onClose={() => setAttachOpen(false)}
        onPickCamera={() => void pickFromCamera()}
        onPickGallery={() => void pickFromGallery()}
        onCreateEvent={() => setCreando('event')}
        onCreatePoll={() => setCreando('poll')}
        onPickFile={() => void pickFile()}
      />
    </KeyboardAvoidingView>
  );
}
