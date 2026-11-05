import { useCallback, useEffect, useRef, useState } from 'react';
import { readReportDraft, type ReportDraftResult } from '@lilachat/shared';
import type { ServiceAskTarget } from '../useServiceAsk';
import { askReportDraft } from './reportsApi';

/**
 * The report's document as Portal keeps it (spec INFORMES-DESDE-LILACHAT
 * §4.3): asked when the screen opens and again after every form answered.
 * `null` while the first ask is out; a later `reload` keeps what is on screen.
 * The id learnt from the first answer rides with the next asks.
 */
export function useFieldDocument(target: ServiceAskTarget, serviceId: string, type: string): { draft: ReportDraftResult | null; reload: () => void } {
  const { jwt, spaceId, clientId } = target;
  const [draft, setDraft] = useState<ReportDraftResult | null>(null);
  const [round, setRound] = useState(0);
  const reportId = useRef<string | null>(null);
  const reload = useCallback(() => setRound((count) => count + 1), []);
  useEffect(() => {
    let alive = true;
    void askReportDraft({ jwt, spaceId, clientId }, serviceId, type, reportId.current).then((response) => {
      if (!alive) return;
      const read = readReportDraft(response.ok ? response.data : { message: response.message });
      if (read.ok && read.document.id) reportId.current = read.document.id;
      setDraft(read);
    });
    return () => {
      alive = false;
    };
  }, [jwt, spaceId, clientId, serviceId, type, round]);
  return { draft, reload };
}
