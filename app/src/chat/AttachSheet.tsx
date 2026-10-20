import { useEffect, useState } from 'react';
import { FlatList, Linking, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Modal } from '../ui/Modal';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library/legacy';
import { BarChart3, Bell, CalendarDays, FileText, Image as ImageIcon, Send } from 'lucide-react-native';
import { useMargenes } from '../ui/useMargenes';
import { useColores } from '../ui/tema';
import { reportarError } from '../ui/reportarError';
import { toggleSelection, toPickedPhoto, type GalleryItem } from './attachSelection';
import type { FotoElegida } from './envioDeFotos';

/** How many recent photos and videos the sheet lists (like WhatsApp's first screen). */
const RECENT_MEDIA = 60;
const COLUMNS = 4;
const GAP = 3;
/** Room under the grid so the «Enviar» button never covers the last row. */
const SEND_BUTTON_ROOM = 88;
type Access = 'unknown' | 'granted' | 'ask' | 'denied';
type Asset = GalleryItem & { id: string; duration: number };

const formatDuration = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;

async function loadRecentMedia(): Promise<{ access: Access; assets: Asset[] }> {
  try {
    const permission = await MediaLibrary.getPermissionsAsync(false, ['photo', 'video']);
    if (!permission.granted) return { access: permission.canAskAgain ? 'ask' : 'denied', assets: [] };
    const page = await MediaLibrary.getAssetsAsync({ first: RECENT_MEDIA, mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video], sortBy: [[MediaLibrary.SortBy.creationTime, false]] });
    const assets = page.assets.map((asset) => ({ id: asset.id, uri: asset.uri, filename: asset.filename, width: asset.width, height: asset.height, duration: asset.duration, mediaType: asset.mediaType === MediaLibrary.MediaType.video ? ('video' as const) : ('photo' as const) }));
    return { access: 'granted', assets };
  } catch (error) {
    reportarError('AttachSheet.loadRecentMedia', error);
    return { access: 'denied', assets: [] };
  }
}

/**
 * The clip of the conversation (José, 20/10: «in WhatsApp and Telegram the clip
 * shows my gallery right away to pick and send, plus the options»). On top:
 * Galería (every album), Documento, Evento, Encuesta and the chat reminder.
 * Below: the latest photos and videos; tap to pick (in order), «Enviar» opens
 * the usual preview with captions and HD. No «Cámara» here: it has its own
 * button in the bar (José, 20/10).
 */
export function AttachSheet(props: {
  visible: boolean;
  onClose: () => void;
  onPickGallery: () => void;
  onPickMedia: (photos: FotoElegida[]) => void;
  onPickFile: () => void;
  onCreateEvent: () => void;
  onCreatePoll: () => void;
  /** The reminder that lives in the chat: in a group, its admins (19/10); in a 1:1 or a draft, anyone (20/10). */
  onCreateReminder?: () => void;
  etiquetaDelRecordatorio?: string;
}) {
  const colors = useColores();
  const margins = useMargenes();
  const { width, height } = useWindowDimensions();
  const [access, setAccess] = useState<Access>('unknown');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const side = (width - GAP * (COLUMNS - 1)) / COLUMNS;

  useEffect(() => {
    if (!props.visible) return;
    setSelected([]);
    let current = true;
    void loadRecentMedia().then((result) => {
      if (!current) return;
      setAccess(result.access);
      setAssets(result.assets);
    });
    return () => {
      current = false;
    };
  }, [props.visible]);

  const askAccess = async () => {
    const answer = await MediaLibrary.requestPermissionsAsync(false, ['photo', 'video']);
    if (!answer.granted) return setAccess(answer.canAskAgain ? 'ask' : 'denied');
    const result = await loadRecentMedia();
    setAccess(result.access);
    setAssets(result.assets);
  };
  const run = (action: () => void) => {
    props.onClose();
    action();
  };
  const sendSelected = () => run(() => props.onPickMedia(selected.flatMap((id) => assets.filter((asset) => asset.id === id).map(toPickedPhoto))));

  const options = [
    { key: 'gallery', label: 'Galería', Icon: ImageIcon, action: props.onPickGallery, testID: 'attach-galeria' },
    { key: 'file', label: 'Documento', Icon: FileText, action: props.onPickFile, testID: 'attach-archivo' },
    { key: 'event', label: 'Evento', Icon: CalendarDays, action: props.onCreateEvent, testID: 'attach-evento' },
    { key: 'poll', label: 'Encuesta', Icon: BarChart3, action: props.onCreatePoll, testID: 'attach-encuesta' },
    ...(props.onCreateReminder ? [{ key: 'reminder', label: props.etiquetaDelRecordatorio ?? 'Recordatorio', Icon: Bell, action: props.onCreateReminder, testID: 'attach-recordatorio' }] : []),
  ];

  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={props.onClose} accessibilityLabel="Cerrar" />
      <View className="rounded-t-2xl bg-surface pt-3" style={{ paddingBottom: margins.pie, maxHeight: height * 0.78 }} testID="attach-sheet">
        <View className="mb-3 h-1.5 w-11 self-center rounded-full bg-outline/30" />
        <View className="flex-row flex-wrap px-3">
          {options.map(({ key, label, Icon, action, testID }) => (
            <Pressable key={key} testID={testID} onPress={() => run(action)} className="mb-3 items-center" style={{ width: (width - 24) / 4 }}>
              <View className="h-14 w-14 items-center justify-center rounded-full border border-outline/15 bg-primary/10">
                <Icon size={22} color={colors.primary} />
              </View>
              <Text numberOfLines={1} className="mt-1.5 text-[12px] text-on-surface">{label}</Text>
            </Pressable>
          ))}
        </View>
        {access === 'granted' ? (
          <FlatList
            testID="attach-galeria-reciente"
            data={assets}
            numColumns={COLUMNS}
            keyExtractor={(asset) => asset.id}
            columnWrapperStyle={{ gap: GAP }}
            contentContainerStyle={{ gap: GAP, paddingBottom: selected.length ? SEND_BUTTON_ROOM : 0 }}
            ListEmptyComponent={<Text className="px-5 py-6 text-center text-[13px] text-on-surface-variant">No hay fotos ni videos en el teléfono.</Text>}
            renderItem={({ item }) => {
              const order = selected.indexOf(item.id);
              return (
                <Pressable testID={`attach-media-${item.id}`} onPress={() => setSelected((before) => toggleSelection(before, item.id))} style={{ width: side, height: side }}>
                  <Image source={{ uri: item.uri }} style={{ width: side, height: side, opacity: order >= 0 ? 0.75 : 1 }} contentFit="cover" recyclingKey={item.id} />
                  {item.mediaType === 'video' ? <Text className="absolute bottom-1 left-1.5 text-[11px] font-semibold" style={{ color: 'white', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 }}>▶ {formatDuration(item.duration)}</Text> : null}
                  <View className={`absolute right-1.5 top-1.5 h-6 w-6 items-center justify-center rounded-full border-2 border-white ${order >= 0 ? 'bg-primary' : 'bg-black/20'}`}>
                    {order >= 0 ? <Text className="text-[12px] font-bold" style={{ color: 'white' }}>{order + 1}</Text> : null}
                  </View>
                </Pressable>
              );
            }}
          />
        ) : access === 'unknown' ? null : (
          <View className="mx-4 mb-2 items-center rounded-xl border border-outline/15 px-4 py-5">
            <Text className="text-center text-[14px] text-on-surface">{access === 'ask' ? 'Mira aquí tus fotos y videos para enviarlos rápido.' : 'Activa el permiso de Fotos y videos en los ajustes del teléfono para verlos aquí.'}</Text>
            <Pressable testID="attach-permiso" onPress={() => void (access === 'ask' ? askAccess() : Linking.openSettings())} className="mt-3 h-11 items-center justify-center rounded-full bg-primary px-5">
              <Text className="font-semibold text-on-primary">{access === 'ask' ? 'Permitir acceso' : 'Abrir ajustes'}</Text>
            </Pressable>
          </View>
        )}
        {selected.length ? (
          <Pressable testID="attach-enviar" onPress={sendSelected} className="absolute bottom-0 right-4 h-14 flex-row items-center gap-2 rounded-full bg-primary px-5" style={{ marginBottom: margins.pie + 12 }}>
            <Send size={20} color="white" />
            <Text className="text-[15px] font-semibold text-on-primary">Enviar {selected.length}</Text>
          </Pressable>
        ) : null}
      </View>
    </Modal>
  );
}
