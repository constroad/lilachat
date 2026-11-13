import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight, FileSpreadsheet, FileText, Folder, Play } from 'lucide-react-native';
import { driveDayGroups, driveKindOf, type ServiceFile } from '@lilachat/shared';
import { useColores } from '../../ui/tema';

const GAP = 10;
const WIDE = 600;
const WIDER = 900;
const columnsFor = (width: number) => (width >= WIDER ? 5 : width >= WIDE ? 3 : 2);
const extensionOf = (name: string) => (name.includes('.') ? name.split('.').pop()!.toUpperCase().slice(0, 4) : 'DOC');

/** Grids measure their own width: in landscape or beside a rail the window lies. */
function useColumns() {
  const [width, setWidth] = useState(0);
  const columns = columnsFor(width);
  return { columns, tile: width ? (width - GAP * (columns - 1)) / columns : 0, onLayout: (event: { nativeEvent: { layout: { width: number } } }) => setWidth(event.nativeEvent.layout.width) };
}

function Tile(props: { file: ServiceFile; size: number; onOpen: (file: ServiceFile) => void }) {
  const colors = useColores();
  const kind = driveKindOf(props.file.mime);
  const preview = kind === 'photo' ? (props.file.thumbUrl ?? props.file.url) : props.file.thumbUrl;
  const sheet = /sheet|excel/.test(props.file.mime);
  const Icon = sheet ? FileSpreadsheet : FileText;
  return (
    <Pressable testID="archivo-drive" onPress={() => props.onOpen(props.file)} style={{ width: props.size }} className="overflow-hidden rounded-xl border border-outline/15 bg-surface">
      {preview ? (
        <View style={{ width: props.size, height: props.size }} className="bg-background">
          <Image recyclingKey={preview} source={{ uri: preview }} style={{ width: props.size, height: props.size }} contentFit="cover" />
          {kind === 'video' ? <View className="absolute inset-0 items-center justify-center bg-black/20"><Play size={26} color="white" fill="white" /></View> : null}
          {kind === 'document' ? <Text testID="drive-etiqueta-documento" className={`absolute bottom-2 left-2 rounded-md px-1.5 py-0.5 text-[11px] font-bold text-white ${sheet ? 'bg-secondary' : 'bg-error'}`}>{extensionOf(props.file.name)}</Text> : null}
        </View>
      ) : (
        <View style={{ width: props.size, height: props.size }} className={`items-center justify-center gap-2 ${sheet ? 'bg-secondary/10' : 'bg-error/10'}`}>
          {kind === 'video' ? <Play size={30} color={colors.primary} /> : <Icon size={34} color={sheet ? colors.secondary : colors.error} />}
          <Text className={`text-[11px] font-bold ${sheet ? 'text-secondary' : 'text-error'}`}>{extensionOf(props.file.name)}</Text>
        </View>
      )}
      <Text className="px-2 pt-1.5 text-[13px] font-semibold text-on-surface" numberOfLines={1}>{props.file.name}</Text>
    </Pressable>
  );
}

/** Design drv-02: the files as tiles, by day in Lima («Hoy · 13 nov»). */
export function DriveGrid(props: { files: readonly ServiceFile[]; onOpen: (file: ServiceFile) => void }) {
  const grid = useColumns();
  const groups = driveDayGroups(props.files, new Date());
  return (
    <View testID="drive-cuadricula" onLayout={grid.onLayout} className="gap-3">
      {grid.tile ? groups.map((group) => (
        <View key={group.key} className="gap-2">
          <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-primary">{group.label}</Text>
          <View className="flex-row flex-wrap" style={{ gap: GAP }}>
            {group.files.map((file) => <Tile key={file.url} file={file} size={grid.tile} onOpen={props.onOpen} />)}
          </View>
        </View>
      )) : null}
    </View>
  );
}

/** The folders as cards, two per row (design drv-02). */
export function FolderCards(props: { folders: readonly { name: string; count: number }[]; onOpen: (folder: string) => void }) {
  const colors = useColores();
  const grid = useColumns();
  return (
    <View onLayout={grid.onLayout} className="flex-row flex-wrap" style={{ gap: GAP }}>
      {grid.tile ? props.folders.map((one) => (
        <Pressable key={one.name} testID={`carpeta-${one.name}`} onPress={() => props.onOpen(one.name)} style={{ width: grid.tile }} className="min-h-[64px] flex-row items-center gap-2 rounded-xl border border-outline/15 bg-surface px-3">
          <View className="h-9 w-9 items-center justify-center rounded-lg bg-primary/10"><Folder size={18} color={colors.primary} /></View>
          <Text className="min-w-0 flex-1 text-[14px] font-semibold text-on-surface" numberOfLines={2}>{one.name}</Text>
          <Text className="text-[13px] font-semibold text-on-surface-variant">{one.count}</Text>
          <ChevronRight size={14} color={colors['on-surface-variant']} />
        </Pressable>
      )) : null}
    </View>
  );
}
