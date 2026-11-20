import { Fragment } from 'react';
import { LEGAL_FOOTER_LINKS, LEGAL_PAGE_PATHS } from '@lilachat/shared';

/** «Privacidad · Seguridad infantil» under the sign-in screens and the legal pages (spec PLAY-STORE). */
export function LegalFooter({ className = '' }: { className?: string }) {
  return (
    <footer data-testid="pie-legal" className={`flex items-center justify-center gap-2 px-4 py-4 text-xs text-on-surface-variant ${className}`}>
      {LEGAL_FOOTER_LINKS.map((link, index) => (
        <Fragment key={link.id}>
          {index > 0 ? <span aria-hidden="true">·</span> : null}
          <a href={LEGAL_PAGE_PATHS[link.id]} className="py-2 hover:underline">{link.label}</a>
        </Fragment>
      ))}
    </footer>
  );
}
