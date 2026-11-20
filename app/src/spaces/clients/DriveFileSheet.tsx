import { Linking, Pressable, Text, View } from 'react-native';
import { ArrowLeftRight, Copy, Download, Expand, Link2, X } from 'lucide-react-native';
import { DRIVE_COPY_FAILED, DRIVE_FILE_COPIED, DRIVE_LINK_COPIED, driveFileActions, driveFileLine, type DriveFileActionId, type ServiceFile } from '@lilachat/shared';
import { Sheet } from '../../ui/Sheet';
import { useColores } from '../../ui/tema';
import { FileThumb } from './FileThumb';
import { copyFileLink, copyImageFile } from './drivePaste';

const ICONS: Record<DriveFileActionId, typeof Copy> = { open: Expand, copy_link: Link2, copy_file: Copy, download: Download, phase: ArrowLeftRight };

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

/**
 * The sheet of one Drive file (José 19/11, design cc-05 mobile): opened with a long press or its
 * menu button. Open, copy the link, copy the photo itself, download and, for a photo, the
 * before/after mark, which opens the viewer where that bar lives. No moving to a folder: Portal
 * has no tool for it.
 */
export function DriveFileSheet(props: { file: ServiceFile | null; onClose: () => void; onOpen: (file: ServiceFile) => void; onNotice: (text: string) => void }) {
  const colors = useColores();
  const { file } = props;
  const run = (id: DriveFileActionId) => {
    if (!file) return;
    props.onClose();
    if (id === 'open' || id === 'phase') return props.onOpen(file);
    if (id === 'download') return void Linking.openURL(file.url);
    void runCopy(id, file).then(props.onNotice);
  };
  return (
    <Sheet visible={Boolean(file)} onClose={props.onClose} testID="hoja-archivo-drive" className="px-4">
      {file ? (
        <>
          <View className="flex-row items-center gap-3 pb-3 pt-1">
            <FileThumb file={{ url: file.url, name: file.name, mime: file.mime, ...(file.thumbUrl ? { thumbUrl: file.thumbUrl } : {}) }} />
            <View className="min-w-0 flex-1">
              <Text className="text-[16px] font-bold text-on-surface" numberOfLines={1}>{file.name}</Text>
              <Text className="text-[13px] text-on-surface-variant" numberOfLines={1}>{driveFileLine(file)}</Text>
            </View>
            <Pressable testID="archivo-drive-cerrar" accessibilityLabel="Cerrar" onPress={props.onClose} className="h-11 w-11 items-center justify-center rounded-full border border-outline/15">
              <X size={18} color={colors['on-surface']} />
            </Pressable>
          </View>
          {driveFileActions(file, { copiesFiles: true }).map((action) => {
            const Icon = ICONS[action.id];
            return (
              <Pressable key={action.id} testID={`archivo-drive-${action.id}`} accessibilityRole="button" onPress={() => run(action.id)} className="min-h-[52px] flex-row items-center gap-4 border-t border-outline/10 px-1">
                <Icon size={20} color={colors.primary} />
                <Text className="text-[16px] text-on-surface">{action.label}</Text>
              </Pressable>
            );
          })}
        </>
      ) : null}
    </Sheet>
  );
}
