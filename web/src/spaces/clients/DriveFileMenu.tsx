import { useRef, useState } from 'react';
import { ArrowLeftRight, Copy, Download, Expand, Link2, MoreVertical, Share2, X } from 'lucide-react';
import { DRIVE_COPY_FAILED, DRIVE_FILE_COPIED, DRIVE_LINK_COPIED, driveFileActions, driveSheetLine, type DriveFileAction, type DriveFileActionId, type ServiceFile } from '@lilachat/shared';
import { useDismiss } from '../../ui/useDismiss';
import { FileThumb } from './PortalFileViewer';
import { useCompactShell } from './ServiceShellWeb';

const ICONS: Record<DriveFileActionId, typeof Copy> = { open: Expand, copy_link: Link2, copy_file: Copy, share: Share2, phase: ArrowLeftRight, download: Download };

/** A device with a share sheet (a phone's browser): `navigator.share`. */
const SHEET_THUMB_PX = 48;
const sharesFiles = (): boolean => typeof navigator.share === 'function';

/** A browser that can put an image on the clipboard (Chrome, Edge, Safari): `ClipboardItem` and `clipboard.write`. */
export const copiesFiles = (): boolean => typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard?.write === 'function';

/** The clipboard takes PNG only: any other image is redrawn as PNG first. */
async function pngOf(blob: Blob): Promise<Blob> {
  if (blob.type === 'image/png') return blob;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob((png) => (png ? resolve(png) : reject(new Error('png_failed'))), 'image/png'));
}

export async function copyDriveLink(file: ServiceFile): Promise<string> {
  try {
    await navigator.clipboard.writeText(file.url);
    return DRIVE_LINK_COPIED;
  } catch (error) {
    console.warn('drive: copy link failed', (error as Error).name);
    return DRIVE_COPY_FAILED;
  }
}

export async function copyDriveImage(file: ServiceFile): Promise<string> {
  try {
    const response = await fetch(file.url);
    const png = await pngOf(await response.blob());
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    return DRIVE_FILE_COPIED;
  } catch (error) {
    console.warn('drive: copy image failed', (error as Error).name);
    return DRIVE_COPY_FAILED;
  }
}

function download(file: ServiceFile) {
  const anchor = document.createElement('a');
  anchor.href = file.url;
  anchor.download = file.name;
  anchor.target = '_blank';
  anchor.rel = 'noopener';
  anchor.click();
}

async function share(file: ServiceFile) {
  try {
    await navigator.share({ title: file.name, url: file.url });
  } catch (error) {
    // Closing the share sheet is an AbortError: nothing to say.
    if ((error as Error).name !== 'AbortError') console.warn('drive: share failed', (error as Error).name);
  }
}

type MenuProps = { file: ServiceFile; onOpen: (file: ServiceFile) => void; onNotice: (text: string) => void; /** «Ver en el chat» in «Medios». */ openLabel?: string };

function runAction(id: DriveFileActionId, props: MenuProps) {
  if (id === 'open' || id === 'phase') return props.onOpen(props.file);
  if (id === 'download') return download(props.file);
  if (id === 'share') return void share(props.file);
  void (id === 'copy_link' ? copyDriveLink(props.file) : copyDriveImage(props.file)).then(props.onNotice);
}

/** Design cc-05 mobile: the file's sheet from the bottom, with its thumbnail, «fecha · carpeta · tamaño» and ✕. */
function DriveFileSheetWeb(props: { file: ServiceFile; actions: DriveFileAction[]; onRun: (id: DriveFileActionId) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={props.onClose}>
      <div role="dialog" aria-modal="true" aria-label={props.file.name} data-testid="hoja-archivo-drive" onClick={(event) => event.stopPropagation()} className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-surface pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl">
        <span className="mx-auto mt-2 block h-1 w-10 rounded-full bg-outline/30" />
        <div className="mt-2 flex items-center gap-3 bg-background px-4 py-3">
          <FileThumb file={props.file} size={SHEET_THUMB_PX} />
          <span className="min-w-0 flex-1"><span className="block truncate text-[16px] font-bold text-on-surface">{props.file.name}</span><span className="block truncate text-[13px] text-on-surface-variant">{driveSheetLine(props.file, new Date())}</span></span>
          <button type="button" data-testid="archivo-drive-cerrar" aria-label="Cerrar" onClick={props.onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-on-surface hover:bg-surface"><X size={20} /></button>
        </div>
        {props.actions.map((action) => {
          const Icon = ICONS[action.id];
          const marked = action.id === 'phase';
          return (
            <button key={action.id} type="button" data-testid={`archivo-drive-${action.id}`} onClick={() => props.onRun(action.id)} className={`flex min-h-[56px] w-full items-center gap-4 px-5 py-2 text-left ${marked ? 'bg-primary/5' : 'hover:bg-background'}`}>
              <Icon size={22} className="shrink-0 text-primary" />
              <span className="min-w-0"><span className={`block text-[16px] ${marked ? 'font-bold text-primary' : 'text-on-surface'}`}>{action.label}</span>{action.hint ? <span className="block text-[13px] text-on-surface-variant">{action.hint}</span> : null}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The «⋮» of a Drive file or a «Medios» file (José 19/11, design cc-05): on a computer a floating
 * menu, on a phone a sheet from the bottom. Abrir, Copiar enlace, Copiar archivo (an image),
 * Compartir (where the browser can), «Marcar como antes / después» (opens the viewer, where that
 * bar lives) and Descargar. «Mover a carpeta» is not here: Portal has no tool for it.
 */
export function DriveFileMenu(props: MenuProps) {
  const [open, setOpen] = useState(false);
  const compact = useCompactShell();
  const box = useRef<HTMLDivElement>(null);
  useDismiss(open && !compact, box, () => setOpen(false));
  const actions = driveFileActions(props.file, { copiesFiles: copiesFiles(), shares: sharesFiles(), ...(props.openLabel ? { openLabel: props.openLabel } : {}) });
  const run = (id: DriveFileActionId) => {
    setOpen(false);
    runAction(id, props);
  };
  return (
    <div ref={box} className="relative shrink-0">
      <button type="button" data-testid="archivo-drive-mas" aria-label={`Opciones de ${props.file.name}`} aria-haspopup={compact ? 'dialog' : 'menu'} aria-expanded={open} onClick={(event) => { event.stopPropagation(); setOpen(!open); }} className="grid h-9 w-9 place-items-center rounded-lg text-on-surface-variant hover:bg-background"><MoreVertical size={17} /></button>
      {open && compact ? <DriveFileSheetWeb file={props.file} actions={actions} onRun={run} onClose={() => setOpen(false)} /> : null}
      {open && !compact ? (
        <div role="menu" data-testid="archivo-drive-menu" className="absolute right-0 top-10 z-30 w-60 rounded-xl border border-outline/15 bg-surface p-1.5 shadow-lg">
          {actions.map((action) => {
            const Icon = ICONS[action.id];
            return <button key={action.id} type="button" role="menuitem" data-testid={`archivo-drive-${action.id}`} onClick={() => run(action.id)} className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-[13px] font-semibold text-on-surface hover:bg-background"><Icon size={16} className="shrink-0" /> {action.label}</button>;
          })}
        </div>
      ) : null}
    </div>
  );
}
