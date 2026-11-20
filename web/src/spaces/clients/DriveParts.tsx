import { useRef, useState, type ReactNode } from 'react';
import { Camera, ClipboardPaste, FileSpreadsheet, FileText, Folder, Image as ImageIcon, LayoutGrid, List, Play, Plus, Video } from 'lucide-react';
import { DRIVE_KINDS, DRIVE_UPLOAD_OPTIONS, DRIVE_UPLOADING, driveDayGroups, driveFilesLabel, driveKindOf, driveTileLine, driveTypeTag, type DriveKind, type DriveLayout, type DriveUploadOption, type ServiceFile } from '@lilachat/shared';
import { useDismiss } from '../../ui/useDismiss';

const KICKER = 'text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant';
const ICONS = { photo: Camera, video: Video, gallery: ImageIcon, document: FileText } as const;
const TEST_IDS = { photo: 'drive-foto', video: 'drive-video', gallery: 'drive-galeria', document: 'drive-documento' } as const;

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

/** The Drive's buttons at the right of the service's tab bar (design cc-05): «Pegar», the camera one tap away (José 13/11) and ONE «Subir». */
export function DriveActionsWeb(props: { options: readonly Option[]; sending: boolean; onPick: (option: Option) => void; onPaste: () => void }) {
  const camera = props.options.includes('photo');
  return (
    <>
      <button type="button" data-testid="drive-pegar" disabled={props.sending} onClick={props.onPaste} className="flex h-10 items-center gap-1.5 rounded-xl border border-outline/20 bg-surface px-3 text-sm font-semibold text-on-surface hover:bg-background disabled:opacity-60"><ClipboardPaste size={16} /> Pegar</button>
      {camera ? (
        <button type="button" data-testid="drive-camara" aria-label="Abrir la cámara" title="Abrir la cámara" disabled={props.sending} onClick={() => props.onPick('photo')} className="grid h-10 w-10 place-items-center rounded-xl border border-outline/20 bg-surface text-on-surface disabled:opacity-60">
          <Camera size={18} />
        </button>
      ) : null}
      <UploadMenu options={props.options} sending={props.sending} onPick={props.onPick} />
    </>
  );
}

/** Lista / Cuadrícula at the right of the chips (design cc-05: no «Drive del servicio» heading). */
export function DriveLayoutToggleWeb(props: { layout: DriveLayout; onLayout: (layout: DriveLayout) => void }) {
  const toggle = (layout: DriveLayout, Icon: typeof List, label: string) => (
    <button type="button" data-testid={`drive-vista-${layout === 'list' ? 'lista' : 'cuadricula'}`} aria-pressed={props.layout === layout} aria-label={label} title={label} onClick={() => props.onLayout(layout)} className={`grid h-8 w-9 place-items-center rounded-lg ${props.layout === layout ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface'}`}>
      <Icon size={17} />
    </button>
  );
  return (
    <div className="ml-auto flex shrink-0 rounded-xl bg-background p-0.5">
      {toggle('list', List, 'Ver como lista')}
      {toggle('grid', LayoutGrid, 'Ver como cuadrícula')}
    </div>
  );
}

/** Todo · Fotos · Videos · Documentos. */
export function DriveKindChipsWeb(props: { kind: DriveKind; onKind: (kind: DriveKind) => void }) {
  return (
    <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
      {DRIVE_KINDS.map((one) => (
        <button key={one.kind} type="button" data-testid={`drive-tipo-${one.kind}`} aria-pressed={props.kind === one.kind} onClick={() => props.onKind(one.kind)} className={`h-8 shrink-0 rounded-full border px-3.5 text-sm font-semibold ${props.kind === one.kind ? 'border-primary bg-primary text-on-primary' : 'border-outline/20 bg-surface'}`}>{one.label}</button>
      ))}
    </div>
  );
}

const DOCUMENT_LOOKS = {
  sheet: { Icon: FileSpreadsheet, tone: 'text-en-linea' },
  pdf: { Icon: FileText, tone: 'text-error' },
  other: { Icon: FileText, tone: 'text-primary' },
} as const;
const documentLookOf = (file: ServiceFile) => DOCUMENT_LOOKS[/sheet|excel/.test(file.mime) ? 'sheet' : /pdf/.test(file.mime) ? 'pdf' : 'other'];

/** The square of a tile: the thumbnail, or the file's icon on a plain field, with its type tag (design cc-05). */
function TilePreview(props: { file: ServiceFile }) {
  const kind = driveKindOf(props.file.mime);
  const preview = kind === 'photo' ? (props.file.thumbUrl ?? props.file.url) : props.file.thumbUrl;
  const look = documentLookOf(props.file);
  return (
    <span className="relative block aspect-square bg-background">
      {preview ? <img src={preview} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : null}
      {!preview && kind === 'document' ? <span className="absolute inset-0 grid place-items-center"><look.Icon size={40} className={look.tone} /></span> : null}
      {!preview && kind === 'photo' ? <span className="absolute inset-0 grid place-items-center text-on-surface-variant"><ImageIcon size={34} /></span> : null}
      {kind === 'video' ? <span className="absolute inset-0 grid place-items-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-surface text-primary shadow-sm"><Play size={20} fill="currentColor" /></span></span> : null}
      <span data-testid="drive-etiqueta" className="absolute left-2 top-2 rounded-md bg-surface px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-on-surface shadow-sm">{driveTypeTag(props.file)}</span>
    </span>
  );
}

/** A tile: the preview opens it; under it the name, «hoy 08:30 · 2.1 MB» and its «⋮» (design cc-05). */
function Tile(props: { file: ServiceFile; now: Date; onOpen: (file: ServiceFile) => void; menu?: (file: ServiceFile) => ReactNode }) {
  return (
    <div className="relative rounded-xl border border-outline/15 bg-surface hover:border-primary/40">
      <button type="button" data-testid="archivo-drive" onClick={() => props.onOpen(props.file)} className="block w-full overflow-hidden rounded-xl text-left">
        <TilePreview file={props.file} />
        <span className="block py-1.5 pl-3 pr-10">
          <span className="block truncate text-[13px] font-semibold">{props.file.name}</span>
          <span className="block truncate text-[11px] text-on-surface-variant">{driveTileLine(props.file, props.now)}</span>
        </span>
      </button>
      {props.menu ? <span className="absolute bottom-1.5 right-1">{props.menu(props.file)}</span> : null}
    </div>
  );
}

/** Design cc-05: the files as a mosaic by day in Lima («HOY · 19 NOV»): 2 per row on a phone, 3 on a tablet, 5 on a computer. */
export function DriveGridWeb(props: { files: readonly ServiceFile[]; onOpen: (file: ServiceFile) => void; menu?: (file: ServiceFile) => ReactNode }) {
  const now = new Date();
  return (
    <div data-testid="drive-cuadricula" className="flex flex-col gap-4">
      {driveDayGroups(props.files, now).map((group) => (
        <section key={group.key}>
          <p className={`${KICKER} mb-2`}>{group.label}</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {group.files.map((file) => <Tile key={file.url} file={file} now={now} onOpen={props.onOpen} menu={props.menu} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

/** The folders as cards (design cc-05): icon tile, name and «41 archivos»; 2, 3 or 4 per row. */
export function FolderCardsWeb(props: { folders: readonly { name: string; count: number }[]; onOpen: (folder: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-4">
      {props.folders.map((one) => (
        <button key={one.name} type="button" data-testid={`carpeta-${one.name}`} onClick={() => props.onOpen(one.name)} className="flex min-h-[64px] min-w-0 items-center gap-3 rounded-xl border border-outline/15 bg-surface px-3 py-2.5 text-left hover:border-primary/40">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Folder size={18} /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{one.name}</span>
            <span className="block truncate text-xs text-on-surface-variant">{driveFilesLabel(one.count)}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
