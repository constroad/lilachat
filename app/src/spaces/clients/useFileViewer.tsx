import { useCallback, useMemo, useState } from 'react';
import { pdfPages } from '../../../modules/pdf-pages/src';
import { abrirConOtraApp } from '../../chat/guardarYCompartir';
import { PdfViewerScreen } from '../../chat/pdf/PdfViewerScreen';
import { VisorDelChat } from '../../chat/VisorDelChat';
import { galleryOf, mimeOf, openingOf, pdfsOf, viewerWhenOf, type ViewableFile } from '@lilachat/shared';

type Session = { files: ViewableFile[]; url: string; action?: ViewerAction };
export type ViewerAction = { label: string; onPress: () => void };

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

  const open = useCallback((file: ViewableFile, siblings?: readonly ViewableFile[], action?: ViewerAction) => {
    const opening = openingOf(mimeOf(file));
    const picked = action ? { action: { label: action.label, onPress: () => { setSession(null); action.onPress(); } } } : {};
    if (opening === 'gallery' || (opening === 'pdf' && pdfPages)) return setSession({ files: [...(siblings ?? [file])], url: file.url, ...picked });
    void abrirConOtraApp({ url: file.url, cuando: new Date(), mime: mimeOf(file), seq: 0, nombre: file.name }).then((result) => {
      if (!result.ok) say(result.motivo);
    });
  }, [say]);

  const photos = useMemo(() => galleryOf(session?.files ?? []).map((file, index) => ({ url: file.url, autor: file.name, cuando: viewerWhenOf(file.when), seq: index + 1, mia: false, cuandoReal: new Date(), mime: mimeOf(file), nombre: file.name, ...(file.thumbUrl ? { miniatura: file.thumbUrl } : {}) })), [session]);
  const pdfs = useMemo(() => pdfsOf(session?.files ?? []).map((file, index) => ({ seq: index + 1, url: file.url, name: file.name, at: new Date().toISOString(), mime: 'application/pdf' })), [session]);
  const photoSeq = photos.find((photo) => photo.url === session?.url)?.seq ?? null;
  const pdf = pdfs.find((one) => one.url === session?.url) ?? null;

  const moveTo = (url: string | undefined) => setSession((current) => (current && url ? { ...current, url } : null));
  const viewer = (
    <>
      <VisorDelChat fotos={photos} viendoSeq={photoSeq} onCambiar={(seq) => moveTo(photos.find((photo) => photo.seq === seq)?.url)} onEliminar={cannotDelete} onError={say} {...(session?.action ? { action: session.action } : {})} />
      <PdfViewerScreen pdf={pdf} others={pdfs} onPick={(seq) => moveTo(pdfs.find((one) => one.seq === seq)?.url)} onClose={() => setSession(null)} />
    </>
  );
  return { open, viewer, notice };
}
