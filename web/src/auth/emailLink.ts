import { useEffect, useState } from 'react';
import { normalizeEmail } from '@lilachat/shared';

const CALLBACK_PATH = '/login/callback';
const CODE_PATTERN = /^\d{6}$/;

export type EmailLink = { email: string; code: string };

/** The button of the code email: `/login/callback?d=<destination>&c=<code>` (constroad-auth). A phone in `d` is no link. */
export function emailLinkOf(pathname: string, search: string): EmailLink | null {
  if (pathname !== CALLBACK_PATH) return null;
  const query = new URLSearchParams(search);
  const email = normalizeEmail(query.get('d'));
  const code = query.get('c') ?? '';
  return email && CODE_PATTERN.test(code) ? { email, code } : null;
}

/** Read once; the code leaves the address at once, so it stays out of the history. */
export function useEmailLink(): EmailLink | null {
  const [link] = useState(() => emailLinkOf(window.location.pathname, window.location.search));
  useEffect(() => {
    if (window.location.pathname === CALLBACK_PATH) window.history.replaceState(null, '', '/');
  }, []);
  return link;
}
