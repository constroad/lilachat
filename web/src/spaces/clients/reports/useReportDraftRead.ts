import { useCallback, useEffect, useState } from 'react';
import type { ReportDraftBody } from '@lilachat/shared';
import { askReportDraft } from './reportsApi';
import type { ServiceAskTarget } from '../useServiceAsk';

/**
 * A report as Portal answers it, read with the screen's own reader (an
 * observation report, an additional area). A first write creates the report:
 * from then on its id is asked for.
 */
export function useReportDraftRead<R>(target: ServiceAskTarget, serviceId: string, type: string, reportId: string | null, read: (body: ReportDraftBody | null) => R) {
  const [draft, setDraft] = useState<R | null>(null);
  const [id, setId] = useState(reportId);
  const load = useCallback(async () => {
    const reply = await askReportDraft(target, serviceId, type, id);
    setDraft(read(reply.ok ? reply.data : { message: reply.message }));
  }, [target, serviceId, type, id, read]);
  useEffect(() => {
    void load();
  }, [load]);
  const reload = useCallback((nextId?: string) => {
    if (nextId && nextId !== id) setId(nextId);
    else void load();
  }, [id, load]);
  return { draft, reload };
}
