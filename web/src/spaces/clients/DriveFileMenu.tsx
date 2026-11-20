import { useRef, useState } from 'react';
import { ArrowLeftRight, Copy, Download, ExternalLink, Link2, MoreVertical } from 'lucide-react';
import { DRIVE_COPY_FAILED, DRIVE_FILE_COPIED, DRIVE_LINK_COPIED, driveFileActions, type DriveFileActionId, type ServiceFile } from '@lilachat/shared';
import { useDismiss } from '../../ui/useDismiss';

const ICONS: Record<DriveFileActionId, typeof Copy> = { open: ExternalLink, copy_link: Link2, copy_file: Copy, download: Download, phase: ArrowLeftRight };

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

/**
 * The «⋮» of a Drive file (José 19/11, design cc-05): Abrir, Copiar enlace, Copiar archivo (an
 * image), Descargar and, for a photo, «Marcar como antes / después», which opens the viewer where
 * that bar lives. «Mover a carpeta» is not here: Portal has no tool for it.
 */
export function DriveFileMenu(props: { file: ServiceFile; onOpen: (file: ServiceFile) => void; onNotice: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useDismiss(open, box, () => setOpen(false));
  const run = (id: DriveFileActionId) => {
    setOpen(false);
    if (id === 'open' || id === 'phase') return props.onOpen(props.file);
    if (id === 'download') return download(props.file);
    void (id === 'copy_link' ? copyDriveLink(props.file) : copyDriveImage(props.file)).then(props.onNotice);
  };
  return (
    <div ref={box} className="relative shrink-0">
      <button type="button" data-testid="archivo-drive-mas" aria-label={`Opciones de ${props.file.name}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} className="grid h-9 w-9 place-items-center rounded-lg text-on-surface-variant hover:bg-background"><MoreVertical size={17} /></button>
      {open ? (
        <div role="menu" data-testid="archivo-drive-menu" className="absolute right-0 top-10 z-30 w-60 rounded-xl border border-outline/15 bg-surface p-1.5 shadow-lg">
          {driveFileActions(props.file, { copiesFiles: copiesFiles() }).map((action) => {
            const Icon = ICONS[action.id];
            return <button key={action.id} type="button" role="menuitem" data-testid={`archivo-drive-${action.id}`} onClick={() => run(action.id)} className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-[13px] font-semibold text-on-surface hover:bg-background"><Icon size={16} className="shrink-0" /> {action.label}</button>;
          })}
        </div>
      ) : null}
    </div>
  );
}
