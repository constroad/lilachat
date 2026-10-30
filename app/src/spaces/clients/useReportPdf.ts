import { useCallback, useEffect, useRef, useState } from 'react';
import { askReportPdfUntilDone, reportPdfPath, type ReportPdfBody } from '@lilachat/shared';
import { BASE_URL } from '../../api/client';
import { jsonCall } from '../../api/jsonCall';
import type { ViewableFile } from '@lilachat/shared';
import type { ServiceAskTarget } from './useServiceAsk';

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
  const turn = useRef(0);
  const stop = useCallback(() => {
    turn.current += 1;
    setAsking(false);
    setMessage(null);
  }, []);
  useEffect(() => stop, [stop]);
  const ask = useCallback(async (reportId: string, name: string) => {
    const mine = ++turn.current;
    setAsking(true);
    setMessage(null);
    const askOnce = async (): Promise<ReportPdfBody> => {
      const response = await jsonCall<ReportPdfBody>(`${BASE_URL}/api${reportPdfPath(spaceId, clientId, serviceId, reportId)}`, jwt);
      return response.ok ? response.data : { message: response.message };
    };
    const step = await askReportPdfUntilDone(askOnce, () => mine === turn.current, pause);
    if (!step) return;
    setAsking(false);
    if (step.kind === 'open') onReady({ url: step.url, name, mime: PDF_MIME });
    else setMessage(step.message);
  }, [jwt, spaceId, clientId, serviceId, onReady]);
  return { ask, stop, asking, message };
}
