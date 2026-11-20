import { Linking, Pressable, Share, Text, View } from 'react-native';
import { ArrowLeftRight, Copy, Download, Expand, Link2, Share2, X } from 'lucide-react-native';
import { DRIVE_COPY_FAILED, DRIVE_FILE_COPIED, DRIVE_LINK_COPIED, driveFileActions, driveSheetLine, type DriveFileActionId, type ServiceFile } from '@lilachat/shared';
import { Sheet } from '../../ui/Sheet';
import { useColores } from '../../ui/tema';
import { FileThumb } from './FileThumb';
import { copyFileLink, copyImageFile } from './drivePaste';

const ICONS: Record<DriveFileActionId, typeof Copy> = { open: Expand, copy_link: Link2, copy_file: Copy, share: Share2, phase: ArrowLeftRight, download: Download };

/** What a copy answered, said under the Drive's head. */
async function runCopy(id: 'copy_link' | 'copy_file', file: ServiceFile): Promise<string> {
  try {
    if (id === 'copy_link') await copyFileLink(file.url);
    else await copyImageFile(file.url, file.name);
    return id === 'copy_link' ? DRIVE_LINK_COPIED : DRIVE_FILE_COPIED;
  } catch (error) {
    console.warn('drive: copy failed', (error as Error).name);
    return DRIVE_COPY_FAILED;
  }
}

/** Android's share sheet with the file's link; closing it is no error. */
async function shareFile(file: ServiceFile): Promise<void> {
  try {
    await Share.share({ message: file.url, title: file.name });
  } catch (error) {
    console.warn('drive: share failed', (error as Error).name);
  }
}

/**
 * The sheet of one Drive or «Medios» file (José 19/11, design cc-05 mobile): opened with a long
 * press or its menu button. Its head has the thumbnail, the name, «fecha · carpeta · tamaño» and ✕.
 * Open, copy the link, copy the photo itself, share, the before/after mark (it opens the viewer
 * where that bar lives) and download. No moving to a folder: Portal has no tool for it.
 */
export function DriveFileSheet(props: { file: ServiceFile | null; onClose: () => void; onOpen: (file: ServiceFile) => void; onNotice: (text: string) => void; /** «Ver en el chat» in «Medios». */ openLabel?: string }) {
  const colors = useColores();
  const { file } = props;
  const run = (id: DriveFileActionId) => {
    if (!file) return;
    props.onClose();
    if (id === 'open' || id === 'phase') return props.onOpen(file);
    if (id === 'download') return void Linking.openURL(file.url);
    if (id === 'share') return void shareFile(file);
    void runCopy(id, file).then(props.onNotice);
  };
  return (
    <Sheet visible={Boolean(file)} onClose={props.onClose} testID="hoja-archivo-drive" className="px-4">
      {file ? (
        <>
          <View className="-mx-4 flex-row items-center gap-3 bg-background px-4 py-3">
            <FileThumb file={{ url: file.url, name: file.name, mime: file.mime, ...(file.thumbUrl ? { thumbUrl: file.thumbUrl } : {}) }} />
            <View className="min-w-0 flex-1">
              <Text className="text-[16px] font-bold text-on-surface" numberOfLines={1}>{file.name}</Text>
              <Text className="text-[13px] text-on-surface-variant" numberOfLines={1}>{driveSheetLine(file, new Date())}</Text>
            </View>
            <Pressable testID="archivo-drive-cerrar" accessibilityLabel="Cerrar" onPress={props.onClose} className="h-11 w-11 items-center justify-center rounded-full">
              <X size={18} color={colors['on-surface']} />
            </Pressable>
          </View>
          {driveFileActions(file, { copiesFiles: true, shares: true, ...(props.openLabel ? { openLabel: props.openLabel } : {}) }).map((action) => {
            const Icon = ICONS[action.id];
            const marked = action.id === 'phase';
            return (
              <Pressable key={action.id} testID={`archivo-drive-${action.id}`} accessibilityRole="button" onPress={() => run(action.id)} className={`-mx-4 min-h-[56px] flex-row items-center gap-4 px-5 py-2 ${marked ? 'bg-primary/5' : ''}`}>
                <Icon size={22} color={colors.primary} />
                <View className="min-w-0 flex-1">
                  <Text className={`text-[16px] ${marked ? 'font-bold text-primary' : 'text-on-surface'}`}>{action.label}</Text>
                  {action.hint ? <Text className="text-[13px] text-on-surface-variant">{action.hint}</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </>
      ) : null}
    </Sheet>
  );
}
