import { useCallback, useEffect, useMemo, useRef } from 'react';
import { answeredSince, publishFormRequest, REPORT_KEEPER, sectionFormOf, sectionFormRequest, sectionNeedsPlace, type FieldDocument, type SectionPath } from '@lilachat/shared';
import { useAppAnswers } from '../../../chat/commands/useAppAnswers';
import type { ServiceAskTarget } from '../useServiceAsk';
import { devicePlaceNow } from './devicePlace';
import { openReportForm } from './reportsApi';

const PUBLISH_LABEL = 'Publicar informe';

/**
 * The report's forms run in the client's channel (the server opens each as a
 * run of the app there): a section, a photo or «Publicar» opens in the form
 * sheet, and every form answered asks the document again. The same wiring
 * as `SpaceActionButton`, with the request built from the document.
 */
export function useReportForms(target: ServiceAskTarget, chatId: string, serviceId: string, onAnswered: () => void) {
  const scope = useMemo(() => ({ chatId }), [chatId]);
  const answers = useAppAnswers({ jwt: target.jwt, scope });
  const seen = useRef(new Set<string>());
  useEffect(() => {
    const fresh = answeredSince(answers.answers, seen.current);
    fresh.forEach((id) => seen.current.add(id));
    if (fresh.length) onAnswered();
  }, [answers.answers, onAnswered]);
  const { track } = answers;
  const openSection = useCallback(
    async (document: FieldDocument, path: SectionPath): Promise<boolean> => {
      const place = sectionNeedsPlace(document, path) ? await devicePlaceNow() : null;
      const request = sectionFormRequest(document, path, place);
      const title = sectionFormOf(document, path)?.title ?? path.key;
      return track({ appName: REPORT_KEEPER, command: '', action: title }, () => openReportForm(target, serviceId, request));
    },
    [track, target, serviceId]
  );
  const openPublish = useCallback(
    (document: FieldDocument): Promise<boolean> => {
      const request = publishFormRequest(document);
      return request ? track({ appName: REPORT_KEEPER, command: '', action: PUBLISH_LABEL }, () => openReportForm(target, serviceId, request)) : Promise.resolve(false);
    },
    [track, target, serviceId]
  );
  return { answers, openSection, openPublish };
}
