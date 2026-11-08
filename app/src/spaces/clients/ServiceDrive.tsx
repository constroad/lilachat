import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BackHandler, Linking, Pressable, Text, TextInput, View } from 'react-native';
import { Camera, ChevronLeft, ChevronRight, Cloud, ExternalLink, Folder, Image as ImageIcon, Search, Video } from 'lucide-react-native';
import { FileThumb } from './FileThumb';
import { photoMarkOf, withPhotoMark, type PhotoMark, driveFileLine, driveUploadingLine, driveFolders, filesInFolder, searchServiceFiles, type ServiceFile, type SpaceClientService } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import type { ViewableFile } from '@lilachat/shared';
import { useDriveUpload } from './useDriveUpload';
import { useFileViewer } from './useFileViewer';
import { PhotoPhaseBar } from './PhotoPhaseBar';
import { photoPhaseSender } from './workMap/workProgressSender';
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

function UploadButton(props: { testID: string; label: string; icon: ReactNode; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable testID={props.testID} accessibilityRole="button" accessibilityLabel={props.label} disabled={props.disabled} onPress={props.onPress} className="min-h-[52px] flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-outline/15 bg-surface px-2" style={{ opacity: props.disabled ? 0.6 : 1 }}>
      {props.icon}
      <Text className="text-[14px] font-semibold text-primary" numberOfLines={1}>{props.label}</Text>
    </Pressable>
  );
}

/** José 06/11: photos and videos go to the Drive from here, never to a report. */
function DriveUploadBar({ upload }: { upload: ReturnType<typeof useDriveUpload> }) {
  const colors = useColores();
  return (
    <View className="gap-1.5">
      <View className="flex-row gap-2">
        <UploadButton testID="drive-tomar-foto" label="Foto" icon={<Camera size={17} color={colors.primary} />} disabled={upload.sending} onPress={upload.takePhoto} />
        <UploadButton testID="drive-grabar-video" label="Video" icon={<Video size={17} color={colors.primary} />} disabled={upload.sending} onPress={upload.recordVideo} />
        <UploadButton testID="drive-galeria" label="Galería" icon={<ImageIcon size={17} color={colors.primary} />} disabled={upload.sending} onPress={upload.pickFromGallery} />
      </View>
      {upload.sending ? <Text testID="drive-subiendo" className="text-center text-[13px] text-on-surface-variant">{driveUploadingLine(upload.progress)}</Text> : null}
      {upload.message ? <Text testID="drive-aviso" className={upload.failed ? 'text-center text-[13px] text-error' : 'text-center text-[13px] text-on-surface-variant'}>{upload.message}</Text> : null}
    </View>
  );
}

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
      <DriveUploadBar upload={upload} />
      {answer === null ? <View testID="drive-cargando" className="h-40 rounded-2xl bg-surface-variant" /> : null}
      {answer && !answer.ok ? <Text testID="drive-fallo" className="rounded-xl border border-outline/15 bg-surface p-4 text-[15px] font-semibold text-on-surface">{answer.message}</Text> : null}
      {answer?.ok ? <DriveSearch query={query} onQuery={setQuery} /> : null}
      {answer?.ok ? <DriveBody files={answer.value.files} query={query} folder={folder} onFolder={setFolder} onOpen={(file) => viewer.open(viewableOf(file), answer.value.files.map(viewableOf), undefined, undefined, phaseOf)} /> : null}
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
