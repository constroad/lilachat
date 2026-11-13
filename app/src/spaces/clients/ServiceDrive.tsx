import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Linking, Pressable, Text, TextInput, View } from 'react-native';
import { ChevronLeft, ChevronRight, Cloud, ExternalLink, Folder, Search } from 'lucide-react-native';
import { FileThumb } from './FileThumb';
import { filesOfKind, photoMarkOf, withPhotoMark, type DriveKind, type DriveLayout, type PhotoMark, driveFileLine, driveUploadingLine, driveFolders, filesInFolder, searchServiceFiles, type ServiceFile, type SpaceClientService } from '@lilachat/shared';
import { DriveHeader, DriveKindChips } from './DriveHeader';
import { DriveGrid, FolderCards } from './DriveGrid';
import { DriveUploadSheet } from './DriveUploadSheet';
import { useColores } from '../../ui/tema';
import type { ViewableFile } from '@lilachat/shared';
import { useDriveUpload } from './useDriveUpload';
import { useFileViewer } from './useFileViewer';
import { PhotoPhaseBar } from './PhotoPhaseBar';
import { photoPhaseSender } from './workMap/workProgressSender';
import { useServiceAsk, type ServiceAskTarget } from './useServiceAsk';

type OpenFile = (file: ServiceFile) => void;
const viewableOf = (file: ServiceFile): ViewableFile => ({ url: file.url, name: file.name, mime: file.mime, ...(file.thumbUrl ? { thumbUrl: file.thumbUrl } : {}), when: driveFileLine(file) });

const RECENT = 6;
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

function FolderRows(props: { files: readonly ServiceFile[]; layout: DriveLayout; onOpen: (folder: string) => void }) {
  const colors = useColores();
  const folders = driveFolders(props.files);
  if (!folders.length) return null;
  return (
    <>
      <Kicker>Carpetas</Kicker>
      {props.layout === 'grid' ? <FolderCards folders={folders} onOpen={props.onOpen} /> : (
        <Group>
          {folders.map((one) => (
            <Pressable key={one.name} testID={`carpeta-${one.name}`} onPress={() => props.onOpen(one.name)} className="min-h-[56px] flex-row items-center gap-3 border-b border-outline/10 px-3">
              <View className="h-9 w-9 items-center justify-center rounded-lg bg-primary/10"><Folder size={18} color={colors.primary} /></View>
              <Text className="min-w-0 flex-1 text-[15px] font-semibold text-on-surface" numberOfLines={1}>{one.name}</Text>
              <Text className="text-[14px] font-semibold text-on-surface-variant">{one.count}</Text>
              <ChevronRight size={16} color={colors['on-surface-variant']} />
            </Pressable>
          ))}
        </Group>
      )}
    </>
  );
}

/** The same files as rows or as tiles by day (designs drv-01, drv-02). */
function FileSet(props: { files: readonly ServiceFile[]; layout: DriveLayout; onOpen: OpenFile }) {
  if (props.layout === 'grid') return <DriveGrid files={props.files} onOpen={props.onOpen} />;
  return <Group>{props.files.map((file) => <FileRow key={file.url} file={file} onOpen={props.onOpen} />)}</Group>;
}

type BodyProps = { files: ServiceFile[]; query: string; folder: string | null; kind: DriveKind; layout: DriveLayout; onFolder: (folder: string) => void; onOpen: OpenFile };

/** The files the search, the folder and the chip leave, or null at the root with «Todo». */
function narrowed(props: BodyProps): ServiceFile[] | null {
  if (props.query.trim().length >= SEARCH_MIN) return filesOfKind(searchServiceFiles(props.files, props.query), props.kind);
  if (props.folder) return filesOfKind(filesInFolder(props.files, props.folder), props.kind);
  return props.kind === 'all' ? null : filesOfKind(props.files, props.kind);
}

/** Search results, one folder, one kind, or the root: folders, the newest and the loose files. */
function DriveBody(props: BodyProps) {
  const shown = narrowed(props);
  if (!props.files.length) return <Text className="py-6 text-center text-[14px] text-on-surface-variant">Este servicio todavía no tiene archivos.</Text>;
  if (shown) return shown.length ? <FileSet files={shown} layout={props.layout} onOpen={props.onOpen} /> : <Text className="p-4 text-[14px] text-on-surface-variant">{props.query.trim() ? `Nada coincide con «${props.query.trim()}».` : 'No hay archivos de este tipo.'}</Text>;
  const recent = props.files.slice(0, RECENT);
  const rest = filesInFolder(props.files, null).filter((file) => !recent.includes(file));
  return (
    <>
      <FolderRows files={props.files} layout={props.layout} onOpen={props.onFolder} />
      <Kicker>Recientes</Kicker>
      <FileSet files={[...recent, ...rest]} layout={props.layout} onOpen={props.onOpen} />
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

function Breadcrumb(props: { folder: string; onRoot: () => void }) {
  const colors = useColores();
  return (
    <View className="flex-row items-center gap-1.5">
      <Pressable testID="volver-a-drive" onPress={props.onRoot} className="min-h-[40px] flex-row items-center gap-1">
        <ChevronLeft size={18} color={colors.primary} />
        <Cloud size={15} color={colors.primary} />
        <Text className="text-[14px] font-semibold text-primary">Drive</Text>
      </Pressable>
      <ChevronRight size={14} color={colors['on-surface-variant']} />
      <Text className="min-w-0 flex-shrink text-[14px] text-on-surface" numberOfLines={1}>{props.folder}</Text>
    </View>
  );
}

/** What happens after «Subir»: the progress and the answer, under the header. */
function UploadStatus({ upload }: { upload: ReturnType<typeof useDriveUpload> }) {
  if (upload.sending) return <Text testID="drive-subiendo" className="text-center text-[13px] text-on-surface-variant">{driveUploadingLine(upload.progress)}</Text>;
  if (!upload.message) return null;
  return <Text testID="drive-aviso" className={upload.failed ? 'text-center text-[13px] text-error' : 'text-center text-[13px] text-on-surface-variant'}>{upload.message}</Text>;
}

/** The list or the grid stays as it was left while the app is open. */
let lastLayout: DriveLayout = 'list';

const UPLOADS = {
  photo: (upload: ReturnType<typeof useDriveUpload>) => upload.takePhoto(),
  video: (upload: ReturnType<typeof useDriveUpload>) => upload.recordVideo(),
  gallery: (upload: ReturnType<typeof useDriveUpload>) => upload.pickFromGallery(),
  document: (upload: ReturnType<typeof useDriveUpload>) => upload.pickDocument(),
} as const;

/**
 * The Drive of one service, a tab of its detail (José 06/11; design f-06):
 * search, top folders with counts, the newest files and, inside a folder, its
 * files. A failure says why, with the service's link. BACK leaves the folder,
 * then the service.
 */
const NO_MARKS: readonly PhotoMark[] = [];
const NO_FILES: readonly ServiceFile[] = [];

/** The «Antes / Después» bar of a Drive photo, by its url: only a photo Portal sent with its id. */
function usePhotoPhases(props: { target: ServiceAskTarget; service: SpaceClientService; chatId: string; marks?: readonly PhotoMark[] }, files: readonly ServiceFile[]) {
  const [marks, setMarks] = useState<readonly PhotoMark[]>(props.marks ?? NO_MARKS);
  // The viewer keeps the function it was opened with: it reads the latest marks and files from here.
  const latest = useRef({ marks, files });
  latest.current = { marks, files };
  const { target, chatId } = props;
  const serviceId = props.service.id;
  return useCallback((url: string) => {
    const file = latest.current.files.find((one) => one.url === url);
    if (!file?.id || !file.mime.startsWith('image/')) return null;
    const id = file.id;
    const mark = photoMarkOf(latest.current.marks, id);
    const send = photoPhaseSender(target, chatId, serviceId);
    return <PhotoPhaseBar key={id} mark={mark} send={async (phase, stretch) => {
      const result = await send(id, phase, stretch);
      if (result.ok) setMarks((before) => withPhotoMark(before, id, phase, stretch));
      return result;
    }} />;
  }, [target, chatId, serviceId]);
}

export function ServiceDrive(props: { target: ServiceAskTarget; service: SpaceClientService; chatId: string; onBack: () => void; /** Photos marked «antes» or «después» (Portal 08/11). */ marks?: readonly PhotoMark[] }) {
  const colors = useColores();
  const [round, setRound] = useState(0);
  const answer = useServiceAsk('files', props.target, props.service.id, round);
  const upload = useDriveUpload({ target: props.target, chatId: props.chatId, serviceId: props.service.id, onDone: () => setRound((current) => current + 1) });
  // Before the viewer: its bar has to read the marks of THIS render.
  const phaseOf = usePhotoPhases(props, answer?.ok ? answer.value.files : NO_FILES);
  const viewer = useFileViewer();
  const [folder, setFolder] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<DriveKind>('all');
  const [layout, setLayoutState] = useState<DriveLayout>(lastLayout);
  const [choosing, setChoosing] = useState(false);
  const setLayout = (next: DriveLayout) => {
    lastLayout = next;
    setLayoutState(next);
  };
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
      {folder ? <Breadcrumb folder={folder} onRoot={() => setFolder(null)} /> : null}
      <DriveHeader count={answer?.ok ? answer.value.files.length : null} layout={layout} onLayout={setLayout} sending={upload.sending} onUpload={() => setChoosing(true)} onCamera={upload.takePhoto} />
      <UploadStatus upload={upload} />
      <DriveUploadSheet visible={choosing} onClose={() => setChoosing(false)} onPick={(option) => UPLOADS[option](upload)} />
      {answer === null ? <View testID="drive-cargando" className="h-40 rounded-2xl bg-surface-variant" /> : null}
      {answer && !answer.ok ? <Text testID="drive-fallo" className="rounded-xl border border-outline/15 bg-surface p-4 text-[15px] font-semibold text-on-surface">{answer.message}</Text> : null}
      {answer?.ok ? <DriveSearch query={query} onQuery={setQuery} /> : null}
      {answer?.ok && answer.value.files.length ? <DriveKindChips kind={kind} onKind={setKind} /> : null}
      {answer?.ok ? <DriveBody files={answer.value.files} query={query} folder={folder} kind={kind} layout={layout} onFolder={setFolder} onOpen={(file) => viewer.open(viewableOf(file), answer.value.files.map(viewableOf), undefined, undefined, phaseOf)} /> : null}
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
