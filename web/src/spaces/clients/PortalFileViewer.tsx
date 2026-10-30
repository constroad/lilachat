import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Download, ExternalLink, FileText, Film, Image as ImageIcon, Play } from 'lucide-react';
import { galleryOf, mimeOf, openingOf, type ViewableFile } from '@lilachat/shared';
import { PhotoViewer } from '../../chat/VisorDeFotos';
import type { MensajeEnPantalla } from '../../chat/types';
import { Overlay } from '../../ui/Overlay';

type Session = { files: ViewableFile[]; url: string };

/** A Portal file as the chat's viewer reads a photo: it only needs the file, its name and a day. */
const asMessage = (file: ViewableFile, index: number): MensajeEnPantalla => ({
  chatId: 'portal',
  seq: index + 1,
  senderId: '',
  clientKey: file.url,
  kind: mimeOf(file).startsWith('video/') ? 'video' : 'image',
  body: file.name,
  media: { url: file.url, mime: mimeOf(file), fileName: file.name, ...(file.thumbUrl ? { thumbUrl: file.thumbUrl } : {}) },
  at: file.when && !Number.isNaN(Date.parse(file.when)) ? file.when : new Date().toISOString(),
});

/** Portal's PDF inside Lilachat: the browser's own viewer in a frame, with its download at the foot. */
function PortalPdf(props: { file: ViewableFile; onClose: () => void }) {
  return (
    <Overlay
      title={props.file.name}
      onClose={props.onClose}
      wide
      footer={
        <div className="flex gap-2">
          <a href={props.file.url} download={props.file.name} target="_blank" rel="noreferrer" data-testid="pdf-descargar" className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-primary hover:bg-background"><Download size={16} /> Descargar</a>
          <a href={props.file.url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm text-on-surface-variant hover:bg-background"><ExternalLink size={16} /> Abrir en otra pestaña</a>
        </div>
      }
    >
      <iframe data-testid="pdf-visor" title={props.file.name} src={props.file.url} className="h-[70vh] w-full rounded-lg border border-outline/15 bg-white" />
    </Overlay>
  );
}

/**
 * Opens a Portal file inside Lilachat on the web (José 30/10 night: «sigue sin
 * abrir el visor, solo abre la url»): photos and videos in the chat's viewer,
 * swiping among `siblings`; a PDF in its own viewer; the rest in a new tab.
 */
export function usePortalFileViewer() {
  const [session, setSession] = useState<Session | null>(null);
  const [pdf, setPdf] = useState<ViewableFile | null>(null);
  const open = useCallback((file: ViewableFile, siblings?: readonly ViewableFile[]) => {
    const opening = openingOf(mimeOf(file));
    if (opening === 'gallery') return setSession({ files: galleryOf(siblings ?? [file]), url: file.url });
    if (opening === 'pdf') return setPdf(file);
    window.open(file.url, '_blank', 'noopener');
  }, []);
  const photos = useMemo(() => (session ? session.files.map(asMessage) : []), [session]);
  const index = photos.findIndex((photo) => photo.media?.url === session?.url);
  const viewer: ReactNode = (
    <>
      {session && index >= 0 ? <PhotoViewer fotos={photos} indice={index} onCambiar={(next) => setSession({ ...session, url: photos[next]?.media?.url ?? session.url })} onCerrar={() => setSession(null)} /> : null}
      {pdf ? <PortalPdf file={pdf} onClose={() => setPdf(null)} /> : null}
    </>
  );
  return { open, viewer };
}

/**
 * The file's thumbnail (José 30/10 night: «¿por qué no se muestra el
 * thumbnail?»): the photo itself or its preview, a video's frame with a play
 * mark, a PDF and any other file as a tile.
 */
export function FileThumb(props: { file: ViewableFile; size?: number }) {
  const size = props.size ?? 44;
  const mime = mimeOf(props.file);
  const box = { width: size, height: size };
  const preview = mime.startsWith('image/') ? (props.file.thumbUrl ?? props.file.url) : props.file.thumbUrl;
  if (preview) {
    return (
      <span className="relative shrink-0 overflow-hidden rounded-lg bg-background" style={box}>
        <img src={preview} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        {mime.startsWith('video/') ? <span className="absolute inset-0 grid place-items-center bg-black/25 text-white"><Play size={16} fill="currentColor" /></span> : null}
      </span>
    );
  }
  const tile = mime === 'application/pdf' ? { Icon: FileText, label: 'PDF', tone: 'bg-error/[0.08] text-error' } : mime.startsWith('video/') ? { Icon: Film, label: '', tone: 'bg-primary/10 text-primary' } : mime.startsWith('image/') ? { Icon: ImageIcon, label: '', tone: 'bg-primary/10 text-primary' } : { Icon: FileText, label: '', tone: 'bg-background text-on-surface-variant' };
  return (
    <span className={`grid shrink-0 place-items-center rounded-lg ${tile.tone}`} style={box}>
      <span className="flex flex-col items-center">
        <tile.Icon size={18} />
        {tile.label ? <span className="text-[9px] font-bold">{tile.label}</span> : null}
      </span>
    </span>
  );
}
