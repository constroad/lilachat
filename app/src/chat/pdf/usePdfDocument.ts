import { useEffect, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { pdfPages } from '../../../modules/pdf-pages/src';
import type { PdfPageSize } from './pdfLayout';
import { pdfReadinessOf, untilPdfReady } from '@lilachat/shared';
import { pdfCacheName, pdfDownloadCodeOf, pdfFailureFrom, type ChatPdf, type PdfFailure } from './pdfSource';

export type PdfDocumentState = { status: 'loading' } | { status: 'ready'; id: string; pages: PdfPageSize[] } | { status: 'failed'; failure: PdfFailure };

const NETWORK_FAILED = 0;
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const downloadFailed = (code: string) => Object.assign(new Error('download failed'), { code });

/** One try: what came stays only when it is the PDF (a 202 «generating» body is not, quote-pdf 31/10). */
async function downloadOnce(url: string, target: string): Promise<{ status: number; retryAfter?: string | null }> {
  const download = await FileSystem.downloadAsync(url, target).catch(() => null);
  const status = download?.status ?? NETWORK_FAILED;
  if (pdfReadinessOf(status) !== 'ready') await FileSystem.deleteAsync(target, { idempotent: true }).catch(() => undefined);
  return { status, retryAfter: download?.headers['Retry-After'] ?? download?.headers['retry-after'] };
}

async function downloadPdf(pdf: ChatPdf): Promise<string> {
  // A secret chat's PDF is already decrypted on the phone (pending 118): open it where it is.
  if (pdf.url.startsWith('file:')) return pdf.url;
  const target = `${FileSystem.cacheDirectory}${pdfCacheName(pdf.url)}`;
  const existing = await FileSystem.getInfoAsync(target);
  if (existing.exists && existing.size > 0) return target;
  // Portal answers 202 while it generates a quote's PDF: ask again as it says.
  const code = pdfDownloadCodeOf(await untilPdfReady(() => downloadOnce(pdf.url, target), pause));
  if (code) throw downloadFailed(code);
  return target;
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
