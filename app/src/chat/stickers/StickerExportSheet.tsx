import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, ToastAndroid, View } from 'react-native';
import { Image } from 'expo-image';
import { Clapperboard, Image as ImageIcon, Info, type LucideIcon } from 'lucide-react-native';
import { stickerExportOf, type LibrarySticker } from '@lilachat/shared';
import { Sheet } from '../../ui/Sheet';
import { useColores } from '../../ui/tema';
import { saveStickerVideo, shareStickerPicture, shareStickerVideo, type ExportOutcome } from './stickerExport';

const PREVIEW = 140;
type Busy = 'save-video' | 'share-video' | 'share-picture' | null;

/**
 * «Exportar para WhatsApp» on the APK (José 27/11, design sa-05). WhatsApp takes no sound from other apps, so the sticker
 * goes as a video with its sound (in WhatsApp: Stickers › Crear › that video) and as its picture without sound.
 */
export function StickerExportSheet(props: { jwt: string; sticker: LibrarySticker | null; onClose: () => void }) {
  const colors = useColores();
  const { sticker } = props;
  const [busy, setBusy] = useState<Busy>(null);
  const [notice, setNotice] = useState('');
  const run = async (kind: Exclude<Busy, null>, action: () => Promise<ExportOutcome>, done?: string) => {
    setBusy(kind);
    setNotice('');
    const outcome = await action();
    setBusy(null);
    if (!outcome.ok) return setNotice(outcome.reason);
    if (done) ToastAndroid.show(done, ToastAndroid.SHORT);
  };
  const exportable = sticker ? stickerExportOf(sticker) : null;
  return (
    <Sheet visible={sticker !== null} onClose={props.onClose} testID="hoja-exportar-sticker" className="px-4">
      {sticker && exportable ? (
        <View className="gap-3 pb-2">
          <Text className="text-[20px] font-bold text-on-surface">Exportar para WhatsApp</Text>
          <View className="items-center">
            <View className="items-center justify-center rounded-3xl border border-outline/15 bg-background" style={{ width: PREVIEW, height: PREVIEW }}>
              <Image source={{ uri: sticker.url }} style={{ width: PREVIEW - 16, height: PREVIEW - 16 }} contentFit="contain" />
            </View>
          </View>
          {exportable.video ? (
            <ExportCard Icon={Clapperboard} title="Video con su sonido" hint="En WhatsApp: Stickers › Crear › elige este video. Ahí le dejas su sonido." primary>
              <ActionButton testID="exportar-guardar-video" label="Guardar en la galería" primary busy={busy === 'save-video'} disabled={busy !== null} onPress={() => void run('save-video', () => saveStickerVideo(props.jwt, sticker.id), 'Video guardado en la galería')} />
              <ActionButton testID="exportar-compartir-video" label="Compartir" busy={busy === 'share-video'} disabled={busy !== null} onPress={() => void run('share-video', () => shareStickerVideo(props.jwt, sticker.id))} />
            </ExportCard>
          ) : null}
          <ExportCard Icon={ImageIcon} title="Sticker sin sonido" hint={`Una imagen ${sticker.mime === 'image/png' ? 'PNG' : 'WebP'} de 512 × 512 para guardarla o pasarla.`}>
            <ActionButton testID="exportar-compartir-imagen" label="Compartir" busy={busy === 'share-picture'} disabled={busy !== null} onPress={() => void run('share-picture', () => shareStickerPicture(sticker))} />
          </ExportCard>
          {notice ? <Text testID="aviso-exportar-sticker" className="text-[13px] text-error">{notice}</Text> : null}
          <View className="flex-row gap-2 pt-1">
            <Info size={14} color={colors['on-surface-variant']} />
            <Text className="flex-1 text-[12px] leading-5 text-on-surface-variant">WhatsApp todavía no recibe stickers con sonido desde otras apps: el sonido se lo pones al crearlo allá.</Text>
          </View>
        </View>
      ) : null}
    </Sheet>
  );
}

function ExportCard(props: { Icon: LucideIcon; title: string; hint: string; primary?: boolean; children: React.ReactNode }) {
  const colors = useColores();
  return (
    <View className={`gap-2 rounded-2xl border p-3 ${props.primary ? 'border-primary/60' : 'border-outline/20'}`}>
      <View className="flex-row items-center gap-2">
        <props.Icon size={18} color={colors.primary} />
        <Text className="text-[16px] font-semibold text-on-surface">{props.title}</Text>
      </View>
      <Text className="text-[13px] leading-5 text-on-surface-variant">{props.hint}</Text>
      <View className="flex-row gap-2">{props.children}</View>
    </View>
  );
}

function ActionButton(props: { testID: string; label: string; primary?: boolean; busy: boolean; disabled: boolean; onPress: () => void }) {
  const colors = useColores();
  return (
    <Pressable testID={props.testID} accessibilityRole="button" disabled={props.disabled} onPress={props.onPress} className={`min-h-[48px] flex-1 items-center justify-center rounded-full ${props.primary ? 'bg-primary' : 'border border-outline/30'} ${props.disabled ? 'opacity-60' : ''}`}>
      {props.busy ? <ActivityIndicator color={props.primary ? colors['on-primary'] : colors.primary} /> : <Text className={`text-[14px] font-semibold ${props.primary ? 'text-on-primary' : 'text-on-surface'}`}>{props.label}</Text>}
    </Pressable>
  );
}
