import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Download, ExternalLink, FileText, Film, Image as ImageIcon, Play } from 'lucide-react';
import { galleryOf, mimeOf, openingOf, PDF_READINESS_TEXT, untilPdfReady, type PdfReadiness, type ViewableFile } from '@lilachat/shared';
import { PhotoViewer } from '../../chat/VisorDeFotos';
import type { MensajeEnPantalla } from '../../chat/types';
import { Overlay } from '../../ui/Overlay';

type Session = { files: ViewableFile[]; url: string; action?: ViewerAction };
export type ViewerAction = { label: string; onPress: () => void };

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

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const FAILED_TEXT = 'No se pudo abrir el PDF. Prueba en otra pestaña.';

/**
 * Asked for one byte before the frame shows it (Portal 31/10: a quote's PDF answers
 * 202 while it is generated). A host that does not allow asking from here (no
 * CORS) opens in the frame as before.
 */
function usePdfReadiness(url: string): PdfReadiness | 'checking' {
  const [readiness, setReadiness] = useState<PdfReadiness | 'checking'>('checking');
  useEffect(() => {
    let alive = true;
    const ask = async () => {
      const response = await fetch(url, { headers: { Range: 'bytes=0-0' } });
      return { status: response.status, retryAfter: response.headers.get('Retry-After') };
    };
    void untilPdfReady(ask, pause)
      .then((verdict) => alive && setReadiness(verdict))
      .catch(() => alive && setReadiness('ready'));
    return () => {
      alive = false;
    };
  }, [url]);
  return readiness;
}

function PdfFrame(props: { file: ViewableFile }) {
  const readiness = usePdfReadiness(props.file.url);
  if (readiness === 'ready') return <iframe data-testid="pdf-visor" title={props.file.name} src={props.file.url} className="h-[70vh] w-full rounded-lg border border-outline/15 bg-white" />;
  if (readiness === 'checking') return <div data-testid="pdf-preparando" className="grid h-[70vh] w-full animate-pulse place-items-center rounded-lg bg-background text-sm text-on-surface-variant">Preparando el PDF…</div>;
  return <p data-testid="pdf-no-disponible" className="grid h-40 place-items-center px-6 text-center text-sm text-on-surface-variant">{readiness === 'failed' ? FAILED_TEXT : PDF_READINESS_TEXT[readiness]}</p>;
}

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
      <PdfFrame file={props.file} />
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
  const open = useCallback((file: ViewableFile, siblings?: readonly ViewableFile[], action?: ViewerAction) => {
    const opening = openingOf(mimeOf(file));
    if (opening === 'gallery') return setSession({ files: galleryOf(siblings ?? [file]), url: file.url, ...(action ? { action: { label: action.label, onPress: () => { setSession(null); action.onPress(); } } } : {}) });
    if (opening === 'pdf') return setPdf(file);
    window.open(file.url, '_blank', 'noopener');
  }, []);
  const photos = useMemo(() => (session ? session.files.map(asMessage) : []), [session]);
  const index = photos.findIndex((photo) => photo.media?.url === session?.url);
  const viewer: ReactNode = (
    <>
      {session && index >= 0 ? <PhotoViewer fotos={photos} indice={index} onCambiar={(next) => setSession({ ...session, url: photos[next]?.media?.url ?? session.url })} onCerrar={() => setSession(null)} {...(session.action ? { action: session.action } : {})} /> : null}
      {pdf ? <PortalPdf file={pdf} onClose={() => setPdf(null)} /> : null}
    </>
  );
  return { open, viewer };
}

/**
 * The file's thumbnail (José 30/10 night asked why it did not show the
 * thumbnail): the photo itself or its preview, a video's frame with a play
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
