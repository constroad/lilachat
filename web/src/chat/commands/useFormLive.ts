import { useEffect, useMemo, useRef, useState } from 'react';
import { draftValues, type FormField, type FormValues, type PreviewReply } from '@lilachat/shared';

/** How long the person must stop typing before the app is asked (agentes 30/10: its budget is 3 s). */
export const LIVE_DEBOUNCE_MS = 600;
const NO_SUMMARY: PreviewReply = { blocks: [], errors: {} };

type Params = {
  fields: readonly FormField[];
  values: FormValues;
  /** `x-preview`: the form has a summary. */
  preview?: string;
  onRefresh?: (draft: FormValues) => Promise<void>;
  onPreview?: (draft: FormValues) => Promise<PreviewReply>;
};

/**
 * A form that lives while it is filled (agentes 2483da7): a new period asks
 * the app for the form again (`x-refresh`), and the app sums up the draft
 * above «Enviar» (`x-preview`). Only the newest summary is shown; a failing
 * one leaves none, never an error.
 */
export function useFormLive({ fields, values, preview, onRefresh, onPreview }: Params) {
  const draft = useMemo(() => draftValues(fields, values), [fields, values]);
  const refreshKey = JSON.stringify(fields.filter((field) => field.refresh).map((field) => values[field.name] ?? null));
  const draftKey = JSON.stringify(draft);
  const [summary, setSummary] = useState<PreviewReply>(NO_SUMMARY);
  const [refreshing, setRefreshing] = useState(false);
  const sentRefresh = useRef(refreshKey);
  const latest = useRef(0);

  useEffect(() => {
    if (!onRefresh || refreshKey === sentRefresh.current) return undefined;
    const timer = setTimeout(() => {
      sentRefresh.current = refreshKey;
      setRefreshing(true);
      void onRefresh(draft).finally(() => setRefreshing(false));
    }, LIVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // The draft travels as it is when the period settles; only the refresh fields start it.
  }, [refreshKey]);

  useEffect(() => {
    if (!preview || !onPreview) return undefined;
    const timer = setTimeout(() => {
      const call = ++latest.current;
      void onPreview(draft).then((reply) => {
        if (call === latest.current) setSummary(reply);
      });
    }, LIVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draftKey, preview]);

  return { summary, refreshing };
}
