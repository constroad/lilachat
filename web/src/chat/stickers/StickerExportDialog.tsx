import { useState } from 'react';
import { Clapperboard, Image as ImageIcon, Info } from 'lucide-react';
import { stickerExportOf, type LibrarySticker } from '@lilachat/shared';
import { Overlay } from '../../ui/Overlay';
import { CHECKERBOARD } from './CreateStickerFromVideo';
import type { FileOutcome } from './stickersApi';

type Props = {
  sticker: LibrarySticker;
  /** The MP4 with its sound, made by the server. */
  makeVideo: () => Promise<FileOutcome>;
  onClose: () => void;
};

/** The picture as a file named for keeping: WhatsApp's sticker maker and the phone's gallery take it as it is. */
export async function stickerPictureFile(sticker: Pick<LibrarySticker, 'url' | 'mime'>): Promise<FileOutcome> {
  try {
    const response = await fetch(sticker.url);
    if (!response.ok) return { ok: false, message: 'No se pudo traer la imagen del sticker.' };
    const extension = sticker.mime === 'image/png' ? 'png' : 'webp';
    return { ok: true, file: new File([await response.blob()], `sticker-lilachat.${extension}`, { type: sticker.mime }) };
  } catch {
    return { ok: false, message: 'Sin conexión. Revisa tu internet.' };
  }
}

/** Saves the file through the browser (the phone's browser offers to open it in WhatsApp from its downloads). */
function download(file: File): void {
  const url = URL.createObjectURL(file);
  const link = Object.assign(document.createElement('a'), { href: url, download: file.name });
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/**
 * «Exportar para WhatsApp» on the web (José 27/11, design sa-05): WhatsApp takes no sound from other apps, so the
 * sticker goes as a video with its sound (in WhatsApp: Stickers › Crear › that video) and as the picture without it.
 */
export function StickerExportDialog({ sticker, makeVideo, onClose }: Props) {
  const exportable = stickerExportOf(sticker);
  const [busy, setBusy] = useState<'video' | 'picture' | null>(null);
  const [notice, setNotice] = useState('');
  const take = async (kind: 'video' | 'picture') => {
    setBusy(kind);
    setNotice('');
    const made = kind === 'video' ? await makeVideo() : await stickerPictureFile(sticker);
    setBusy(null);
    if (made.ok) download(made.file);
    else setNotice(made.message);
  };
  return (
    <Overlay title="Exportar para WhatsApp" onClose={onClose}>
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className={`mx-auto grid h-40 w-40 shrink-0 place-items-center rounded-2xl border border-outline/15 ${CHECKERBOARD}`}>
          <img src={sticker.url} alt="" className="h-36 w-36 object-contain" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {exportable.video ? (
            <ExportRow testId="exportar-video" Icon={Clapperboard} title="Video con su sonido" hint="En WhatsApp: Stickers › Crear › elige este video. Ahí le dejas su sonido." action={busy === 'video' ? 'Preparando…' : 'Descargar video (MP4)'} primary disabled={busy !== null} onClick={() => void take('video')} />
          ) : null}
          <ExportRow testId="exportar-imagen" Icon={ImageIcon} title="Sticker sin sonido" hint={`Imagen ${sticker.mime === 'image/png' ? 'PNG' : 'WebP'} de 512 × 512.`} action={busy === 'picture' ? 'Preparando…' : 'Descargar imagen'} disabled={busy !== null} onClick={() => void take('picture')} />
        </div>
      </div>
      {notice ? <p role="alert" className="mt-3 text-[13px] text-error">{notice}</p> : null}
      <p className="mt-4 flex gap-2 text-[12px] leading-5 text-on-surface-variant">
        <Info size={14} className="mt-0.5 shrink-0" /> WhatsApp todavía no recibe stickers con sonido desde otras apps: el sonido se lo pones al crearlo allá.
      </p>
    </Overlay>
  );
}

type RowProps = { testId: string; Icon: typeof Info; title: string; hint: string; action: string; primary?: boolean; disabled: boolean; onClick: () => void };

function ExportRow({ testId, Icon, title, hint, action, primary, disabled, onClick }: RowProps) {
  return (
    <section className={`rounded-xl border p-3 ${primary ? 'border-primary/50' : 'border-outline/20'}`}>
      <p className="flex items-center gap-2 text-[14px] font-semibold"><Icon size={16} className="text-primary" /> {title}</p>
      <p className="mt-1 text-[12px] leading-5 text-on-surface-variant">{hint}</p>
      <button type="button" data-testid={testId} disabled={disabled} onClick={onClick} className={`mt-2 h-10 w-full rounded-xl text-[13px] font-semibold disabled:opacity-60 ${primary ? 'bg-primary text-on-primary' : 'border border-outline/25 hover:bg-background'}`}>{action}</button>
    </section>
  );
}
