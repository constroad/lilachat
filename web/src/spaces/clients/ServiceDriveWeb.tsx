import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Cloud, ExternalLink, FileText, Folder, Image as ImageIcon, Search } from 'lucide-react';
import { driveFolders, filesInFolder, searchServiceFiles, type ServiceFile } from '@lilachat/shared';
import { api } from '../../api';
import { Overlay } from '../../ui/Overlay';

const RECENT = 3;
const BYTES_PER_MB = 1_048_576;
type Loaded = { state: 'loading' } | { state: 'ready'; files: ServiceFile[]; driveUrl: string | null } | { state: 'failed'; message: string; driveUrl: string | null };

/** Asked when the Drive opens, never stored (pending 121): agentes asks Portal for the service's files. */
function useServiceFiles(jwt: string, spaceId: string, clientId: string, serviceId: string): Loaded {
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    void api<{ files?: ServiceFile[]; drive_url?: string | null; message?: string }>(`/workspaces/${spaceId}/clients/${encodeURIComponent(clientId)}/services/${encodeURIComponent(serviceId)}/files`, { jwt, signal: controller.signal }).then((response) => {
      if (controller.signal.aborted) return;
      if (response.ok && response.data.files) setLoaded({ state: 'ready', files: response.data.files, driveUrl: response.data.drive_url ?? null });
      else setLoaded({ state: 'failed', message: response.ok ? (response.data.message ?? 'No se pudo traer el Drive') : 'No se pudo traer el Drive', driveUrl: response.ok ? (response.data.drive_url ?? null) : null });
    });
    return () => controller.abort();
  }, [jwt, spaceId, clientId, serviceId]);
  return loaded;
}

const sizeLabel = (bytes?: number) => (bytes === undefined ? '' : `${(bytes / BYTES_PER_MB).toFixed(1)} MB`);
const dayLabel = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }) : '');

function FileRow({ file }: { file: ServiceFile }) {
  const Icon = file.mime.startsWith('image/') ? ImageIcon : FileText;
  return (
    <a href={file.url} target="_blank" rel="noreferrer" data-testid="archivo-drive" className="flex min-h-[48px] items-center gap-3 px-3 py-2 hover:bg-background">
      <Icon size={18} className="shrink-0 text-primary" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{file.name}</span>
        <span className="block text-[11px] text-on-surface-variant">{[file.folder, sizeLabel(file.sizeBytes), dayLabel(file.modifiedAt)].filter(Boolean).join(' · ')}</span>
      </span>
    </a>
  );
}

/**
 * «Drive» of one service (pending 121, design f-06): breadcrumb, search, the
 * top folders with their counts, the newest files and, inside a folder, its
 * files. A failure says «No se pudo traer el Drive» with the service's link.
 */
export function ServiceDriveWeb(props: { jwt: string; spaceId: string; clientId: string; service: { id: string; name: string }; onClose: () => void }) {
  const loaded = useServiceFiles(props.jwt, props.spaceId, props.clientId, props.service.id);
  const [folder, setFolder] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const files = loaded.state === 'ready' ? loaded.files : [];
  const found = useMemo(() => searchServiceFiles(files, query), [files, query]);
  const searching = query.trim().length >= 2;
  const folders = driveFolders(files);
  return (
    <Overlay title="Drive del servicio" onClose={props.onClose} wide>
      <div data-testid="drive-servicio" className="flex flex-col gap-3">
        <p className="flex items-center gap-1.5 text-sm">
          <button type="button" onClick={() => setFolder(null)} className="flex items-center gap-1 font-semibold text-primary"><Cloud size={15} /> Drive</button>
          <ChevronRight size={14} className="text-on-surface-variant" />
          <span className="truncate">{props.service.name}</span>
          {folder ? <><ChevronRight size={14} className="text-on-surface-variant" /><span className="truncate">{folder}</span></> : null}
        </p>
        {loaded.state === 'loading' ? <div data-testid="drive-cargando" className="h-32 animate-pulse rounded-xl bg-background" /> : null}
        {loaded.state === 'failed' ? (
          <div data-testid="drive-fallo" className="rounded-xl border border-outline/15 p-4 text-sm">
            <p className="font-semibold">{loaded.message}</p>
            {loaded.driveUrl ? <a href={loaded.driveUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 font-semibold text-primary"><ExternalLink size={14} /> Abrir el servicio en el Portal</a> : null}
          </div>
        ) : null}
        {loaded.state === 'ready' ? (
          <>
            <label className="flex h-10 items-center gap-2 rounded-xl border border-outline/15 px-3">
              <Search size={15} className="text-on-surface-variant" />
              <input data-testid="buscar-drive" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en el Drive del servicio…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </label>
            {files.length === 0 ? <p className="py-6 text-center text-sm text-on-surface-variant">Este servicio todavía no tiene archivos.</p> : null}
            {searching ? (
              <div className="divide-y divide-outline/10 rounded-xl border border-outline/15">{found.length ? found.map((file) => <FileRow key={file.url} file={file} />) : <p className="p-4 text-sm text-on-surface-variant">{`Nada coincide con «${query.trim()}».`}</p>}</div>
            ) : folder ? (
              <div className="divide-y divide-outline/10 rounded-xl border border-outline/15">{filesInFolder(files, folder).map((file) => <FileRow key={file.url} file={file} />)}</div>
            ) : (
              <>
                {folders.length ? (
                  <section>
                    <p className="mb-2 flex justify-between text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Carpetas principales <span className="font-mono normal-case tracking-normal">{folders.length === 1 ? '1 carpeta' : `${folders.length} carpetas`}</span></p>
                    <div className="divide-y divide-outline/10 rounded-xl border border-outline/15">
                      {folders.map((one) => (
                        <button key={one.name} type="button" data-testid={`carpeta-${one.name}`} onClick={() => setFolder(one.name)} className="flex min-h-[52px] w-full items-center gap-3 px-3 text-left hover:bg-background">
                          <Folder size={18} className="text-primary" />
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{one.name}</span>
                          <span className="text-sm font-semibold tabular-nums text-on-surface-variant">{one.count}</span>
                          <ChevronRight size={15} className="text-on-surface-variant" />
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}
                {files.length ? (
                  <section>
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Recientes</p>
                    <div className="divide-y divide-outline/10 rounded-xl border border-outline/15">{files.slice(0, RECENT).map((file) => <FileRow key={file.url} file={file} />)}</div>
                  </section>
                ) : null}
                {filesInFolder(files, null).length ? <div className="divide-y divide-outline/10 rounded-xl border border-outline/15">{filesInFolder(files, null).map((file) => <FileRow key={file.url} file={file} />)}</div> : null}
              </>
            )}
            {loaded.driveUrl ? <a href={loaded.driveUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary"><ExternalLink size={14} /> Abrir en Google Drive</a> : null}
          </>
        ) : null}
      </div>
    </Overlay>
  );
}
