import type { ReactNode } from 'react';

export type OptionProps = { testId: string; icon: ReactNode; title: string; badge?: string; hint?: string; checked: boolean; disabled: boolean; onSelect: () => void; children?: ReactNode };

/** One radio card of «Sonido del sticker»: only the chosen one opens its content. */
export function SoundOption({ testId, icon, title, badge, hint, checked, disabled, onSelect, children }: OptionProps) {
  return (
    <div className={`rounded-xl border p-3 transition-colors ${checked ? 'border-primary bg-primary/5' : 'border-outline/20'}`}>
      <button type="button" role="radio" aria-checked={checked} data-testid={testId} disabled={disabled} onClick={onSelect} className="flex w-full items-center gap-3 text-left disabled:opacity-60">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${checked ? 'bg-primary text-on-primary' : 'bg-primary/10 text-primary'}`}>{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-[14px] font-semibold text-on-surface">{title}{badge ? <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">{badge}</span> : null}</span>
          {hint ? <span className="block truncate text-[12px] text-on-surface-variant">{hint}</span> : null}
        </span>
        <span aria-hidden className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${checked ? 'border-primary' : 'border-outline/40'}`}>{checked ? <span className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}</span>
      </button>
      {children}
    </div>
  );
}
