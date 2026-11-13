import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Cloud, CloudUpload, ExternalLink, Folder, Search } from 'lucide-react';
import { DRIVE_DOCUMENT_ACCEPT, DRIVE_VIDEO_SECONDS, OBSERVATION_VIDEO_SECONDS, filesOfKind, photoMarkOf, withPhotoMark, type DriveKind, type DriveLayout, type DriveUploadOption, type PhotoMark, driveFileLine, driveFolders, filesInFolder, searchServiceFiles, type ServiceFile, type SpaceClientService, type ViewableFile } from '@lilachat/shared';
import { FileThumb, usePortalFileViewer } from './PortalFileViewer';
import { cameraEnvironment } from '../../chat/camera/shotStamp';
import { openWebCamera, shootOrPick, type PickerHandle } from '../../chat/camera/cameraRequests';
import { useDriveUpload } from './useDriveUpload';
import { DriveGridWeb, DriveHeaderWeb, DriveKindChipsWeb, FolderCardsWeb } from './DriveParts';
import { PhotoPhaseBar } from './PhotoPhaseBar';
import { photoPhaseSender } from './workMap/workProgressSender';
import { useServiceAsk, type ServiceAskTarget } from './useServiceAsk';

const RECENT = 6;
const SEARCH_MIN = 2;
const LIST = 'divide-y divide-outline/10 overflow-hidden rounded-xl border border-outline/15 bg-surface';
const KICKER = 'text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant';

const viewableOf = (file: ServiceFile): ViewableFile => ({ url: file.url, name: file.name, mime: file.mime, ...(file.thumbUrl ? { thumbUrl: file.thumbUrl } : {}), ...(file.modifiedAt ? { when: file.modifiedAt } : {}) });
type OpenFile = (file: ServiceFile) => void;

/** José 30/10 night: with its thumbnail, and it opens in Lilachat's viewer, not in another tab. */
function FileRow({ file, onOpen }: { file: ServiceFile; onOpen: OpenFile }) {
  return (
    <button type="button" onClick={() => onOpen(file)} data-testid="archivo-drive" className="flex min-h-[56px] w-full items-center gap-3 px-3 py-2 text-left hover:bg-background">
      <FileThumb file={viewableOf(file)} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{file.name}</span>
        <span className="block text-[11px] text-on-surface-variant">{driveFileLine(file)}</span>
      </span>
    </button>
  );
}

function FolderRows(props: { files: readonly ServiceFile[]; layout: DriveLayout; onOpen: (folder: string) => void }) {
  const folders = driveFolders(props.files);
  if (!folders.length) return null;
  return (
    <section>
      <p className={`${KICKER} flex justify-between`}>Carpetas <span className="font-mono normal-case tracking-normal">{folders.length === 1 ? '1 carpeta' : `${folders.length} carpetas`}</span></p>
      {props.layout === 'grid' ? <FolderCardsWeb folders={folders} onOpen={props.onOpen} /> : (
        <div className={LIST}>
          {folders.map((one) => (
            <button key={one.name} type="button" data-testid={`carpeta-${one.name}`} onClick={() => props.onOpen(one.name)} className="flex min-h-[52px] w-full items-center gap-3 px-3 text-left hover:bg-background">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary"><Folder size={16} /></span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{one.name}</span>
              <span className="text-sm font-semibold tabular-nums text-on-surface-variant">{one.count}</span>
              <ChevronRight size={15} className="text-on-surface-variant" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/** The same files as rows or as tiles by day (designs drv-01, drv-02). */
function FileSet(props: { files: readonly ServiceFile[]; layout: DriveLayout; onOpen: OpenFile }) {
  if (props.layout === 'grid') return <DriveGridWeb files={props.files} onOpen={props.onOpen} />;
  return <div className={LIST}>{props.files.map((file) => <FileRow key={file.url} file={file} onOpen={props.onOpen} />)}</div>;
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
  if (!props.files.length) return <p className="py-6 text-center text-sm text-on-surface-variant">Este servicio todavía no tiene archivos.</p>;
  if (shown) return shown.length ? <FileSet files={shown} layout={props.layout} onOpen={props.onOpen} /> : <p className="p-4 text-sm text-on-surface-variant">{props.query.trim() ? `Nada coincide con «${props.query.trim()}».` : 'No hay archivos de este tipo.'}</p>;
  const recent = props.files.slice(0, RECENT);
  const rest = filesInFolder(props.files, null).filter((file) => !recent.includes(file));
  return (
    <>
      <FolderRows files={props.files} layout={props.layout} onOpen={props.onFolder} />
      <section>
        <p className={`${KICKER} mb-2`}>Recientes</p>
        <FileSet files={[...recent, ...rest]} layout={props.layout} onOpen={props.onOpen} />
      </section>
    </>
  );
}

function Breadcrumb(props: { folder: string; onRoot: () => void }) {
  return (
    <p className="flex items-center gap-1.5 text-sm">
      <button type="button" data-testid="volver-a-drive" onClick={props.onRoot} className="flex items-center gap-1 font-semibold text-primary"><ChevronLeft size={16} /> <Cloud size={15} /> Drive</button>
      <ChevronRight size={14} className="text-on-surface-variant" />
      <span className="truncate">{props.folder}</span>
    </p>
  );
}

const LAYOUT_KEY = 'lilachat.drive.vista';
function readLayout(): DriveLayout {
  try {
    return localStorage.getItem(LAYOUT_KEY) === 'grid' ? 'grid' : 'list';
  } catch {
    return 'list';
  }
}
function saveLayout(layout: DriveLayout): void {
  try {
    localStorage.setItem(LAYOUT_KEY, layout);
  } catch {
    // Blocked storage: the view holds until the tab closes.
  }
}

/**
 * The ways in behind «Subir» (José 06/11; documents, Jeremy 13/11; one button, José 13/11): the
 * live camera on a phone, the file pickers everywhere. The inputs stay hidden here.
 */
function useDriveUploads(upload: ReturnType<typeof useDriveUpload>) {
  const media = useRef<HTMLInputElement>(null);
  const documents = useRef<HTMLInputElement>(null);
  // Any device with a camera, a computer's webcam too (José 13/11, design drv-03 on desktop).
  const camera = cameraEnvironment().media;
  const shoot = (video: boolean) => void openWebCamera({ title: video ? 'Video al Drive' : 'Foto al Drive', video: { maxSeconds: DRIVE_VIDEO_SECONDS, first: video } }).then((file) => file && upload.send(file));
  const options: DriveUploadOption['id'][] = camera ? ['photo', 'video', 'gallery', 'document'] : ['gallery', 'document'];
  const pick = (option: DriveUploadOption['id']) => {
    if (option === 'photo' || option === 'video') return shoot(option === 'video');
    (option === 'gallery' ? media : documents).current?.click();
  };
  const sendFirst = (input: HTMLInputElement) => {
    const file = input.files?.[0];
    if (file) void upload.send(file);
    input.value = '';
  };
  const inputs = (
    <>
      <input ref={media} data-testid="archivo-para-drive" type="file" accept="image/*,video/*" hidden onChange={(event) => sendFirst(event.target)} />
      <input ref={documents} data-testid="documento-para-drive" type="file" accept={DRIVE_DOCUMENT_ACCEPT} hidden onChange={(event) => sendFirst(event.target)} />
    </>
  );
  return { options, pick, inputs };
}

/** On a computer a file dropped on the Drive goes up too (design drv-03, «Suelta aquí»). */
function useDropZone(onFile: (file: File) => void) {
  const [over, setOver] = useState(false);
  const handlers = {
    onDragOver: (event: React.DragEvent) => {
      if (!event.dataTransfer.types.includes('Files')) return;
      event.preventDefault();
      setOver(true);
    },
    onDragLeave: (event: React.DragEvent) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false);
    },
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      setOver(false);
      const file = event.dataTransfer.files[0];
      if (file) onFile(file);
    },
  };
  return { over, handlers };
}

const DropHint = () => (
  <div data-testid="drive-soltar" className="flex items-center gap-3 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 p-4 text-sm">
    <CloudUpload size={22} className="text-primary" />
    <span><b>Suelta aquí para subirlo al servicio</b><br /><span className="text-on-surface-variant">Fotos, videos o documentos PDF, Word, Excel o PowerPoint.</span></span>
  </div>
);

/**
 * The Drive of one service, a tab of its detail (José 06/11; design f-06):
 * search, top folders with counts, the newest files and, inside a folder, its
 * files. A failure says why, with the service's link.
 */
const NO_MARKS: readonly PhotoMark[] = [];
const NO_FILES: readonly ServiceFile[] = [];

/** The «Antes / Después» bar of a Drive photo, by its url: only a photo Portal sent with its id. */
function usePhotoPhases(props: { target: ServiceAskTarget; service: SpaceClientService; chatId: string; marks?: readonly PhotoMark[] }, files: readonly ServiceFile[]) {
  const [marks, setMarks] = useState<readonly PhotoMark[]>(props.marks ?? NO_MARKS);
  // The viewer keeps the function it was opened with: it reads the latest marks and files from here.
  const latest = useRef({ marks, files });
  latest.current = { marks, files };
  const send = photoPhaseSender(props.target, props.chatId, props.service.id);
  return useCallback((url: string) => {
    const file = latest.current.files.find((one) => one.url === url);
    if (!file?.id || !file.mime.startsWith('image/')) return null;
    const id = file.id;
    const mark = photoMarkOf(latest.current.marks, id);
    return <PhotoPhaseBar key={id} mark={mark} send={async (phase, stretch) => {
      const result = await send(id, phase, stretch);
      if (result.ok) setMarks((before) => withPhotoMark(before, id, phase, stretch));
      return result;
    }} />;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.target, props.chatId, props.service.id]);
}

export function ServiceDriveWeb(props: { target: ServiceAskTarget; service: SpaceClientService; chatId: string; /** Photos marked «antes» or «después» (Portal 08/11). */ marks?: readonly PhotoMark[] }) {
  const [round, setRound] = useState(0);
  const answer = useServiceAsk('files', props.target, props.service.id, round);
  const upload = useDriveUpload({ target: props.target, chatId: props.chatId, serviceId: props.service.id, onDone: () => setRound((current) => current + 1) });
  // Before the viewer: its bar has to read the marks of THIS render.
  const phaseOf = usePhotoPhases(props, answer?.ok ? answer.value.files : NO_FILES);
  const viewer = usePortalFileViewer();
  const [folder, setFolder] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<DriveKind>('all');
  const [layout, setLayout] = useState<DriveLayout>(readLayout);
  const uploads = useDriveUploads(upload);
  const drop = useDropZone((file) => void upload.send(file));
  const driveUrl = answer?.ok ? answer.value.driveUrl : (answer?.portalUrl ?? null);
  return (
    <div data-testid="drive-servicio" className="flex flex-col gap-3" {...drop.handlers}>
      <DriveHeaderWeb count={answer?.ok ? answer.value.files.length : null} layout={layout} onLayout={(next) => (saveLayout(next), setLayout(next))} options={uploads.options} sending={upload.sending} onPick={uploads.pick} />
      {uploads.inputs}
      {upload.message ? <p role="status" className={upload.failed ? 'text-sm text-error' : 'text-sm text-on-surface-variant'}>{upload.message}</p> : null}
      {drop.over ? <DropHint /> : null}
      {folder ? <Breadcrumb folder={folder} onRoot={() => setFolder(null)} /> : null}
      {answer === null ? <div data-testid="drive-cargando" className="h-32 animate-pulse rounded-xl bg-surface" /> : null}
      {answer && !answer.ok ? <p data-testid="drive-fallo" className="rounded-xl border border-outline/15 bg-surface p-4 text-sm font-semibold">{answer.message}</p> : null}
      {answer?.ok ? (
        <label className="flex h-10 items-center gap-2 rounded-xl border border-outline/15 bg-surface px-3">
          <Search size={15} className="text-on-surface-variant" />
          <input data-testid="buscar-drive" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en el Drive del servicio…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </label>
      ) : null}
      {answer?.ok && answer.value.files.length ? <DriveKindChipsWeb kind={kind} onKind={setKind} /> : null}
      {answer?.ok ? <DriveBody files={answer.value.files} query={query} folder={folder} kind={kind} layout={layout} onFolder={setFolder} onOpen={(file) => viewer.open(viewableOf(file), answer.value.files.map(viewableOf), undefined, undefined, phaseOf)} /> : null}
      {viewer.viewer}
      {driveUrl ? <a href={driveUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary"><ExternalLink size={14} /> {answer?.ok ? 'Abrir en Google Drive' : 'Abrir el servicio en el Portal'}</a> : null}
    </div>
  );
}

/** One field photo for the service's Drive (o-06 «Registrar avance»): Lilachat's camera on a phone, a file on a computer. */
export const DrivePhotoInput = forwardRef<PickerHandle, { testId: string; onFile: (file: File | undefined) => void }>(function DrivePhotoInput(props, ref) {
  return <EvidenceInput ref={ref} testId={props.testId} kind="photo" title="Foto de avance" onFile={props.onFile} />;
});

/**
 * A photo or a video of an observation (José 11/11): Lilachat's camera with its stamp on a phone (José 12/11),
 * a file on a computer. `fromLibrary` opens the photos already taken instead (the picture of Apple's «Medición»).
 */
export const EvidenceInput = forwardRef<PickerHandle, { testId: string; kind: 'photo' | 'video'; title?: string; fromLibrary?: boolean; onFile: (file: File | undefined) => void }>(function EvidenceInput(props, ref) {
  const input = useRef<HTMLInputElement>(null);
  const ask = { title: props.title ?? (props.kind === 'video' ? 'Video de la observación' : 'Foto de la observación'), ...(props.kind === 'video' ? { video: { maxSeconds: OBSERVATION_VIDEO_SECONDS, first: true } } : {}) };
  useImperativeHandle(ref, () => ({ click: () => shootOrPick(ask, { gallery: props.fromLibrary }, () => input.current?.click(), props.onFile) }));
  return <input ref={input} data-testid={props.testId} type="file" accept={props.kind === 'video' ? 'video/*' : 'image/*'} {...(props.fromLibrary ? {} : { capture: 'environment' as const })} hidden onChange={(event) => { props.onFile(event.target.files?.[0]); event.target.value = ''; }} />;
});

/** A KMZ or KML for «Importar» of the map (o-12). */
export const DriveTraceInput = forwardRef<HTMLInputElement, { testId: string; onFile: (file: File | undefined) => void }>(function DriveTraceInput(props, ref) {
  return <input ref={ref} data-testid={props.testId} type="file" accept=".kmz,.kml,application/vnd.google-earth.kmz,application/vnd.google-earth.kml+xml" hidden onChange={(event) => { props.onFile(event.target.files?.[0]); event.target.value = ''; }} />;
});
