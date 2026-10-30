import { useEffect, useMemo, useState } from 'react';
import { BackHandler, Linking, Pressable, Text, TextInput, View } from 'react-native';
import { ChevronLeft, ChevronRight, Cloud, ExternalLink, Folder, Search } from 'lucide-react-native';
import { FileThumb } from './FileThumb';
import { driveFileLine, driveFolders, filesInFolder, searchServiceFiles, type ServiceFile, type SpaceClientService } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import type { ViewableFile } from '@lilachat/shared';
import { useFileViewer } from './useFileViewer';
import { useServiceAsk, type ServiceAskTarget } from './useServiceAsk';

type OpenFile = (file: ServiceFile) => void;
const viewableOf = (file: ServiceFile): ViewableFile => ({ url: file.url, name: file.name, mime: file.mime, ...(file.thumbUrl ? { thumbUrl: file.thumbUrl } : {}), when: driveFileLine(file) });

const RECENT = 3;
const SEARCH_MIN = 2;

const open = (url?: string | null) => {
  if (url) void Linking.openURL(url);
};

/** José 30/10 night: with its thumbnail, and it opens in Lilachat's viewer, not in the browser or Portal. */
function FileRow({ file, onOpen }: { file: ServiceFile; onOpen: OpenFile }) {
  return (
    <Pressable testID="archivo-drive" onPress={() => onOpen(file)} className="min-h-[60px] flex-row items-center gap-3 border-b border-outline/10 px-3 py-2">
      <FileThumb file={viewableOf(file)} />
      <View className="min-w-0 flex-1">
        <Text className="text-[14px] text-on-surface" numberOfLines={1}>{file.name}</Text>
        <Text className="text-[12px] text-on-surface-variant" numberOfLines={1}>{driveFileLine(file)}</Text>
      </View>
    </Pressable>
  );
}

const Group = ({ children }: { children: React.ReactNode }) => <View className="overflow-hidden rounded-xl border border-outline/15 bg-surface">{children}</View>;
const Kicker = ({ children }: { children: string }) => <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">{children}</Text>;

function FolderRows(props: { files: readonly ServiceFile[]; onOpen: (folder: string) => void }) {
  const colors = useColores();
  const folders = driveFolders(props.files);
  if (!folders.length) return null;
  return (
    <>
      <Kicker>Carpetas principales</Kicker>
      <Group>
        {folders.map((one) => (
          <Pressable key={one.name} testID={`carpeta-${one.name}`} onPress={() => props.onOpen(one.name)} className="min-h-[56px] flex-row items-center gap-3 border-b border-outline/10 px-3">
            <Folder size={20} color={colors.primary} />
            <Text className="min-w-0 flex-1 text-[15px] font-semibold text-on-surface" numberOfLines={1}>{one.name}</Text>
            <Text className="text-[14px] font-semibold text-on-surface-variant">{one.count}</Text>
            <ChevronRight size={16} color={colors['on-surface-variant']} />
          </Pressable>
        ))}
      </Group>
    </>
  );
}

/** Search results, one folder, or the root: top folders, the newest and the loose files. */
function DriveBody(props: { files: ServiceFile[]; query: string; folder: string | null; onFolder: (folder: string) => void; onOpen: OpenFile }) {
  const found = useMemo(() => searchServiceFiles(props.files, props.query), [props.files, props.query]);
  if (!props.files.length) return <Text className="py-6 text-center text-[14px] text-on-surface-variant">Este servicio todavía no tiene archivos.</Text>;
  if (props.query.trim().length >= SEARCH_MIN) return <Group>{found.length ? found.map((file) => <FileRow key={file.url} file={file} onOpen={props.onOpen} />) : <Text className="p-4 text-[14px] text-on-surface-variant">{`Nada coincide con «${props.query.trim()}».`}</Text>}</Group>;
  if (props.folder) return <Group>{filesInFolder(props.files, props.folder).map((file) => <FileRow key={file.url} file={file} onOpen={props.onOpen} />)}</Group>;
  const loose = filesInFolder(props.files, null);
  return (
    <>
      <FolderRows files={props.files} onOpen={props.onFolder} />
      <Kicker>Recientes</Kicker>
      <Group>{props.files.slice(0, RECENT).map((file) => <FileRow key={file.url} file={file} onOpen={props.onOpen} />)}</Group>
      {loose.length ? <Group>{loose.map((file) => <FileRow key={file.url} file={file} onOpen={props.onOpen} />)}</Group> : null}
    </>
  );
}

function DriveSearch(props: { query: string; onQuery: (query: string) => void }) {
  const colors = useColores();
  return (
    <View className="h-11 flex-row items-center gap-2 rounded-xl border border-outline/15 bg-surface px-3">
      <Search size={16} color={colors['on-surface-variant']} />
      <TextInput testID="buscar-drive" value={props.query} onChangeText={props.onQuery} placeholder="Buscar en el Drive del servicio…" placeholderTextColor={colors['on-surface-variant']} className="flex-1 text-[14px] text-on-surface" />
    </View>
  );
}

function Breadcrumb(props: { service: string; folder: string | null; onBack: () => void; onRoot: () => void }) {
  const colors = useColores();
  return (
    <View className="flex-row items-center gap-1.5">
      <Pressable testID="volver-a-drive" onPress={props.onBack} className="min-h-[40px] flex-row items-center gap-1">
        <ChevronLeft size={18} color={colors.primary} />
        <Cloud size={15} color={colors.primary} />
      </Pressable>
      <Pressable onPress={props.onRoot} className="min-w-0 flex-shrink"><Text className="text-[14px] font-semibold text-primary" numberOfLines={1}>{props.service}</Text></Pressable>
      {props.folder ? <ChevronRight size={14} color={colors['on-surface-variant']} /> : null}
      {props.folder ? <Text className="min-w-0 flex-shrink text-[14px] text-on-surface" numberOfLines={1}>{props.folder}</Text> : null}
    </View>
  );
}

/**
 * The Drive of one service inside «Archivos» (pending 121, design f-06):
 * search, top folders with counts, the newest files and, inside a folder, its
 * files. A failure says why, with the service's link. BACK leaves the folder,
 * then the service.
 */
export function ServiceDrive(props: { target: ServiceAskTarget; service: SpaceClientService; onBack: () => void }) {
  const colors = useColores();
  const answer = useServiceAsk('files', props.target, props.service.id);
  const viewer = useFileViewer();
  const [folder, setFolder] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const { onBack } = props;
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (folder) setFolder(null);
      else onBack();
      return true;
    });
    return () => subscription.remove();
  }, [folder, onBack]);
  const driveUrl = answer?.ok ? answer.value.driveUrl : (answer?.portalUrl ?? null);
  return (
    <View testID="drive-servicio" className="gap-3">
      <Breadcrumb service={props.service.name} folder={folder} onBack={onBack} onRoot={() => setFolder(null)} />
      {answer === null ? <View testID="drive-cargando" className="h-40 rounded-2xl bg-surface-variant" /> : null}
      {answer && !answer.ok ? <Text testID="drive-fallo" className="rounded-xl border border-outline/15 bg-surface p-4 text-[15px] font-semibold text-on-surface">{answer.message}</Text> : null}
      {answer?.ok ? <DriveSearch query={query} onQuery={setQuery} /> : null}
      {answer?.ok ? <DriveBody files={answer.value.files} query={query} folder={folder} onFolder={setFolder} onOpen={(file) => viewer.open(viewableOf(file), answer.value.files.map(viewableOf))} /> : null}
      {viewer.notice ? <Text className="text-center text-[13px] text-error">{viewer.notice}</Text> : null}
      {viewer.viewer}
      {driveUrl ? (
        <Pressable testID="abrir-drive-portal" onPress={() => open(driveUrl)} className="min-h-[44px] flex-row items-center gap-1.5">
          <ExternalLink size={15} color={colors.primary} />
          <Text className="text-[14px] font-semibold text-primary">{answer?.ok ? 'Abrir en Google Drive' : 'Abrir el servicio en el Portal'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
