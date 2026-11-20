import { LILACHAT_WEB_URL } from './spaceSections.js';

/**
 * The public legal pages Google Play asks for (spec PLAY-STORE): the privacy
 * policy and the child-safety standards. They live on the web, without a
 * session, and the APK opens them in the browser.
 */
export type LegalPageId = 'privacy' | 'childSafety';

export const LEGAL_PAGE_PATHS: Readonly<Record<LegalPageId, string>> = {
  privacy: '/privacidad',
  childSafety: '/seguridad-infantil',
};

/** The account-deletion page (another change owns it); the privacy policy links to it. */
export const ACCOUNT_DELETION_PATH = '/borrar-cuenta';

/** The footer of the sign-in screens, web and APK: «Privacidad · Seguridad infantil». */
export const LEGAL_FOOTER_LINKS: readonly { id: LegalPageId; label: string }[] = [
  { id: 'privacy', label: 'Privacidad' },
  { id: 'childSafety', label: 'Seguridad infantil' },
];

/** Which legal page an address is, tolerating a trailing slash and any case; `null` for every other address. */
export function legalPageOf(pathname: string): LegalPageId | null {
  const normalized = pathname.replace(/\/+$/, '').toLowerCase();
  const found = (Object.keys(LEGAL_PAGE_PATHS) as LegalPageId[]).find((id) => LEGAL_PAGE_PATHS[id] === normalized);
  return found ?? null;
}

/** The full address, for the APK, which opens it in the browser. */
export const legalPageUrl = (id: LegalPageId): string => `${LILACHAT_WEB_URL}${LEGAL_PAGE_PATHS[id]}`;

/** A block of a legal page: a title, its paragraphs, an optional list and optional links. */
export type LegalSection = {
  title: string;
  paragraphs?: readonly string[];
  bullets?: readonly string[];
  links?: readonly { label: string; href: string }[];
};

export type LegalDocument = {
  title: string;
  /** «Última actualización: …», shown under the title. */
  updatedOn: string;
  intro: string;
  sections: readonly LegalSection[];
};
