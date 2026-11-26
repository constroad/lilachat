import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VisitDocument } from '@lilachat/shared';
import { spaceDiskKey } from '../spaceCache';

/**
 * The visits this phone saw, kept for a site without signal (José 26/11): the
 * space's template (a new visit's forms and questions, `id: null`) and each
 * visit by its id. Under the space's cache prefix: logout and leaving the
 * space remove them. What the server sends replaces them every time.
 */
const templateKey = (spaceId: string) => spaceDiskKey(`${spaceId}:visit-template`);
const visitKey = (spaceId: string, visitId: string) => spaceDiskKey(`${spaceId}:visit:${visitId}`);

function documentOf(raw: string | null): VisitDocument | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as VisitDocument;
    return parsed && Array.isArray(parsed.sections) && Array.isArray(parsed.points) ? parsed : null;
  } catch {
    return null;
  }
}

export function keepVisitCopy(spaceId: string, document: VisitDocument): void {
  const key = document.id ? visitKey(spaceId, document.id) : templateKey(spaceId);
  AsyncStorage.setItem(key, JSON.stringify(document)).catch(() => undefined);
}

export const readVisitTemplate = async (spaceId: string): Promise<VisitDocument | null> => documentOf(await AsyncStorage.getItem(templateKey(spaceId)).catch(() => null));
export const readVisitCopy = async (spaceId: string, visitId: string): Promise<VisitDocument | null> => documentOf(await AsyncStorage.getItem(visitKey(spaceId, visitId)).catch(() => null));

/** A template younger than this is not asked again just to have it offline. */
const TEMPLATE_MAX_AGE_MS = 6 * 3_600_000;
const askedAt = new Map<string, number>();

/**
 * A chat whose ⚡ offers «Visita técnica» keeps the space's template ready (José 26/11): the first visit
 * at a site without signal needs its forms and questions. Reading a visit without an id writes nothing in
 * Portal (`showSiteVisit`, verified 26/11); at most once every 6 h per space and process.
 */
export function prefetchVisitTemplate(spaceId: string, ask: () => Promise<{ ok: true; data: unknown } | { ok: false }>, read: (reply: { ok: true; data: unknown } | { ok: false }) => VisitDocument | null): void {
  const last = askedAt.get(spaceId);
  if (last !== undefined && Date.now() - last < TEMPLATE_MAX_AGE_MS) return;
  askedAt.set(spaceId, Date.now());
  void ask().then((reply) => {
    const document = read(reply);
    if (document && !document.id) keepVisitCopy(spaceId, document);
  }).catch(() => undefined);
}
