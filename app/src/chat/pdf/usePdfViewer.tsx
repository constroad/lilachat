import { useCallback, useMemo, useRef, useState } from 'react';
import { pdfPages } from '../../../modules/pdf-pages/src';
import { chatPdfs } from './pdfSource';
import { PdfViewerScreen } from './PdfViewerScreen';

type MessageLike = Parameters<typeof chatPdfs>[0][number];

/**
 * The chat's PDF viewer (pending 7): `open(seq)` shows it when that message is
 * a PDF and this build has the renderer, and answers `false` otherwise so the
 * caller keeps opening it as before (another app). `open` is stable: the
 * bubbles are `memo`.
 */
export function usePdfViewer(messages: readonly MessageLike[]) {
  const pdfs = useMemo(() => chatPdfs(messages), [messages]);
  const pdfsRef = useRef(pdfs);
  pdfsRef.current = pdfs;
  const [openSeq, setOpenSeq] = useState<number | null>(null);
  const open = useCallback((seq: number) => {
    if (!pdfPages || !pdfsRef.current.some((pdf) => pdf.seq === seq)) return false;
    setOpenSeq(seq);
    return true;
  }, []);
  const viewer = <PdfViewerScreen pdf={pdfs.find((pdf) => pdf.seq === openSeq) ?? null} others={pdfs} onPick={setOpenSeq} onClose={() => setOpenSeq(null)} />;
  return { open, viewer };
}
