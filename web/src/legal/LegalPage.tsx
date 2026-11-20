import { legalPageOf, type LegalDocument, type LegalPageId, type LegalSection } from '@lilachat/shared';
import { Logo } from '../ui/Logo';
import { CHILD_SAFETY_STANDARDS } from './childSafety';
import { PRIVACY_POLICY } from './privacyPolicy';
import { LegalFooter } from './LegalFooter';

const DOCUMENTS: Readonly<Record<LegalPageId, LegalDocument>> = {
  privacy: PRIVACY_POLICY,
  childSafety: CHILD_SAFETY_STANDARDS,
};

/** The legal page this address shows, if any: public, with or without a session. */
export const legalPageHere = (): LegalPageId | null => legalPageOf(window.location.pathname);

/** A public legal page (`/privacidad`, `/seguridad-infantil`): readable without a session, phone first. */
export function LegalPage({ page }: { page: LegalPageId }) {
  const legalDocument = DOCUMENTS[page];
  return (
    <div className="min-h-full bg-background" data-testid={`pagina-legal-${page}`}>
      <main className="mx-auto w-full max-w-2xl px-4 pb-6 pt-8 sm:pt-12">
        <a href="/" className="mb-8 flex w-fit items-center gap-2 text-on-surface">
          <Logo size={32} />
          <span className="text-lg font-bold">Lilachat</span>
        </a>
        <h1 className="text-2xl font-bold leading-tight text-on-surface sm:text-3xl">{legalDocument.title}</h1>
        <p className="mt-2 text-sm text-on-surface-variant">Última actualización: {legalDocument.updatedOn}</p>
        <p className="mt-6 text-base leading-relaxed text-on-surface">{legalDocument.intro}</p>
        {legalDocument.sections.map((section) => (
          <LegalSectionBlock key={section.title} section={section} />
        ))}
      </main>
      <LegalFooter />
    </div>
  );
}

function LegalSectionBlock({ section }: { section: LegalSection }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-on-surface">{section.title}</h2>
      {section.paragraphs?.map((paragraph) => (
        <p key={paragraph} className="mt-3 text-base leading-relaxed text-on-surface">{paragraph}</p>
      ))}
      {section.bullets ? (
        <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-relaxed text-on-surface">
          {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
        </ul>
      ) : null}
      {section.links?.map((link) => (
        <a key={link.href} href={link.href} className="mt-3 inline-block font-semibold text-primary underline-offset-2 hover:underline">
          {link.label}
        </a>
      ))}
    </section>
  );
}
