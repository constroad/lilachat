import { useEffect, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import type { ContactNote } from '@lilachat/shared';
import { saveRoutines } from './routinesApi';

/** «Recordar la próxima vez que hables» (pending 17): my note on top of the 1:1. «Listo» clears it; the X hides it for now. */
export function ContactNoteBannerWeb(props: { chatId: string; jwt: string; note?: ContactNote }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    setHidden(false);
  }, [props.note?.text]);
  if (!props.note || hidden) return null;
  const done = async () => {
    setHidden(true);
    if (await saveRoutines(props.jwt, props.chatId, { contactNote: null })) setHidden(false);
  };
  return (
    <div data-testid="aviso-nota-contacto" className="flex items-center gap-3 border-b border-primary/20 bg-primary/[0.06] px-4 py-2 text-[14px]">
      <BellRing size={16} className="shrink-0 text-primary" />
      <span className="min-w-0 flex-1">{props.note.text}</span>
      <button type="button" data-testid="btn-nota-lista" onClick={() => void done()} className="rounded-full px-3 py-1 text-[13px] font-semibold text-primary hover:bg-primary/10">Listo</button>
      <button type="button" aria-label="Ocultar" onClick={() => setHidden(true)} className="grid h-8 w-8 place-items-center rounded-full text-on-surface-variant hover:bg-background"><X size={14} /></button>
    </div>
  );
}
