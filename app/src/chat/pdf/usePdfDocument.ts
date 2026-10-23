import { useEffect, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { pdfPages } from '../../../modules/pdf-pages/src';
import type { PdfPageSize } from './pdfLayout';
import { pdfCacheName, pdfFailureFrom, type ChatPdf, type PdfFailure } from './pdfSource';

export type PdfDocumentState = { status: 'loading' } | { status: 'ready'; id: string; pages: PdfPageSize[] } | { status: 'failed'; failure: PdfFailure };

async function downloadPdf(pdf: ChatPdf): Promise<string> {
  const target = `${FileSystem.cacheDirectory}${pdfCacheName(pdf.seq)}`;
  const existing = await FileSystem.getInfoAsync(target);
  if (existing.exists && existing.size > 0) return target;
  const download = await FileSystem.downloadAsync(pdf.url, target).catch(() => null);
  if (!download || download.status < 200 || download.status >= 300) {
    await FileSystem.deleteAsync(target, { idempotent: true }).catch(() => undefined);
    throw Object.assign(new Error('download failed'), { code: 'ERR_PDF_DOWNLOAD' });
  }
  return download.uri;
}

/**
 * The open PDF (pending 7): download to the cache, open with the native
 * renderer and, on leaving, close it so its drawn pages are deleted. `attempt`
 * changes to retry after a failure.
 */
export function usePdfDocument(pdf: ChatPdf | null, attempt: number): PdfDocumentState {
  const [state, setState] = useState<PdfDocumentState>({ status: 'loading' });

  useEffect(() => {
    if (!pdf || !pdfPages) return;
    const renderer = pdfPages;
    let alive = true;
    let openedId: string | null = null;
    setState({ status: 'loading' });
    void downloadPdf(pdf)
      .then((uri) => renderer.open(uri))
      .then((opened) => {
        openedId = opened.id;
        if (!alive) return void renderer.close(opened.id);
        setState({ status: 'ready', id: opened.id, pages: opened.pages });
      })
      .catch((error: unknown) => alive && setState({ status: 'failed', failure: pdfFailureFrom(error) }));
    return () => {
      alive = false;
      if (openedId) void renderer.close(openedId);
    };
  }, [pdf, attempt]);

  return state;
}
