import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Circle, ImageOff, ZoomIn } from 'lucide-react';
import { ALBUM_BROKEN_PHOTO, ALBUM_CANCEL, ALBUM_CLOSES_UNIT, ALBUM_SENDING, albumClosesUnit, albumCountLine, albumReviewTitle, albumSelection, albumSendLabel, freshAlbumMarks, markAlbumPhotoBroken, toggleAlbumPhoto, unitAlbumOf, type AlbumPhoto, type AlbumSend, type FinishBlock, type RepeatItem } from '@lilachat/shared';
import { Overlay, PrimaryButton } from '../../../ui/Overlay';

type Props = { item: RepeatItem; onSend: (urls: string[]) => Promise<AlbumSend>; /** Portal's text, for the notice once it went. */ onSent: (message: string) => void; onClose: () => void; onView: (url: string) => void; /** José 20/11: the unit before it in line has not left; nothing is sent. */ block?: FinishBlock | null; onGo?: (itemId: string) => void };

/** «Primero termina la Unidad 1 · F2K-908…» with «Ir a F2K-908» (design pv2-03). */
function BlockNotice({ block, onGo }: { block: FinishBlock; onGo?: (itemId: string) => void }) {
  return (
    <div data-testid="album-bloqueo" role="alert" className="flex flex-col gap-2 rounded-xl border border-error/40 bg-error/10 p-3 text-[13px] text-error">
      <p className="flex gap-2"><AlertTriangle size={16} className="mt-0.5 shrink-0" /> {block.text}</p>
      {onGo ? <button type="button" data-testid="album-ir-anterior" onClick={() => onGo(block.itemId)} className="inline-flex h-9 items-center gap-1 self-end rounded-lg border border-error/40 px-3 font-semibold">{block.goLabel} <ArrowRight size={14} /></button> : null}
    </div>
  );
}

/** One photo of the review: a tap checks or unchecks it, the magnifier opens it full size. */
function AlbumTile({ photo, index, checked, broken, onToggle, onBroken, onView }: { photo: AlbumPhoto; index: number; checked: boolean; broken: boolean; onToggle: () => void; onBroken: () => void; onView: () => void }) {
  const Check = checked ? CheckCircle2 : Circle;
  return (
    <li className="flex flex-col gap-1">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-surface-variant">
        <button type="button" data-testid={`album-foto-${index}`} aria-pressed={checked} aria-label={`${photo.label}${photo.hour ? ` · ${photo.hour}` : ''}`} disabled={broken} onClick={onToggle} className={`block h-full w-full ${checked ? 'ring-2 ring-inset ring-primary' : ''}`}>
          {broken ? (
            <span data-testid={`album-rota-${index}`} className="flex h-full w-full flex-col items-center justify-center gap-1 text-on-surface-variant"><ImageOff size={22} /><span className="text-[11px] font-semibold">{ALBUM_BROKEN_PHOTO}</span></span>
          ) : (
            <img data-testid={`album-miniatura-${index}`} src={photo.thumbUrl} alt="" onError={onBroken} className={`h-full w-full object-cover ${checked ? '' : 'opacity-50'}`} />
          )}
          {broken ? null : <Check size={22} className={`absolute right-1.5 top-1.5 rounded-full bg-surface ${checked ? 'text-primary' : 'text-on-surface-variant'}`} />}
        </button>
        {broken ? null : (
          <button type="button" data-testid={`album-ver-${index}`} aria-label={`Ver ${photo.label} en grande`} onClick={onView} className="absolute bottom-1.5 left-1.5 grid h-9 w-9 place-items-center rounded-full bg-surface/90 text-on-surface shadow-sm">
            <ZoomIn size={16} />
          </button>
        )}
      </div>
      <p className="truncate text-[12px] font-semibold">{photo.label}{photo.hour ? <span className="font-mono font-normal text-on-surface-variant"> · {photo.hour}</span> : null}</p>
    </li>
  );
}

/**
 * «Terminar unidad» (José 19/11, spec INFORMES-DESDE-LILACHAT §24): before the unit's photos go to
 * the client's group, the person sees them all, unchecks what should not go, and confirms. A photo
 * that does not open is left out by itself.
 */
export function UnitAlbumDialog({ item, onSend, onSent, onClose, onView, block, onGo }: Props) {
  const album = useMemo(() => unitAlbumOf(item), [item]);
  const [marks, setMarks] = useState(freshAlbumMarks);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const selected = albumSelection(album, marks);
  const send = async () => {
    setSending(true);
    setError('');
    const sent = await onSend(selected);
    setSending(false);
    if (sent.ok) onSent(sent.message);
    else setError(sent.message);
  };
  const footer = (
    <div className="flex flex-col gap-2">
      <p data-testid="album-conteo" className="text-center text-sm font-semibold">{albumCountLine(selected.length)}</p>
      {albumClosesUnit(item) ? <p data-testid="album-cierra" className="text-center text-[13px] text-on-surface-variant">{ALBUM_CLOSES_UNIT}</p> : null}
      {block ? <BlockNotice block={block} onGo={onGo} /> : null}
      {error ? <p data-testid="album-error" role="alert" className="text-center text-[13px] text-error">{error}</p> : null}
      <PrimaryButton testId="album-enviar" onClick={() => void send()} disabled={selected.length === 0 || sending || Boolean(block)}>{sending ? ALBUM_SENDING : albumSendLabel(selected.length)}</PrimaryButton>
      <button type="button" data-testid="album-cancelar" onClick={onClose} className="h-11 w-full rounded-xl border border-outline/20 text-sm font-semibold hover:bg-background">{ALBUM_CANCEL}</button>
    </div>
  );
  return (
    <Overlay title={albumReviewTitle(item)} onClose={onClose} footer={footer} wide>
      <ul data-testid="album-revision" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {album.map((photo, index) => (
          <AlbumTile key={photo.url} photo={photo} index={index} checked={selected.includes(photo.url)} broken={marks.broken.has(photo.url)} onToggle={() => setMarks((now) => toggleAlbumPhoto(now, photo.url))} onBroken={() => setMarks((now) => markAlbumPhotoBroken(now, photo.url))} onView={() => onView(photo.url)} />
        ))}
      </ul>
    </Overlay>
  );
}
