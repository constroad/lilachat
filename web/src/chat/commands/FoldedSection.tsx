import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { sectionHasBlankRequired, sectionHasError, sectionSlug, type FormField, type FormValues } from '@lilachat/shared';

type Props = {
  label: string;
  /** The schema asked for it folded (`x-collapsed`). */
  collapsed: boolean;
  /** The fields of the section that are on screen. */
  fields: readonly FormField[];
  values: FormValues;
  errors: Readonly<Record<string, string>>;
  /** A form that wears design gst-02: its headers are small capitals. */
  designed: boolean;
  children: ReactNode;
};

/**
 * A header the person opens (agentes 13/11: «Corregir datos» under the steps of «Revisar gasto»). It starts folded when the
 * schema says so, and nothing required hides: it starts open if a required field inside is blank, and opens by itself when an
 * error lands inside. After that the person decides. The app's twin is `FoldedSection` there.
 */
export function FoldedSection(props: Props) {
  const failed = sectionHasError(props.fields, props.errors);
  const [open, setOpen] = useState(() => !props.collapsed || failed || sectionHasBlankRequired(props.fields, props.values));
  useEffect(() => {
    if (failed) setOpen(true);
  }, [failed]);
  const id = sectionSlug(props.label);
  return (
    <section data-testid={`seccion-${id}`} className={`rounded-2xl border ${failed ? 'border-error/40' : 'border-outline/15'}`}>
      <button type="button" data-testid={`seccion-${id}-cabecera`} aria-expanded={open} aria-controls={`seccion-${id}-cuerpo`} onClick={() => setOpen((was) => !was)} className="flex min-h-12 w-full items-center justify-between gap-2 rounded-2xl px-4 text-left hover:bg-on-surface/5">
        <span className={props.designed ? 'text-[10.5px] font-bold uppercase tracking-wider text-on-surface-variant' : 'text-[14px] font-semibold text-on-surface'}>{props.label}</span>
        <ChevronDown size={18} aria-hidden className={`shrink-0 text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? <div id={`seccion-${id}-cuerpo`} className="space-y-4 px-4 pb-4">{props.children}</div> : null}
    </section>
  );
}
