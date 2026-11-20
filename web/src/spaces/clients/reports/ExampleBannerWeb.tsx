import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { EXAMPLE_BANNER_ACTION, EXAMPLE_BANNER_ASK, EXAMPLE_BANNER_CLOSE, exampleDismissKeys, exampleBannerLine, isExampleDismissed, parseExampleDismissed, runExampleFill, showsExampleBanner, withExampleDismissed, type ExampleFiller, type ExampleOutcome, type ExampleProgress, type FieldDocument } from '@lilachat/shared';

/** The reports whose banner this browser closed. */
const DISMISSED_KEY = 'lilachat:informe-ejemplo-oculto';

function readDismissed(): string[] {
  try {
    return parseExampleDismissed(window.localStorage.getItem(DISMISSED_KEY));
  } catch (error) {
    console.warn('[informe] no se pudo leer el aviso de ejemplo oculto:', error instanceof Error ? error.message : error);
    return [];
  }
}

function storeDismissed(keys: readonly string[]): void {
  try {
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(withExampleDismissed(readDismissed(), keys)));
  } catch (error) {
    console.warn('[informe] no se pudo guardar el aviso de ejemplo oculto:', error instanceof Error ? error.message : error);
  }
}

type Props = { report: FieldDocument; serviceId: string; type: string; onFill: ExampleFiller };

/**
 * «¿Probando? · Completar datos de ejemplo» over a draft's sections (José 20/11, design imp-05): fills every
 * section that has Portal's example, one save after another; closed, this browser does not show it again
 * for the report.
 */
export function ExampleBannerWeb(props: Props) {
  const keys = exampleDismissKeys(props.serviceId, props.type, props.report.id);
  const [dismissed, setDismissed] = useState(() => isExampleDismissed(readDismissed(), keys));
  const [progress, setProgress] = useState<ExampleProgress | null>(null);
  const [outcome, setOutcome] = useState<ExampleOutcome | null>(null);
  if (dismissed || (!showsExampleBanner(props.report) && !progress && !outcome)) return null;
  const fill = async () => {
    setOutcome(null);
    setProgress({ done: 0, total: 0 });
    const ended = await runExampleFill(props.onFill, setProgress);
    setProgress(null);
    setOutcome(ended);
  };
  const close = () => {
    storeDismissed(keys);
    setDismissed(true);
  };
  const line = exampleBannerLine(progress, outcome);
  return (
    <section data-testid="aviso-datos-ejemplo" className="rounded-2xl border border-primary/30 bg-primary/10 p-3">
      <div className="flex items-center gap-2">
        <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary"><Sparkles size={18} /></span>
        <span className="min-w-0 shrink truncate text-[14px] font-semibold">{EXAMPLE_BANNER_ASK}</span>
        <button type="button" data-testid="completar-datos-ejemplo" disabled={Boolean(progress)} onClick={() => void fill()} className="ml-auto inline-flex min-h-11 min-w-0 items-center justify-center rounded-xl border border-primary/40 bg-primary/15 px-3 text-[13px] font-semibold text-primary hover:bg-primary/20 disabled:opacity-60">
          <span className="truncate">{EXAMPLE_BANNER_ACTION}</span>
        </button>
        <button type="button" data-testid="ocultar-datos-ejemplo" aria-label={EXAMPLE_BANNER_CLOSE} disabled={Boolean(progress)} onClick={close} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-on-surface-variant hover:bg-on-surface/5 disabled:opacity-60"><X size={18} /></button>
      </div>
      {line ? <p role="status" data-testid="aviso-datos-ejemplo-estado" className={`mt-2 text-[13px] ${outcome?.failed ? 'text-error' : 'text-on-surface-variant'}`}>{line}</p> : null}
    </section>
  );
}
