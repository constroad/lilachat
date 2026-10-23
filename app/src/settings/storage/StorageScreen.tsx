import { useEffect, useState, type ComponentType } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { ChevronRight, FileText, Images, Layers, MessageSquareText, Mic, Paperclip } from 'lucide-react-native';
import { formatBytes, kindBreakdown, type StorageChat, type StorageReport } from '@lilachat/shared';
import { getStorageReport } from '../../api/client';
import { agendaPorTelefono } from '../../contacts/agendaEnMemoria';
import { Avatar } from '../../ui/Avatar';
import { PantallaEnModal } from '../../ui/PantallaEnModal';
import { useColores } from '../../ui/tema';
import { chatLabelName } from './chatLabel';
import type { LocalBucket } from './localBuckets';
import { StorageFilesScreen, type FilesSource } from './StorageFilesScreen';
import { useLocalStorage } from './useLocalStorage';

const AGAIN = 'Se borran de este teléfono. Si los vuelves a abrir, se descargan otra vez.';
const ROWS: { bucket: LocalBucket; title: string; hint: string; Icon: ComponentType<{ size: number; color: string }> }[] = [
  { bucket: 'seen', title: 'Fotos y videos vistos', hint: AGAIN, Icon: Images },
  { bucket: 'voice', title: 'Notas de voz descargadas', hint: AGAIN, Icon: Mic },
  { bucket: 'documents', title: 'Documentos abiertos', hint: AGAIN, Icon: FileText },
  { bucket: 'temporary', title: 'Archivos temporales', hint: 'Son copias que ya no se usan: fotos elegidas, capturas de la cámara, stickers a medio hacer y actualizaciones descargadas.', Icon: Layers },
];


/**
 * «Almacenamiento» (pending 13, design `r152-almacenamiento`), like WhatsApp:
 * what Lilachat keeps on this phone with «Liberar» per group, the files over
 * 5 MB and the chats where the most was shared, to hide in bulk «for me».
 */
export function StorageScreen(props: { visible: boolean; jwt: string; onClose: () => void }) {
  const colors = useColores();
  const agenda = agendaPorTelefono();
  const { storage, release } = useLocalStorage(props.visible);
  const [report, setReport] = useState<StorageReport | null>(null);
  const [error, setError] = useState('');
  const [files, setFiles] = useState<FilesSource | null>(null);
  useEffect(() => {
    if (!props.visible) return;
    void getStorageReport(props.jwt).then((response) => (response.ok ? (setReport(response.data), setError('')) : setError(response.message ?? 'No se pudo revisar lo que pesan tus chats.')));
  }, [props.visible, props.jwt]);
  const confirmRelease = (bucket: LocalBucket, title: string, hint: string) =>
    Alert.alert(`Liberar ${title.toLowerCase()}`, hint, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Liberar', style: 'destructive', onPress: () => void release(bucket) },
    ]);
  const bigBytes = report?.bigFiles.reduce((sum, file) => sum + file.bytes, 0) ?? 0;
  const used = storage ? storage.disk - storage.free : 0;

  return (
    <PantallaEnModal visible={props.visible} titulo="Almacenamiento" onCerrar={props.onClose} testIDCerrar="almacenamiento-volver">
      <View testID="pantalla-almacenamiento">
        <View className="rounded-2xl border border-outline/15 bg-surface p-4">
          <Text testID="almacenamiento-total" className="text-[32px] font-bold text-on-surface" style={{ fontVariant: ['tabular-nums'] }}>{storage ? formatBytes(storage.total) : '—'}</Text>
          <Text className="text-[13px] text-on-surface-variant">Lilachat en este teléfono</Text>
          {storage && storage.disk > 0 ? (
            <>
              <View className="mt-3 h-2 flex-row overflow-hidden rounded-full bg-outline/10">
                <View className="bg-primary" style={{ width: `${Math.max(1, (storage.total / storage.disk) * 100)}%` }} />
                <View className="bg-outline/30" style={{ width: `${Math.max(0, ((used - storage.total) / storage.disk) * 100)}%` }} />
              </View>
              <Text className="mt-2 text-[12px] text-on-surface-variant">Lilachat {formatBytes(storage.total)} · Libre {formatBytes(storage.free)}</Text>
            </>
          ) : null}
        </View>

        <Kicker>En este teléfono</Kicker>
        <View className="overflow-hidden rounded-2xl border border-outline/15 bg-surface">
          {ROWS.map(({ bucket, title, hint, Icon }, index) => (
            <View key={bucket} testID={`almacenamiento-${bucket}`} className={`min-h-[56px] flex-row items-center gap-3 px-4 py-2 ${index ? 'border-t border-outline/10' : ''}`}>
              <View className="h-9 w-9 items-center justify-center rounded-full bg-primary/10"><Icon size={18} color={colors.primary} /></View>
              <View className="min-w-0 flex-1">
                <Text className="text-[15px] text-on-surface" numberOfLines={1}>{title}</Text>
                <Text className="text-[13px] text-on-surface-variant" style={{ fontVariant: ['tabular-nums'] }}>{storage ? formatBytes(storage.buckets[bucket]) : '—'}</Text>
              </View>
              <Pressable testID={`liberar-${bucket}`} disabled={!storage || storage.buckets[bucket] === 0} onPress={() => confirmRelease(bucket, title, hint)} className={`h-9 items-center justify-center rounded-lg border border-primary/40 px-3 ${!storage || storage.buckets[bucket] === 0 ? 'opacity-40' : ''}`}>
                <Text className="text-[13px] font-semibold text-primary">Liberar</Text>
              </Pressable>
            </View>
          ))}
          <View className="min-h-[56px] flex-row items-center gap-3 border-t border-outline/10 px-4 py-2">
            <View className="h-9 w-9 items-center justify-center rounded-full bg-primary/10"><MessageSquareText size={18} color={colors.primary} /></View>
            <View className="min-w-0 flex-1">
              <Text className="text-[15px] text-on-surface">Mensajes guardados</Text>
              <Text className="text-[12px] text-on-surface-variant">Se necesitan para usar Lilachat sin señal</Text>
            </View>
            <Text className="text-[14px] text-on-surface-variant" style={{ fontVariant: ['tabular-nums'] }}>{storage ? formatBytes(storage.messages) : '—'}</Text>
          </View>
        </View>

        <Kicker>Revisar y eliminar</Kicker>
        <Pressable testID="almacenamiento-grandes" disabled={!report} onPress={() => report && setFiles({ title: 'Archivos de más de 5 MB', files: report.bigFiles })} className="min-h-[64px] flex-row items-center gap-3 rounded-2xl border border-outline/15 bg-surface px-4 py-2">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-primary/10"><Paperclip size={18} color={colors.primary} /></View>
          <View className="min-w-0 flex-1">
            <Text className="text-[15px] font-semibold text-on-surface">Archivos de más de 5 MB</Text>
            <Text className="text-[13px] text-on-surface-variant">{report ? `${report.bigFiles.length} ${report.bigFiles.length === 1 ? 'archivo' : 'archivos'} · ${formatBytes(bigBytes)}` : 'Revisando…'}</Text>
          </View>
          <ChevronRight size={18} color={colors['on-surface-variant']} />
        </Pressable>

        <Kicker>Chats que más pesan</Kicker>
        <Text className="-mt-1 mb-2 text-[12px] text-on-surface-variant">Lo que se compartió en cada chat.</Text>
        {error ? <Text className="text-[13px] text-error">{error}</Text> : null}
        {report && report.chats.length === 0 ? <Text className="text-[13px] text-on-surface-variant">Todavía no hay fotos, videos ni documentos en tus chats.</Text> : null}
        {report && report.chats.length > 0 ? (
          <View className="overflow-hidden rounded-2xl border border-outline/15 bg-surface">
            {report.chats.map((chat, index) => (
              <ChatRow key={chat.chatId} chat={chat} name={chatLabelName(chat.chat, agenda)} first={index === 0} onPress={() => setFiles({ title: chatLabelName(chat.chat, agenda), chatId: chat.chatId })} />
            ))}
          </View>
        ) : null}
      </View>
      <StorageFilesScreen source={files} jwt={props.jwt} onClose={() => setFiles(null)} onHidden={() => void getStorageReport(props.jwt).then((response) => response.ok && setReport(response.data))} />
    </PantallaEnModal>
  );
}

function ChatRow(props: { chat: StorageChat; name: string; first: boolean; onPress: () => void }) {
  const colors = useColores();
  return (
    <Pressable testID={`almacenamiento-chat-${props.chat.chatId}`} onPress={props.onPress} className={`min-h-[64px] flex-row items-center gap-3 px-4 py-2 ${props.first ? '' : 'border-t border-outline/10'}`}>
      <Avatar nombre={props.name} tamano={40} />
      <View className="min-w-0 flex-1">
        <Text className="text-[15px] font-semibold text-on-surface" numberOfLines={1}>{props.name}</Text>
        <Text className="text-[12px] text-on-surface-variant" numberOfLines={1}>{kindBreakdown(props.chat.byKind)}</Text>
      </View>
      <Text className="text-[14px] font-bold text-on-surface" style={{ fontVariant: ['tabular-nums'] }}>{formatBytes(props.chat.bytes)}</Text>
      <ChevronRight size={18} color={colors['on-surface-variant']} />
    </Pressable>
  );
}

function Kicker({ children }: { children: string }) {
  return <Text className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">{children}</Text>;
}
