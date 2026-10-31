import { useEffect, useState } from 'react';
import { MUTE_OPTIONS, type MuteFor } from '@lilachat/shared';
import { Overlay } from '../ui/Overlay';

/**
 * «Silenciar notificaciones: 8 horas · 1 semana · Siempre», as WhatsApp Web
 * asks it (R31/10). Every «Silenciar» of the web (the list's menu, «Info.»)
 * goes through `askMuteDuration`; the dialog lives once, outside the Shell.
 */
type Ask = (muteFor: MuteFor | null) => void;
let show: ((answer: Ask) => void) | null = null;

/** How long to mute; `null` when cancelled. Without the dialog mounted, siempre (as before). */
export function askMuteDuration(): Promise<MuteFor | null> {
  return new Promise((resolve) => {
    if (show) show(resolve);
    else resolve('always');
  });
}

export function MuteDialogHost() {
  const [answer, setAnswer] = useState<Ask | null>(null);
  const [choice, setChoice] = useState<MuteFor>('8h');
  useEffect(() => {
    show = (next) => {
      setChoice('8h');
      setAnswer(() => next);
    };
    return () => {
      show = null;
    };
  }, []);
  if (!answer) return null;
  const close = (muteFor: MuteFor | null) => {
    setAnswer(null);
    answer(muteFor);
  };
  return (
    <Overlay
      title="Silenciar notificaciones"
      onClose={() => close(null)}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => close(null)} className="h-10 rounded-full px-4 text-[14px] font-semibold text-on-surface-variant hover:bg-background">Cancelar</button>
          <button type="button" data-testid="confirmar-silenciar" onClick={() => close(choice)} className="h-10 rounded-full bg-primary px-5 text-[14px] font-semibold text-on-primary">Silenciar</button>
        </div>
      }
    >
      <p className="mb-3 text-[13px] text-on-surface-variant">Los demás no sabrán que silenciaste este chat.</p>
      <div role="radiogroup" aria-label="Por cuánto tiempo" className="space-y-1">
        {MUTE_OPTIONS.map((option) => (
          <label key={option.key} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-background">
            <input type="radio" name="silenciar-por" data-testid={`silenciar-${option.key}`} checked={choice === option.key} onChange={() => setChoice(option.key)} className="h-4 w-4 accent-primary" />
            <span className="text-[15px]">{option.label}</span>
          </label>
        ))}
      </div>
    </Overlay>
  );
}
