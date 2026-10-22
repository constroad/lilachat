import { useEffect, useState, type ReactNode } from 'react';
import { FlatList, Linking, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { Modal } from '../ui/Modal';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library/legacy';
import { ArrowLeft, BarChart3, Bell, CalendarDays, ClipboardCheck, FileText, Image as ImageIcon, LayoutGrid, type LucideIcon, Send, UserRound } from 'lucide-react-native';
import { useMargenes } from '../ui/useMargenes';
import { useColores } from '../ui/tema';
import { reportarError } from '../ui/reportarError';
import { mediaAccessFrom, toggleSelection, toPickedPhoto, type GalleryItem, type MediaAccess } from './attachSelection';
import type { FotoElegida } from './envioDeFotos';

/** How many recent photos and videos the sheet lists (like WhatsApp's first screen). */
const RECENT_MEDIA = 60;
const COLUMNS = 4;
const GAP = 3;
/** Room under the grid so the «Enviar» button never covers the last row. */
const SEND_BUTTON_ROOM = 88;
/** The recent strip under the options (design `m-01-clip-ordenado`). */
const STRIP_SIDE = 72;
const STRIP_COUNT = 12;
const SHEET_PADDING = 20;
/** A 4-column grid (design `m-01`): «Organizar» has four with the checklist (21/10). */
const OPTION_COLUMNS = 4;
type Access = 'unknown' | MediaAccess;
type Asset = GalleryItem & { id: string; duration: number };

const formatDuration = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;

async function loadRecentMedia(): Promise<{ access: Access; assets: Asset[] }> {
  try {
    const permission = await MediaLibrary.getPermissionsAsync(false, ['photo', 'video']);
    const access = mediaAccessFrom(permission);
    if (access === 'ask' || access === 'denied') return { access, assets: [] };
    const page = await MediaLibrary.getAssetsAsync({ first: RECENT_MEDIA, mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video], sortBy: [[MediaLibrary.SortBy.creationTime, false]] });
    const assets = page.assets.map((asset) => ({ id: asset.id, uri: asset.uri, filename: asset.filename, width: asset.width, height: asset.height, duration: asset.duration, mediaType: asset.mediaType === MediaLibrary.MediaType.video ? ('video' as const) : ('photo' as const) }));
    return { access, assets };
  } catch (error) {
    reportarError('AttachSheet.loadRecentMedia', error);
    return { access: 'denied', assets: [] };
  }
}

type Option = { key: string; label: string; Icon: LucideIcon; action: () => void; testID: string };

/**
 * The clip of the conversation (design `m-01-clip-ordenado`; José, 21/10: «que
 * no se vea todo amontonado»). Two sections of up to three options with a
 * one-word label each: Compartir (Galería, Documento) and Organizar (Evento,
 * Encuesta, Recordatorio); no title and no «Divertido» (José, 21/10: nudge and
 * winks live in the emoji panel, so the gallery has room). Below, the latest
 * photos and videos in ONE row; «Ver todas» opens the whole grid. Tap to pick
 * (in order), «Enviar» opens the usual preview with captions and HD. No
 * «Cámara» here: it has its own button in the bar (José, 20/10).
 */
export function AttachSheet(props: {
  visible: boolean;
  onClose: () => void;
  onPickGallery: () => void;
  onPickMedia: (photos: FotoElegida[]) => void;
  onPickFile: () => void;
  /** A contact of the phone book (pending 9); not in a secret chat. */
  onShareContact?: () => void;
  onCreateEvent: () => void;
  onCreatePoll: () => void;
  /** A checklist like Telegram's (backlog 8); not in a secret chat. */
  onCreateChecklist?: () => void;
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
  const [allPhotos, setAllPhotos] = useState(false);
  const side = (width - GAP * (COLUMNS - 1)) / COLUMNS;

  useEffect(() => {
    if (!props.visible) return;
    setSelected([]);
    setAllPhotos(false);
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
    const after = mediaAccessFrom(answer);
    if (after === 'ask' || after === 'denied') return setAccess(after);
    const result = await loadRecentMedia();
    setAccess(result.access);
    setAssets(result.assets);
  };
  const run = (action: () => void) => {
    props.onClose();
    action();
  };
  const sendSelected = () => run(() => props.onPickMedia(selected.flatMap((id) => assets.filter((asset) => asset.id === id).map(toPickedPhoto))));

  const sections: { title: string; options: Option[] }[] = [
    {
      title: 'Compartir',
      options: [
        { key: 'gallery', label: 'Galería', Icon: ImageIcon, action: props.onPickGallery, testID: 'attach-galeria' },
        { key: 'file', label: 'Documento', Icon: FileText, action: props.onPickFile, testID: 'attach-archivo' },
        ...(props.onShareContact ? [{ key: 'contact', label: 'Contacto', Icon: UserRound, action: props.onShareContact, testID: 'attach-contacto' }] : []),
      ],
    },
    {
      title: 'Organizar',
      options: [
        { key: 'event', label: 'Evento', Icon: CalendarDays, action: props.onCreateEvent, testID: 'attach-evento' },
        { key: 'poll', label: 'Encuesta', Icon: BarChart3, action: props.onCreatePoll, testID: 'attach-encuesta' },
        ...(props.onCreateChecklist ? [{ key: 'checklist', label: 'Checklist', Icon: ClipboardCheck, action: props.onCreateChecklist, testID: 'attach-checklist' }] : []),
        ...(props.onCreateReminder ? [{ key: 'reminder', label: props.etiquetaDelRecordatorio ?? 'Recordatorio', Icon: Bell, action: props.onCreateReminder, testID: 'attach-recordatorio' }] : []),
      ],
    },
  ].filter((section) => section.options.length > 0);
  const optionWidth = (width - SHEET_PADDING * 2) / OPTION_COLUMNS;
  const pickToggle = (id: string) => setSelected((before) => toggleSelection(before, id));

  const limitedBanner =
    access === 'limited' ? (
      <View testID="attach-acceso-limitado" className="mx-5 mb-2 flex-row items-center gap-3 rounded-xl border border-outline/15 px-3 py-2.5">
        <Text className="min-w-0 flex-1 text-[13px] text-on-surface">Solo ves las fotos que elegiste al dar el permiso.</Text>
        <Pressable testID="attach-ver-todas" onPress={() => void askAccess()} className="h-10 items-center justify-center rounded-full bg-primary px-4">
          <Text className="text-[13px] font-semibold text-on-primary">Ver todas</Text>
        </Pressable>
      </View>
    ) : null;
  const permissionPrompt =
    access === 'ask' || access === 'denied' ? (
      <View className="mx-5 mb-2 items-center rounded-xl border border-outline/15 px-4 py-5">
        <Text className="text-center text-[14px] text-on-surface">{access === 'ask' ? 'Mira aquí tus fotos y videos para enviarlos rápido.' : 'Activa el permiso de Fotos y videos en los ajustes del teléfono para verlos aquí.'}</Text>
        <Pressable testID="attach-permiso" onPress={() => void (access === 'ask' ? askAccess() : Linking.openSettings())} className="mt-3 h-11 items-center justify-center rounded-full bg-primary px-5">
          <Text className="font-semibold text-on-primary">{access === 'ask' ? 'Permitir acceso' : 'Abrir ajustes'}</Text>
        </Pressable>
      </View>
    ) : null;
  const emptyText = access === 'limited' ? 'Todavía no elegiste ninguna foto.' : 'No hay fotos ni videos en el teléfono.';
  const canSeePhotos = access === 'granted' || access === 'limited';

  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={props.onClose} accessibilityLabel="Cerrar" />
      <View className="rounded-t-3xl bg-surface pt-3" style={{ paddingBottom: margins.pie, maxHeight: height * 0.85 }} testID="attach-sheet">
        <View className="mb-2 h-1.5 w-11 self-center rounded-full bg-outline/30" />
        {allPhotos ? (
          <>
            <View className="flex-row items-center gap-1 px-2 pb-2">
              <Pressable testID="attach-volver" accessibilityLabel="Volver" onPress={() => setAllPhotos(false)} className="h-11 w-11 items-center justify-center rounded-full">
                <ArrowLeft size={22} color={colors['on-surface']} />
              </Pressable>
              <Text className="text-[16px] font-bold text-on-surface">Fotos y videos</Text>
            </View>
            {limitedBanner}
            <FlatList
              testID="attach-galeria-reciente"
              data={assets}
              numColumns={COLUMNS}
              keyExtractor={(asset) => asset.id}
              columnWrapperStyle={{ gap: GAP }}
              contentContainerStyle={{ gap: GAP, paddingBottom: selected.length ? SEND_BUTTON_ROOM : 0 }}
              ListEmptyComponent={<Text className="px-5 py-6 text-center text-[13px] text-on-surface-variant">{emptyText}</Text>}
              renderItem={({ item }) => <MediaTile asset={item} side={side} order={selected.indexOf(item.id)} onPress={() => pickToggle(item.id)} />}
            />
          </>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: selected.length ? SEND_BUTTON_ROOM : 8 }}>
            {sections.map((section, index) => (
              <View key={section.title} className={`mx-5 py-3 ${index > 0 ? 'border-t border-outline/15' : ''}`}>
                <Kicker>{section.title}</Kicker>
                <View className="mt-3 flex-row" style={{ marginHorizontal: -SHEET_PADDING / 2 }}>
                  {section.options.map(({ key, label, Icon, action, testID }) => (
                    <Pressable key={key} testID={testID} onPress={() => run(action)} className="items-center" style={{ width: optionWidth }}>
                      <View className="h-14 w-14 items-center justify-center rounded-full border border-outline/15 bg-primary/10">
                        <Icon size={22} color={colors.primary} />
                      </View>
                      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} className="mt-1.5 text-[13px] font-medium text-on-surface">{label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
            <View className="border-t border-outline/15 pt-3" style={{ marginHorizontal: SHEET_PADDING }}>
              <Kicker>Fotos recientes</Kicker>
            </View>
            <View className="pt-3">
              {limitedBanner}
              {permissionPrompt}
              {canSeePhotos ? (
                assets.length === 0 ? (
                  <Text className="px-5 py-4 text-center text-[13px] text-on-surface-variant">{emptyText}</Text>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} testID="attach-tira-reciente" contentContainerStyle={{ gap: 8, paddingHorizontal: SHEET_PADDING }}>
                    {assets.slice(0, STRIP_COUNT).map((asset) => (
                      <MediaTile key={asset.id} asset={asset} side={STRIP_SIDE} rounded order={selected.indexOf(asset.id)} onPress={() => pickToggle(asset.id)} />
                    ))}
                    <Pressable testID="attach-ver-galeria" onPress={() => setAllPhotos(true)} className="items-center justify-center gap-1 rounded-xl border border-dashed border-primary/50" style={{ width: STRIP_SIDE, height: STRIP_SIDE }}>
                      <LayoutGrid size={20} color={colors.primary} />
                      <Text className="text-[11px] font-bold text-primary">Ver todas</Text>
                    </Pressable>
                  </ScrollView>
                )
              ) : null}
            </View>
          </ScrollView>
        )}
        {selected.length ? (
          <Pressable testID="attach-enviar" onPress={sendSelected} className="absolute bottom-0 right-4 h-14 flex-row items-center gap-2 rounded-full bg-primary px-5" style={{ marginBottom: margins.pie + 12 }}>
            <Send size={20} color={colors['on-primary']} />
            <Text className="text-[15px] font-semibold text-on-primary">Enviar {selected.length}</Text>
          </Pressable>
        ) : null}
      </View>
    </Modal>
  );
}

function Kicker({ children }: { children: ReactNode }) {
  return <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-primary">{children}</Text>;
}

/** A photo or video to pick: its order number when picked, the duration of a video. */
function MediaTile(props: { asset: Asset; side: number; order: number; rounded?: boolean; onPress: () => void }) {
  const { asset, side, order } = props;
  return (
    <Pressable testID={`attach-media-${asset.id}`} onPress={props.onPress} style={{ width: side, height: side }} className={props.rounded ? 'overflow-hidden rounded-xl' : ''}>
      <Image source={{ uri: asset.uri }} style={{ width: side, height: side, opacity: order >= 0 ? 0.75 : 1 }} contentFit="cover" recyclingKey={asset.id} />
      {asset.mediaType === 'video' ? <Text className="absolute bottom-1 left-1.5 text-[11px] font-semibold text-white" style={{ textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 }}>▶ {formatDuration(asset.duration)}</Text> : null}
      <View className={`absolute right-1.5 top-1.5 h-6 w-6 items-center justify-center rounded-full border-2 border-white ${order >= 0 ? 'bg-primary' : 'bg-black/20'}`}>
        {order >= 0 ? <Text className="text-[12px] font-bold text-white">{order + 1}</Text> : null}
      </View>
    </Pressable>
  );
}
