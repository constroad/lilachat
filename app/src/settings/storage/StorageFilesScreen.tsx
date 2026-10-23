import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { Check, FileText, Image as ImageIcon, Mic, Video } from 'lucide-react-native';
import { formatBytes, formatChatTimestamp, type BigFile, type StorageKind } from '@lilachat/shared';
import { getChatStorageFiles } from '../../api/client';
import { hideForMe } from '../../chat/ocultos';
import { agendaPorTelefono } from '../../contacts/agendaEnMemoria';
import { PantallaEnModal } from '../../ui/PantallaEnModal';
import { useColores } from '../../ui/tema';
import { chatLabelName } from './chatLabel';

/** The files over 5 MB (from all chats) or one chat's files. */
export type FilesSource = { title: string; files: BigFile[] } | { title: string; chatId: string };

const KIND = { image: { label: 'Foto', Icon: ImageIcon }, video: { label: 'Video', Icon: Video }, audio: { label: 'Nota de voz', Icon: Mic }, file: { label: 'Documento', Icon: FileText } } satisfies Record<StorageKind, unknown>;
const keyOf = (file: BigFile) => `${file.chatId}:${file.seq}`;

/**
 * A list of files to clean up (pending 13): biggest first, pick some or all
 * and «Eliminar para mí» hides them on this phone, like the same option in
 * the chat; the others still see them.
 */
export function StorageFilesScreen(props: { source: FilesSource | null; jwt: string; onClose: () => void; onHidden: () => void }) {
  const colors = useColores();
  const agenda = agendaPorTelefono();
  const [files, setFiles] = useState<BigFile[] | null>(null);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState('');
  const source = props.source;
  useEffect(() => {
    setPicked(new Set());
    setError('');
    if (!source) return setFiles(null);
    if ('files' in source) return setFiles(source.files);
    setFiles(null);
    void getChatStorageFiles(props.jwt, source.chatId).then((response) => (response.ok ? setFiles(response.data.files) : setError(response.message ?? 'No se pudieron cargar los archivos.')));
  }, [source, props.jwt]);
  const chosen = (files ?? []).filter((file) => picked.has(keyOf(file)));
  const chosenBytes = chosen.reduce((sum, file) => sum + file.bytes, 0);
  const toggle = (file: BigFile) => setPicked((before) => {
    const next = new Set(before);
    if (next.has(keyOf(file))) next.delete(keyOf(file));
    else next.add(keyOf(file));
    return next;
  });
  const hideChosen = async () => {
    const byChat = new Map<string, number[]>();
    for (const file of chosen) byChat.set(file.chatId, [...(byChat.get(file.chatId) ?? []), file.seq]);
    await Promise.all([...byChat].map(([chatId, seqs]) => hideForMe(chatId, seqs)));
    setFiles((before) => (before ?? []).filter((file) => !picked.has(keyOf(file))));
    setPicked(new Set());
    props.onHidden();
  };
  const confirm = () =>
    Alert.alert(`¿Eliminar ${chosen.length === 1 ? 'el archivo' : `${chosen.length} archivos`} para ti?`, 'Dejan de verse en este teléfono, como «Eliminar para mí» en el chat. Los demás los siguen viendo.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar para mí', style: 'destructive', onPress: () => void hideChosen() },
    ]);
  const allPicked = files !== null && files.length > 0 && chosen.length === files.length;

  return (
    <PantallaEnModal
      visible={source !== null}
      titulo={source?.title ?? ''}
      onCerrar={props.onClose}
      testIDCerrar="archivos-volver"
      footer={chosen.length ? (
        <Pressable testID="archivos-eliminar" onPress={confirm} className="h-12 items-center justify-center rounded-xl bg-error">
          <Text className="text-[15px] font-semibold text-white">Eliminar para mí · {chosen.length} · {formatBytes(chosenBytes)}</Text>
        </Pressable>
      ) : null}
    >
      {files && files.length > 0 ? (
        <Pressable testID="archivos-todos" onPress={() => setPicked(allPicked ? new Set() : new Set(files.map(keyOf)))} className="mb-2 h-10 justify-center">
          <Text className="text-[14px] font-semibold text-primary">{allPicked ? 'Quitar la selección' : 'Seleccionar todo'}</Text>
        </Pressable>
      ) : null}
      {error ? <Text className="text-[13px] text-error">{error}</Text> : null}
      {files === null && !error ? <ActivityIndicator className="mt-8" color={colors.primary} /> : null}
      {files !== null && files.length === 0 ? <Text className="mt-8 text-center text-[14px] text-on-surface-variant">No hay archivos para revisar.</Text> : null}
      {/* At most 100 rows (the server's limit): a plain list, inside the screen's own scroll. */}
      <View testID="lista-archivos">
        {(files ?? []).map((item) => {
          const { label, Icon } = KIND[item.kind];
          const on = picked.has(keyOf(item));
          return (
            <Pressable key={keyOf(item)} testID={`archivo-${item.seq}`} onPress={() => toggle(item)} className="min-h-[60px] flex-row items-center gap-3 border-b border-outline/10 py-2">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><Icon size={18} color={colors.primary} /></View>
              <View className="min-w-0 flex-1">
                <Text className="text-[15px] text-on-surface" numberOfLines={1}>{item.fileName ?? label}</Text>
                <Text className="text-[12px] text-on-surface-variant" numberOfLines={1}>{[item.chat ? chatLabelName(item.chat, agenda) : null, formatChatTimestamp(item.at)].filter(Boolean).join(' · ')}</Text>
              </View>
              <Text className="text-[14px] font-semibold text-on-surface" style={{ fontVariant: ['tabular-nums'] }}>{formatBytes(item.bytes)}</Text>
              <View className={`h-6 w-6 items-center justify-center rounded-full border-2 ${on ? 'border-primary bg-primary' : 'border-outline/40'}`}>{on ? <Check size={14} color={colors['on-primary']} /> : null}</View>
            </Pressable>
          );
        })}
      </View>
    </PantallaEnModal>
  );
}
