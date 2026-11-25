import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Download, ExternalLink, X } from 'lucide-react';

const ICON_BUTTON = 'grid h-11 w-11 place-items-center rounded-full text-white hover:bg-white/10';

/**
 * A file at full screen, like WhatsApp Web (José 25/11: the viewer did not
 * open the way WhatsApp's does): black backdrop, the name on top with its actions,
 * the document filling the rest. The photo viewer already looked like this;
 * PDFs opened in a small modal. Escape or the X closes it.
 */
export function FullscreenFileViewer(props: {
  title: string;
  subtitle?: string;
  downloadUrl?: string;
  downloadName?: string;
  /** «Abrir en otra pestaña», where the file allows it. */
  externalUrl?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { onClose } = props;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div data-testid="visor-archivo" role="dialog" aria-label={props.title} className="fixed inset-0 z-50 flex flex-col bg-black">
      <header className="flex items-center gap-2 px-4 py-3 text-white">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{props.title}</p>
          {props.subtitle ? <p className="truncate text-xs text-white/70">{props.subtitle}</p> : null}
        </div>
        {props.externalUrl ? (
          <a href={props.externalUrl} target="_blank" rel="noreferrer" aria-label="Abrir en otra pestaña" title="Abrir en otra pestaña" className={ICON_BUTTON}>
            <ExternalLink size={20} />
          </a>
        ) : null}
        {props.downloadUrl ? (
          <a href={props.downloadUrl} download={props.downloadName} target="_blank" rel="noreferrer" data-testid="pdf-descargar" aria-label="Descargar" title="Descargar" className={ICON_BUTTON}>
            <Download size={20} />
          </a>
        ) : null}
        <button type="button" data-testid="btn-cerrar-visor" aria-label="Cerrar" onClick={onClose} className={ICON_BUTTON}>
          <X size={22} />
        </button>
      </header>
      {/* All the width there is, like WhatsApp (José 25/11): the browser's own viewer centres the pages. */}
      <div className="flex min-h-0 flex-1 items-center justify-center">{props.children}</div>
    </div>,
    document.body,
  );
}

/** The document's frame inside the full-screen viewer: all the height there is. */
export const FULLSCREEN_FRAME_CLASS = 'h-full w-full border-0 bg-white';
/** A waiting or failure text on the black backdrop. */
export const FULLSCREEN_NOTE_CLASS = 'px-6 text-center text-sm text-white/80';
