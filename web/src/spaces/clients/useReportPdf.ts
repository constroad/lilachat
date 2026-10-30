import { useCallback, useEffect, useRef, useState } from 'react';
import { askReportPdfUntilDone, reportPdfPath, type ReportPdfBody } from '@lilachat/shared';
import { api } from '../../api';
import type { ServiceAskTarget } from './useServiceAsk';

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * A report's PDF asked to Portal when clicked (agentes 30/10,
 * `client.report.requested`): asked again after each wait while Portal
 * generates it. Ready, its link shows in the sheet: a tab opened after the
 * waits would be blocked as a popup. Closing the sheet stops asking.
 */
export function useReportPdf(target: ServiceAskTarget, serviceId: string) {
  const { jwt, spaceId, clientId } = target;
  const [asking, setAsking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [readyUrl, setReadyUrl] = useState<string | null>(null);
  const turn = useRef(0);
  const stop = useCallback(() => {
    turn.current += 1;
    setAsking(false);
    setMessage(null);
    setReadyUrl(null);
  }, []);
  useEffect(() => stop, [stop]);
  const ask = useCallback(async (reportId: string) => {
    const mine = ++turn.current;
    setAsking(true);
    setMessage(null);
    const askOnce = async (): Promise<ReportPdfBody> => {
      const response = await api<ReportPdfBody>(reportPdfPath(spaceId, clientId, serviceId, reportId), { jwt });
      return response.ok ? response.data : { message: response.message };
    };
    const step = await askReportPdfUntilDone(askOnce, () => mine === turn.current, pause);
    if (!step) return;
    setAsking(false);
    if (step.kind === 'open') setReadyUrl(step.url);
    else setMessage(step.message);
  }, [jwt, spaceId, clientId, serviceId]);
  return { ask, stop, asking, message, readyUrl };
}
