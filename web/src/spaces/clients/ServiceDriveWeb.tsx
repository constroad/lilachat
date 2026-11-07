import { forwardRef, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Cloud, ExternalLink, Folder, Search, Upload } from 'lucide-react';
import { DRIVE_UPLOADING, driveFileLine, driveFolders, filesInFolder, searchServiceFiles, type ServiceFile, type SpaceClientService, type ViewableFile } from '@lilachat/shared';
import { FileThumb, usePortalFileViewer } from './PortalFileViewer';
import { useDriveUpload } from './useDriveUpload';
import { useServiceAsk, type ServiceAskTarget } from './useServiceAsk';

const RECENT = 3;
const SEARCH_MIN = 2;
const LIST = 'divide-y divide-outline/10 overflow-hidden rounded-xl border border-outline/15 bg-surface';
const KICKER = 'mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant';

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

function FolderRows(props: { files: readonly ServiceFile[]; onOpen: (folder: string) => void }) {
  const folders = driveFolders(props.files);
  if (!folders.length) return null;
  return (
    <section>
      <p className={`${KICKER} flex justify-between`}>Carpetas principales <span className="font-mono normal-case tracking-normal">{folders.length === 1 ? '1 carpeta' : `${folders.length} carpetas`}</span></p>
      <div className={LIST}>
        {folders.map((one) => (
          <button key={one.name} type="button" data-testid={`carpeta-${one.name}`} onClick={() => props.onOpen(one.name)} className="flex min-h-[52px] w-full items-center gap-3 px-3 text-left hover:bg-background">
            <Folder size={18} className="text-primary" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{one.name}</span>
            <span className="text-sm font-semibold tabular-nums text-on-surface-variant">{one.count}</span>
            <ChevronRight size={15} className="text-on-surface-variant" />
          </button>
        ))}
      </div>
    </section>
  );
}

/** Search results, one folder, or the root: top folders, the newest and the loose files. */
function DriveBody(props: { files: ServiceFile[]; query: string; folder: string | null; onFolder: (folder: string) => void; onOpen: OpenFile }) {
  const found = useMemo(() => searchServiceFiles(props.files, props.query), [props.files, props.query]);
  if (!props.files.length) return <p className="py-6 text-center text-sm text-on-surface-variant">Este servicio todavía no tiene archivos.</p>;
  if (props.query.trim().length >= SEARCH_MIN) return <div className={LIST}>{found.length ? found.map((file) => <FileRow key={file.url} file={file} onOpen={props.onOpen} />) : <p className="p-4 text-sm text-on-surface-variant">{`Nada coincide con «${props.query.trim()}».`}</p>}</div>;
  if (props.folder) return <div className={LIST}>{filesInFolder(props.files, props.folder).map((file) => <FileRow key={file.url} file={file} onOpen={props.onOpen} />)}</div>;
  const loose = filesInFolder(props.files, null);
  return (
    <>
      <FolderRows files={props.files} onOpen={props.onFolder} />
      <section>
        <p className={KICKER}>Recientes</p>
        <div className={LIST}>{props.files.slice(0, RECENT).map((file) => <FileRow key={file.url} file={file} onOpen={props.onOpen} />)}</div>
      </section>
      {loose.length ? <div className={LIST}>{loose.map((file) => <FileRow key={file.url} file={file} onOpen={props.onOpen} />)}</div> : null}
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

/** José 06/11: photos and videos go to the Drive from here, never to a report. */
function DriveUploadBar({ upload }: { upload: ReturnType<typeof useDriveUpload> }) {
  const picker = useRef<HTMLInputElement>(null);
  const pick = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void upload.send(file);
    if (picker.current) picker.current.value = '';
  };
  return (
    <div className="flex flex-col gap-1.5">
      <button type="button" data-testid="subir-al-drive" disabled={upload.sending} onClick={() => picker.current?.click()} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-outline/15 bg-surface px-4 text-sm font-semibold text-primary disabled:opacity-60">
        <Upload size={16} /> {upload.sending ? DRIVE_UPLOADING : 'Subir foto o video'}
      </button>
      <input ref={picker} data-testid="archivo-para-drive" type="file" accept="image/*,video/*" hidden onChange={(event) => pick(event.target.files)} />
      {upload.message ? <p role="status" className={upload.failed ? 'text-sm text-error' : 'text-sm text-on-surface-variant'}>{upload.message}</p> : null}
    </div>
  );
}

/**
 * The Drive of one service, a tab of its detail (José 06/11; design f-06):
 * search, top folders with counts, the newest files and, inside a folder, its
 * files. A failure says why, with the service's link.
 */
export function ServiceDriveWeb(props: { target: ServiceAskTarget; service: SpaceClientService; chatId: string }) {
  const [round, setRound] = useState(0);
  const answer = useServiceAsk('files', props.target, props.service.id, round);
  const upload = useDriveUpload({ target: props.target, chatId: props.chatId, serviceId: props.service.id, onDone: () => setRound((current) => current + 1) });
  const viewer = usePortalFileViewer();
  const [folder, setFolder] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const driveUrl = answer?.ok ? answer.value.driveUrl : (answer?.portalUrl ?? null);
  return (
    <div data-testid="drive-servicio" className="flex flex-col gap-3">
      {folder ? <Breadcrumb folder={folder} onRoot={() => setFolder(null)} /> : null}
      <DriveUploadBar upload={upload} />
      {answer === null ? <div data-testid="drive-cargando" className="h-32 animate-pulse rounded-xl bg-surface" /> : null}
      {answer && !answer.ok ? <p data-testid="drive-fallo" className="rounded-xl border border-outline/15 bg-surface p-4 text-sm font-semibold">{answer.message}</p> : null}
      {answer?.ok ? (
        <label className="flex h-10 items-center gap-2 rounded-xl border border-outline/15 bg-surface px-3">
          <Search size={15} className="text-on-surface-variant" />
          <input data-testid="buscar-drive" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en el Drive del servicio…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </label>
      ) : null}
      {answer?.ok ? <DriveBody files={answer.value.files} query={query} folder={folder} onFolder={setFolder} onOpen={(file) => viewer.open(viewableOf(file), answer.value.files.map(viewableOf))} /> : null}
      {viewer.viewer}
      {driveUrl ? <a href={driveUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary"><ExternalLink size={14} /> {answer?.ok ? 'Abrir en Google Drive' : 'Abrir el servicio en el Portal'}</a> : null}
    </div>
  );
}

/** One field photo for the service's Drive, from the camera or a file (o-06 «Registrar avance»): the camera's door. */
export const DrivePhotoInput = forwardRef<HTMLInputElement, { testId: string; onFile: (file: File | undefined) => void }>(function DrivePhotoInput(props, ref) {
  return <input ref={ref} data-testid={props.testId} type="file" accept="image/*" capture="environment" hidden onChange={(event) => { props.onFile(event.target.files?.[0]); event.target.value = ''; }} />;
});
