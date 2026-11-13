import { useRef, useState } from 'react';
import { Camera, ChevronRight, FileSpreadsheet, FileText, Folder, Image as ImageIcon, LayoutGrid, List, Play, Plus, Video } from 'lucide-react';
import { DRIVE_KINDS, DRIVE_UPLOAD_OPTIONS, DRIVE_UPLOADING, driveDayGroups, driveKindOf, type DriveKind, type DriveLayout, type DriveUploadOption, type ServiceFile } from '@lilachat/shared';
import { useDismiss } from '../../ui/useDismiss';

const KICKER = 'text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant';
const ICONS = { photo: Camera, video: Video, gallery: ImageIcon, document: FileText } as const;
const TEST_IDS = { photo: 'drive-foto', video: 'drive-video', gallery: 'drive-galeria', document: 'drive-documento' } as const;
const filesLabel = (count: number) => (count === 1 ? '1 archivo' : `${count} archivos`);
const extensionOf = (name: string) => (name.includes('.') ? name.split('.').pop()!.toUpperCase().slice(0, 4) : 'DOC');

type Option = DriveUploadOption['id'];

/** ONE «Subir» and its menu (design drv-03, José 13/11): on a computer without a camera, the gallery reads «del equipo». */
function UploadMenu(props: { options: readonly Option[]; sending: boolean; onPick: (option: Option) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useDismiss(open, box, () => setOpen(false));
  const pick = (option: Option) => {
    setOpen(false);
    props.onPick(option);
  };
  return (
    <div ref={box} className="relative">
      <button type="button" data-testid="subir-al-drive" aria-haspopup="menu" aria-expanded={open} disabled={props.sending} onClick={() => setOpen(!open)} className="flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-on-primary disabled:opacity-60">
        <Plus size={17} /> {props.sending ? DRIVE_UPLOADING : 'Subir'}
      </button>
      {open ? (
        <div role="menu" data-testid="menu-subir-drive" className="absolute right-0 top-12 z-30 w-[300px] max-w-[calc(100vw-32px)] rounded-xl border border-outline/15 bg-surface p-2 shadow-lg">
          <p className={`${KICKER} px-2 pb-1 pt-1`}>Subir al Drive</p>
          {DRIVE_UPLOAD_OPTIONS.filter((option) => props.options.includes(option.id)).map((option) => {
            const Icon = ICONS[option.id];
            return (
              <button key={option.id} type="button" role="menuitem" data-testid={TEST_IDS[option.id]} onClick={() => pick(option.id)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-background">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Icon size={18} /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{option.title}</span>
                  <span className="block truncate text-xs text-on-surface-variant">{option.id === 'gallery' && !props.options.includes('photo') ? 'Fotos y videos del equipo' : option.detail}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** Design drv-01/02: «DRIVE DEL SERVICIO · 70 archivos», Lista / Cuadrícula and ONE «Subir»; the camera one tap away beside it (José 13/11). */
export function DriveHeaderWeb(props: { count: number | null; layout: DriveLayout; onLayout: (layout: DriveLayout) => void; options: readonly Option[]; sending: boolean; onPick: (option: Option) => void }) {
  const camera = props.options.includes('photo');
  const toggle = (layout: DriveLayout, Icon: typeof List, label: string) => (
    <button type="button" data-testid={`drive-vista-${layout === 'list' ? 'lista' : 'cuadricula'}`} aria-pressed={props.layout === layout} aria-label={label} title={label} onClick={() => props.onLayout(layout)} className={`grid h-9 w-10 place-items-center rounded-lg ${props.layout === layout ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-background'}`}>
      <Icon size={17} />
    </button>
  );
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <p className={KICKER}>Drive del servicio</p>
        {props.count !== null ? <p className="text-base font-bold">{filesLabel(props.count)}</p> : null}
      </div>
      <div className="flex rounded-xl border border-outline/15 bg-surface p-0.5">
        {toggle('list', List, 'Ver como lista')}
        {toggle('grid', LayoutGrid, 'Ver como cuadrícula')}
      </div>
      {camera ? (
        <button type="button" data-testid="drive-camara" aria-label="Abrir la cámara" title="Abrir la cámara" disabled={props.sending} onClick={() => props.onPick('photo')} className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary disabled:opacity-60">
          <Camera size={18} />
        </button>
      ) : null}
      <UploadMenu options={props.options} sending={props.sending} onPick={props.onPick} />
    </div>
  );
}

/** Todo · Fotos · Videos · Documentos. */
export function DriveKindChipsWeb(props: { kind: DriveKind; onKind: (kind: DriveKind) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto">
      {DRIVE_KINDS.map((one) => (
        <button key={one.kind} type="button" data-testid={`drive-tipo-${one.kind}`} aria-pressed={props.kind === one.kind} onClick={() => props.onKind(one.kind)} className={`h-8 shrink-0 rounded-full border px-3.5 text-sm font-semibold ${props.kind === one.kind ? 'border-primary bg-primary text-on-primary' : 'border-outline/20 bg-surface'}`}>{one.label}</button>
      ))}
    </div>
  );
}

function Tile(props: { file: ServiceFile; onOpen: (file: ServiceFile) => void }) {
  const kind = driveKindOf(props.file.mime);
  const preview = kind === 'photo' ? (props.file.thumbUrl ?? props.file.url) : props.file.thumbUrl;
  const sheet = /sheet|excel/.test(props.file.mime);
  const Icon = sheet ? FileSpreadsheet : FileText;
  return (
    <button type="button" data-testid="archivo-drive" onClick={() => props.onOpen(props.file)} className="overflow-hidden rounded-xl border border-outline/15 bg-surface text-left hover:border-primary/40">
      {preview ? (
        <span className="relative block aspect-square bg-background">
          <img src={preview} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
          {kind === 'video' ? <span className="absolute inset-0 grid place-items-center bg-black/20 text-white"><Play size={26} fill="currentColor" /></span> : null}
          {kind === 'document' ? <span className={`absolute bottom-2 left-2 rounded-md px-1.5 py-0.5 text-[11px] font-bold text-white ${sheet ? 'bg-en-linea' : 'bg-error'}`}>{extensionOf(props.file.name)}</span> : null}
        </span>
      ) : (
        <span className={`flex aspect-square flex-col items-center justify-center gap-2 ${kind === 'video' ? 'bg-primary/10 text-primary' : sheet ? 'bg-en-linea/10 text-en-linea' : 'bg-error/[0.08] text-error'}`}>
          {kind === 'video' ? <Play size={30} /> : <Icon size={34} />}
          <span className="text-[11px] font-bold">{extensionOf(props.file.name)}</span>
        </span>
      )}
      <span className="block truncate px-2 py-1.5 text-[13px] font-semibold">{props.file.name}</span>
    </button>
  );
}

/** Design drv-02: the files as tiles, by day in Lima («Hoy · 13 nov»). */
export function DriveGridWeb(props: { files: readonly ServiceFile[]; onOpen: (file: ServiceFile) => void }) {
  return (
    <div data-testid="drive-cuadricula" className="flex flex-col gap-3">
      {driveDayGroups(props.files, new Date()).map((group) => (
        <section key={group.key}>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{group.label}</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {group.files.map((file) => <Tile key={file.url} file={file} onOpen={props.onOpen} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

/** The folders as cards (design drv-02). */
export function FolderCardsWeb(props: { folders: readonly { name: string; count: number }[]; onOpen: (folder: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      {props.folders.map((one) => (
        <button key={one.name} type="button" data-testid={`carpeta-${one.name}`} onClick={() => props.onOpen(one.name)} className="flex min-h-[60px] items-center gap-2 rounded-xl border border-outline/15 bg-surface px-3 text-left hover:border-primary/40">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Folder size={17} /></span>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{one.name}</span>
          <span className="text-sm font-semibold tabular-nums text-on-surface-variant">{one.count}</span>
          <ChevronRight size={14} className="text-on-surface-variant" />
        </button>
      ))}
    </div>
  );
}
