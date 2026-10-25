import type { OutsideMentionsWeb } from './useOutsideMentionsWeb';

/** The line over the field that offers to add the people a message mentioned who are not in the channel. */
export function OutsideMentionNotice({ outside }: { outside: OutsideMentionsWeb }) {
  const { prompt, done, error, busy } = outside;
  if (!prompt && !done) return null;
  return (
    <div data-testid="aviso-mencion-fuera" role="status" className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-background px-3 py-2 text-[13px] text-on-surface-variant">
      <span className="min-w-0 flex-1">{prompt ? prompt.message : done}</span>
      {error ? <span data-testid="error-mencion-fuera" role="alert" className="w-full text-[12px] text-error">{error}</span> : null}
      {prompt ? (
        <span className="flex gap-4">
          <button type="button" data-testid="btn-agregar-mencion-fuera" disabled={busy} onClick={() => void outside.add()} className="min-h-[32px] font-semibold text-primary disabled:opacity-50">
            {busy ? 'Agregando…' : prompt.action}
          </button>
          <button type="button" data-testid="btn-descartar-mencion-fuera" onClick={outside.dismiss} className="min-h-[32px]">
            Ahora no
          </button>
        </span>
      ) : null}
    </div>
  );
}
