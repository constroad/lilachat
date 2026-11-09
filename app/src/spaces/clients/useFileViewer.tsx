import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { pdfPages } from '../../../modules/pdf-pages/src';
import { abrirConOtraApp } from '../../chat/guardarYCompartir';
import { PdfViewerScreen } from '../../chat/pdf/PdfViewerScreen';
import { VisorDelChat } from '../../chat/VisorDelChat';
import { galleryIndexOf, galleryOf, mimeOf, openingOf, pdfsOf, viewerWhenOf, type ViewableFile } from '@lilachat/shared';

type Session = { files: ViewableFile[]; url: string; /** Position in the gallery: several files may share an address. */ at: number; action?: ViewerAction; removal?: ViewerRemoval; footerOf?: ViewerFooter };
/** What goes under the photo on screen, by its url: «Antes / Después» in a service's Drive (José 08/11). */
export type ViewerFooter = (url: string) => ReactNode;
export type ViewerAction = { label: string; onPress: () => void };
/** «Eliminar» of the viewer: it always asks about the file on screen, never the one that opened it. */
export type ViewerRemoval = { canRemove: (url: string) => boolean; remove: (url: string) => void };

const NOTICE_MS = 4000;
/** The viewer has nothing to delete here: these are Portal's files. */
const cannotDelete = async () => ({ ok: false, motivo: 'Este archivo es del Portal.' });

/**
 * Opens a Portal file inside Lilachat (José 30/10): photos and videos in the
 * chat's viewer (swiping among `siblings`), PDFs in the PDF viewer, and the
 * rest with the phone's app. `viewer` goes once in the screen.
 */
export function useFileViewer() {
  const [session, setSession] = useState<Session | null>(null);
  const [notice, setNotice] = useState('');
  const say = useCallback((text: string) => {
    setNotice(text);
    setTimeout(() => setNotice(''), NOTICE_MS);
  }, []);

  const open = useCallback((file: ViewableFile, siblings?: readonly ViewableFile[], action?: ViewerAction, removal?: ViewerRemoval, footerOf?: ViewerFooter) => {
    const opening = openingOf(mimeOf(file));
    const picked = { ...(removal ? { removal } : {}), ...(footerOf ? { footerOf } : {}), ...(action ? { action: { label: action.label, onPress: () => { setSession(null); action.onPress(); } } } : {}) };
    if (opening === 'gallery' || (opening === 'pdf' && pdfPages)) {
      const files = [...(siblings ?? [file])];
      return setSession({ files, url: file.url, at: galleryIndexOf(galleryOf(files), file), ...picked });
    }
    void abrirConOtraApp({ url: file.url, cuando: new Date(), mime: mimeOf(file), seq: 0, nombre: file.name }).then((result) => {
      if (!result.ok) say(result.motivo);
    });
  }, [say]);

  const photos = useMemo(() => galleryOf(session?.files ?? []).map((file, index) => ({ url: file.url, autor: file.name, cuando: viewerWhenOf(file.when), seq: index + 1, mia: session?.removal?.canRemove(file.url) ?? false, cuandoReal: new Date(), mime: mimeOf(file), nombre: file.name, ...(file.thumbUrl ? { miniatura: file.thumbUrl } : {}) })), [session]);
  const pdfs = useMemo(() => pdfsOf(session?.files ?? []).map((file, index) => ({ seq: index + 1, url: file.url, name: file.name, at: new Date().toISOString(), mime: 'application/pdf' })), [session]);
  const photoSeq = session && photos[session.at]?.url === session.url ? session.at + 1 : (photos.find((photo) => photo.url === session?.url)?.seq ?? null);
  const pdf = pdfs.find((one) => one.url === session?.url) ?? null;

  const removeShown = async (seq: number) => {
    const shown = photos.find((photo) => photo.seq === seq);
    if (!session?.removal || !shown) return cannotDelete();
    session.removal.remove(shown.url);
    return { ok: true };
  };
  const moveTo = (url: string | undefined) => setSession((current) => (current && url ? { ...current, url } : null));
  const moveToPhoto = (seq: number) => setSession((current) => {
    const url = photos[seq - 1]?.url;
    return current && url ? { ...current, url, at: seq - 1 } : null;
  });
  const viewer = (
    <>
      <VisorDelChat fotos={photos} viendoSeq={photoSeq} onCambiar={(seq) => (seq === null ? setSession(null) : moveToPhoto(seq))} onEliminar={removeShown} onError={say} {...(session?.action ? { action: session.action } : {})} footer={session?.footerOf?.(session.url)} />
      <PdfViewerScreen pdf={pdf} others={pdfs} onPick={(seq) => moveTo(pdfs.find((one) => one.seq === seq)?.url)} onClose={() => setSession(null)} />
    </>
  );
  return { open, viewer, notice };
}
