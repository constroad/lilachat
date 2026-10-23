import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { notesToShow, RELEASE_NOTES, type ReleaseNote } from '@lilachat/shared';
import { Overlay } from './Overlay';

const SEEN_KEY = 'lilachat.novedades.vista';
/** The web is always the newest build: its version is the catalog's first. */
const WEB_VERSION = RELEASE_NOTES[0]?.version ?? '';

function readSeen(): string | null {
  try {
    return window.localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

/**
 * «Novedades» after the web updates (pending 66, José 23/10), like WhatsApp
 * Web's «What's new»: once per version, then «Entendido». Same catalog as the
 * app and the LilaStore notes.
 */
export function WhatsNewDialog() {
  const [notes, setNotes] = useState<ReleaseNote[]>(() => (WEB_VERSION ? notesToShow(RELEASE_NOTES, readSeen(), WEB_VERSION) : []));
  if (notes.length === 0) return null;
  const close = () => {
    setNotes([]);
    try {
      window.localStorage.setItem(SEEN_KEY, WEB_VERSION);
    } catch {
      // Without storage it shows again next time, nothing worse.
    }
  };
  return (
    <Overlay
      title={`Novedades de Lilachat ${notes[0]?.version}`}
      onClose={close}
      footer={
        <button type="button" data-testid="btn-novedades-entendido" onClick={close} className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-on-primary">
          Entendido
        </button>
      }
    >
      <div data-testid="novedades-de-la-version" className="space-y-4">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary"><Sparkles size={22} /></span>
        {notes.map((note) => (
          <div key={note.version} className="space-y-2">
            {notes.length > 1 ? <p className="text-[12px] font-semibold uppercase tracking-wide text-on-surface-variant">Versión {note.version}</p> : null}
            <ul className="space-y-1.5">
              {note.items.map((item) => (
                <li key={item} className="flex gap-2 text-[14px] leading-[21px]"><span className="text-primary">•</span><span>{item}</span></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Overlay>
  );
}
