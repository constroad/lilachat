import { Plus } from 'lucide-react';
import { WORK_MAP_FIRST } from '@lilachat/shared';
import { KICKER } from './WorkMapPanel';

/** Design o-10: a service without streets, and where to draw them (José 07/11: everyone draws and updates). */
export function WorkMapFirst({ drawUrl }: { drawUrl: string | null }) {
  return (
    <section data-testid="mapa-primera-calle" className="rounded-2xl border border-outline/15 bg-surface p-5">
      <p className={`${KICKER} text-primary`}>{WORK_MAP_FIRST.kicker}</p>
      <h3 className="mt-1 text-xl font-bold tracking-tight">{WORK_MAP_FIRST.title}</h3>
      <p className="mt-1 text-[14px] text-on-surface-variant">{WORK_MAP_FIRST.hint}</p>
      <ol className="mt-4 divide-y divide-outline/10 rounded-xl border border-outline/15 bg-background">
        {WORK_MAP_FIRST.steps.map((step, index) => (
          <li key={step} className="flex items-center gap-3 px-3 py-2.5 text-[14px] font-semibold">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-primary/30 text-[12px] text-primary">{index + 1}</span>
            {step}
          </li>
        ))}
      </ol>
      {drawUrl ? (
        <a data-testid="mapa-dibujar-portal" href={drawUrl} target="_blank" rel="noopener noreferrer" className="mt-4 flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-semibold text-on-primary">
          <Plus size={18} />
          {WORK_MAP_FIRST.action}
        </a>
      ) : null}
      <p className="mt-2 text-center text-[12px] text-on-surface-variant">{WORK_MAP_FIRST.where}</p>
    </section>
  );
}
