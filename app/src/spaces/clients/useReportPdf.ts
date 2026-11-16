import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import { askReportPdfUntilDone, reportPdfPath, type ReportPdfBody } from '@lilachat/shared';
import { BASE_URL } from '../../api/client';
import { jsonCall } from '../../api/jsonCall';
import type { ViewableFile } from '@lilachat/shared';
import type { ServiceAskTarget } from './useServiceAsk';
import { ReportPreviewScreen } from './ReportPreviewScreen';

const PDF_MIME = 'application/pdf';
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * A report's PDF asked to Portal when tapped (agentes 30/10,
 * `client.report.requested`): while Portal generates it, asked again after
 * the wait it says, a few times; ready, it opens in the viewer. Closing the
 * sheet stops asking.
 */
export function useReportPdf(target: ServiceAskTarget, serviceId: string, onReady: (file: ViewableFile) => void) {
  const { jwt, spaceId, clientId } = target;
  const [asking, setAsking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const turn = useRef(0);
  const stop = useCallback(() => {
    turn.current += 1;
    setAsking(false);
    setMessage(null);
    setPreview(null);
  }, []);
  useEffect(() => stop, [stop]);
  const ask = useCallback(async (reportId: string, name: string, draft = false) => {
    const mine = ++turn.current;
    setAsking(true);
    setMessage(null);
    const askOnce = async (): Promise<ReportPdfBody> => {
      const response = await jsonCall<ReportPdfBody>(`${BASE_URL}/api${reportPdfPath(spaceId, clientId, serviceId, reportId, draft)}`, jwt);
      return response.ok ? response.data : { message: response.message };
    };
    const step = await askReportPdfUntilDone(askOnce, () => mine === turn.current, pause);
    if (!step) return;
    setAsking(false);
    // A draft's preview is Portal's signed page of the sheets, not a PDF file: it opens inside Lilachat,
    // fitted to the screen with zoom (José 15/11: in the browser only its left side showed).
    if (step.kind === 'open' && draft) setPreview({ url: step.url, name: name.replace(/\.pdf$/i, '') });
    else if (step.kind === 'open') onReady({ url: step.url, name, mime: PDF_MIME });
    else setMessage(step.message);
  }, [jwt, spaceId, clientId, serviceId, onReady]);
  const viewer = preview ? createElement(ReportPreviewScreen, { url: preview.url, title: preview.name, onClose: () => setPreview(null) }) : null;
  return { ask, stop, asking, message, viewer };
}
