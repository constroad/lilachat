import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { FileSpreadsheet, FileText, Folder, Image as ImageIcon, MoreVertical, Play } from 'lucide-react-native';
import { driveDayGroups, driveFilesLabel, driveKindOf, driveTileLine, driveTypeTag, type ServiceFile } from '@lilachat/shared';
import { useColores } from '../../ui/tema';

const GAP = 10;
const WIDE = 600;
const WIDER = 900;
const TILE_COLUMNS = { phone: 2, tablet: 3, computer: 5 } as const;
const FOLDER_COLUMNS = { phone: 2, tablet: 3, computer: 4 } as const;
type Columns = { phone: number; tablet: number; computer: number };
const columnsFor = (width: number, columns: Columns) => (width >= WIDER ? columns.computer : width >= WIDE ? columns.tablet : columns.phone);

/** Grids measure their own width: in landscape or beside a rail the window lies. */
function useColumns(per: Columns) {
  const [width, setWidth] = useState(0);
  const columns = columnsFor(width, per);
  return { columns, tile: width ? (width - GAP * (columns - 1)) / columns : 0, onLayout: (event: { nativeEvent: { layout: { width: number } } }) => setWidth(event.nativeEvent.layout.width) };
}

type Tone = 'secondary' | 'error' | 'primary';
const documentToneOf = (mime: string): Tone => (/sheet|excel/.test(mime) ? 'secondary' : /pdf/.test(mime) ? 'error' : 'primary');

/** The square of a tile: the thumbnail, or the file's icon on a plain field, with its type tag (design cc-05). */
function TilePreview(props: { file: ServiceFile; size: number }) {
  const colors = useColores();
  const kind = driveKindOf(props.file.mime);
  const preview = kind === 'photo' ? (props.file.thumbUrl ?? props.file.url) : props.file.thumbUrl;
  const tone = documentToneOf(props.file.mime);
  const Icon = tone === 'secondary' ? FileSpreadsheet : FileText;
  return (
    <View style={{ width: props.size, height: props.size }} className="items-center justify-center bg-background">
      {preview ? <Image recyclingKey={preview} source={{ uri: preview }} style={{ position: 'absolute', width: props.size, height: props.size }} contentFit="cover" /> : null}
      {!preview && kind === 'document' ? <Icon size={38} color={colors[tone]} /> : null}
      {!preview && kind === 'photo' ? <ImageIcon size={32} color={colors['on-surface-variant']} /> : null}
      {kind === 'video' ? <View className="h-12 w-12 items-center justify-center rounded-full bg-surface"><Play size={20} color={colors.primary} fill={colors.primary} /></View> : null}
      <Text testID="drive-etiqueta" className="absolute left-2 top-2 rounded-md bg-surface px-1.5 py-0.5 text-[10px] font-bold text-on-surface">{driveTypeTag(props.file)}</Text>
    </View>
  );
}

function Tile(props: { file: ServiceFile; size: number; now: Date; onOpen: (file: ServiceFile) => void; onMenu?: (file: ServiceFile) => void }) {
  const colors = useColores();
  return (
    <Pressable testID="archivo-drive" onPress={() => props.onOpen(props.file)} onLongPress={props.onMenu ? () => props.onMenu?.(props.file) : undefined} style={{ width: props.size }} className="overflow-hidden rounded-xl border border-outline/15 bg-surface">
      <TilePreview file={props.file} size={props.size} />
      <View className="flex-row items-center">
        <View className="min-w-0 flex-1 py-1.5 pl-2.5">
          <Text className="text-[13px] font-semibold text-on-surface" numberOfLines={1}>{props.file.name}</Text>
          <Text className="text-[11px] text-on-surface-variant" numberOfLines={1}>{driveTileLine(props.file, props.now)}</Text>
        </View>
        {props.onMenu ? (
          <Pressable testID="archivo-drive-mas" accessibilityLabel={`Opciones de ${props.file.name}`} onPress={() => props.onMenu?.(props.file)} className="h-10 w-9 items-center justify-center">
            <MoreVertical size={17} color={colors['on-surface-variant']} />
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Design cc-05: the files as a mosaic by day in Lima («HOY · 19 NOV»), «⋮» or a long press opens the file's sheet. */
export function DriveGrid(props: { files: readonly ServiceFile[]; onOpen: (file: ServiceFile) => void; onMenu?: (file: ServiceFile) => void }) {
  const grid = useColumns(TILE_COLUMNS);
  const now = new Date();
  const groups = driveDayGroups(props.files, now);
  return (
    <View testID="drive-cuadricula" onLayout={grid.onLayout} className="gap-4">
      {grid.tile ? groups.map((group) => (
        <View key={group.key} className="gap-2">
          <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">{group.label}</Text>
          <View className="flex-row flex-wrap" style={{ gap: GAP }}>
            {group.files.map((file) => <Tile key={file.url} file={file} size={grid.tile} now={now} onOpen={props.onOpen} onMenu={props.onMenu} />)}
          </View>
        </View>
      )) : null}
    </View>
  );
}

/** The folders as cards (design cc-05): icon tile, name and «41 archivos»; 2, 3 or 4 per row. */
export function FolderCards(props: { folders: readonly { name: string; count: number }[]; onOpen: (folder: string) => void }) {
  const colors = useColores();
  const grid = useColumns(FOLDER_COLUMNS);
  return (
    <View onLayout={grid.onLayout} className="flex-row flex-wrap" style={{ gap: GAP }}>
      {grid.tile ? props.folders.map((one) => (
        <Pressable key={one.name} testID={`carpeta-${one.name}`} onPress={() => props.onOpen(one.name)} style={{ width: grid.tile }} className="min-h-[64px] flex-row items-center gap-2.5 rounded-xl border border-outline/15 bg-surface px-3 py-2.5">
          <View className="h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Folder size={18} color={colors.primary} /></View>
          <View className="min-w-0 flex-1">
            <Text className="text-[14px] font-semibold text-on-surface" numberOfLines={1}>{one.name}</Text>
            <Text className="text-[12px] text-on-surface-variant" numberOfLines={1}>{driveFilesLabel(one.count)}</Text>
          </View>
        </Pressable>
      )) : null}
    </View>
  );
}
