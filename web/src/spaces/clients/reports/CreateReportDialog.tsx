import { ChevronRight, ClipboardCheck, Droplets, FileSignature, Hammer, Layers, Square, Truck, UserCheck, type LucideIcon } from 'lucide-react';
import { REPORT_TYPE_OPTIONS, type ReportTypeOption } from '@lilachat/shared';
import { Overlay } from '../../../ui/Overlay';

const ICONS: Record<string, LucideIcon> = { 'CTL-IMP': Droplets, IAA: Square, 'CTL-PIS': Truck, 'CON-CAP': Layers, 'RCP-CAM': UserCheck, 'LEV-OBS': ClipboardCheck, 'FRE-PAV': Hammer, 'SOL-IMP': FileSignature };
const ROW = 'flex min-h-[64px] w-full items-center gap-3 rounded-xl border bg-surface px-3 py-2.5 text-left';

function TypeIcon({ code }: { code: string }) {
  const Icon = ICONS[code] ?? Droplets;
  return <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Icon size={20} /></span>;
}

function TypeText({ option }: { option: ReportTypeOption }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[15px] font-semibold">{option.label}</span>
      <span className="block truncate text-[12px] text-on-surface-variant">{option.caption}</span>
    </span>
  );
}

/** A type Lilachat does not fill yet: the service in Portal, in a new tab, with the «En Portal» pill. */
function PortalRow({ option, portalUrl }: { option: ReportTypeOption; portalUrl?: string }) {
  const body = (
    <>
      <TypeIcon code={option.code} />
      <TypeText option={option} />
      <span className="rounded-md bg-surface-variant px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant">En Portal</span>
      <ChevronRight size={18} className="shrink-0 text-on-surface-variant" />
    </>
  );
  if (!portalUrl) return <div data-testid={`tipo-informe-${option.code}`} className={`${ROW} border-outline/15 opacity-50`}>{body}</div>;
  return <a data-testid={`tipo-informe-${option.code}`} href={portalUrl} target="_blank" rel="noreferrer" className={`${ROW} border-outline/15 hover:border-primary/40`}>{body}</a>;
}

/**
 * «Crear informe» (design j-01): the eight types of Portal's public page.
 * Only the ones Lilachat fills open here; the rest open the service in Portal
 * until their turn comes (spec INFORMES-DESDE-LILACHAT §5).
 */
export function CreateReportDialog(props: { portalUrl?: string; onPick: (code: string) => void; onClose: () => void }) {
  return (
    <Overlay title="¿Qué informe vas a hacer?" onClose={props.onClose}>
      <div data-testid="crear-informe-tipos" className="flex flex-col gap-2">
        <p className="-mt-1 mb-1 text-sm text-on-surface-variant">Se guarda como borrador mientras lo llenas</p>
        {REPORT_TYPE_OPTIONS.map((option) =>
          option.opensHere ? (
            <button key={option.code} type="button" data-testid={`tipo-informe-${option.code}`} onClick={() => props.onPick(option.code)} className={`${ROW} border-primary/40 hover:bg-primary/5`}>
              <TypeIcon code={option.code} />
              <TypeText option={option} />
              <ChevronRight size={18} className="shrink-0 text-primary" />
            </button>
          ) : (
            <PortalRow key={option.code} option={option} portalUrl={props.portalUrl} />
          )
        )}
      </div>
    </Overlay>
  );
}
