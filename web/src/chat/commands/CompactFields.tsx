import { useState, type ReactNode } from 'react';
import { AlertTriangle, Check, CheckCircle2, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { isBlankAnswer, openRoleOf, OPTIONAL_SAMPLE_LABEL, OPTIONAL_SAMPLE_TAG, roleCardsNote, sectionSlug, SAMPLES_NOTE, sampleColumnsOf, sampleRowMessage, sampleRowsOf, sampleTagOf, type FormField, type FormValues, type RoleCard, type SampleRow } from '@lilachat/shared';
import { FieldError } from '../../ui/Overlay';
import { Label } from './AppFormFields';

/**
 * The compact pieces of a CTL-IMP section (design imp-01/02/03, José 19/11): the lane as chips and the
 * trays as rows with their state. Only the look: the values are the same the plain fields write.
 */
type TextField = Extract<FormField, { kind: 'text' }>;
type SetValue = (name: string) => (value: unknown) => void;

/** A text picked from its chips; a value written before them stays as one more chip, picked. */
export function TextChipsField(props: { field: TextField; value: unknown; error?: string; onChange: (value: unknown) => void }) {
  const { field } = props;
  const current = typeof props.value === 'string' ? props.value : '';
  const chips = field.chips ?? [];
  const options = current && !chips.includes(current) ? [...chips, current] : chips;
  return (
    <div>
      <Label field={field} />
      <div role="radiogroup" aria-label={field.label} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((option) => {
          const on = option === current;
          return (
            <button key={option} type="button" role="radio" aria-checked={on} data-testid={`opcion-${field.name}-${option}`} onClick={() => props.onChange(option)} className={`flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 text-[14px] font-semibold transition-colors ${on ? 'border-primary bg-primary text-on-primary' : 'border-outline/25 bg-background text-on-surface-variant hover:bg-surface'}`}>
              {on ? <Check size={15} strokeWidth={3} aria-hidden className="shrink-0" /> : null}
              <span className="truncate">{option}</span>
            </button>
          );
        })}
      </div>
      <FieldError>{props.error}</FieldError>
    </div>
  );
}

/** Tag, the three values and the state; on a tablet the state column is wider and says «Estado». */
const GRID = 'grid grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_1.75rem] items-center gap-1.5 sm:grid-cols-[2.75rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_5rem] sm:gap-2';

/** The trays: a header with the columns, one compact row each, its state at the end. */
export function SampleRowsWeb(props: { fields: readonly FormField[]; values: FormValues; errors: Record<string, string>; set: SetValue }) {
  const rows = sampleRowsOf(props.fields, props.values);
  const columns = sampleColumnsOf(props.fields);
  return (
    <section data-testid="bandejas-filas" className="space-y-2">
      <p className="text-right text-[12px] text-on-surface-variant">{SAMPLES_NOTE}</p>
      <div aria-hidden className={`${GRID} px-2 text-[10.5px] font-bold uppercase tracking-wider text-on-surface-variant`}>
        <span>N.º</span>
        {columns.map((column) => <span key={column.label} className="truncate text-center"><span className={column.short ? 'max-sm:hidden' : undefined}>{column.label}</span>{column.short ? <span className="sm:hidden">{column.short}</span> : null}{column.unit ? ` (${column.unit})` : ''}</span>)}
        <span className="text-center"><span className="hidden sm:inline">Estado</span></span>
      </div>
      {rows.map((row) => <SampleRowWeb key={row.index} row={row} values={props.values} errors={props.errors} set={props.set} />)}
    </section>
  );
}

function SampleRowWeb(props: { row: SampleRow; values: FormValues; errors: Record<string, string>; set: SetValue }) {
  const { row } = props;
  const message = sampleRowMessage(row, props.errors);
  const alarm = Boolean(message);
  const tagTone = alarm ? 'bg-error/10 text-error' : row.state === 'optional' ? 'bg-background text-on-surface-variant' : 'bg-primary/10 text-primary';
  return (
    <div data-testid={`bandeja-${row.index}`} data-state={row.state} className={`rounded-xl border p-2 ${alarm ? 'border-error/50 bg-error/5' : 'border-outline/15'}`}>
      <div className={GRID}>
        <span className={`grid h-8 place-items-center rounded-lg text-[12px] font-bold ${tagTone}`}>{sampleTagOf(row)}</span>
        {row.fields.map((field) => (field.kind === 'number' ? <SampleInput key={field.name} field={field} value={props.values[field.name]} invalid={Boolean(props.errors[field.name]) || (row.state === 'partial' && isBlankAnswer(props.values[field.name]))} onChange={props.set(field.name)} /> : null))}
        <SampleState row={row} alarm={alarm} />
      </div>
      {message ? <p role="alert" className="mt-1.5 flex items-center gap-1.5 pl-1 text-[12px] font-semibold text-error"><Info size={14} aria-hidden className="shrink-0" />{message}</p> : null}
    </div>
  );
}

/** A 44 px box with its unit inside; the mouse wheel never changes a measurement. */
function SampleInput(props: { field: Extract<FormField, { kind: 'number' }>; value: unknown; invalid: boolean; onChange: (value: unknown) => void }) {
  const { field } = props;
  return (
    <label className={`flex h-11 min-w-0 items-center rounded-lg border bg-background px-2 focus-within:border-primary ${props.invalid ? 'border-error' : 'border-outline/25'}`}>
      <span className="sr-only">{field.label}</span>
      <input data-testid={`campo-${field.name}`} aria-label={field.label} type="number" inputMode={field.integer ? 'numeric' : 'decimal'} min={field.min} max={field.max} step={field.integer ? 1 : 'any'} placeholder="—" aria-invalid={props.invalid} value={typeof props.value === 'number' || typeof props.value === 'string' ? props.value : ''} onWheel={(event) => event.currentTarget.blur()} onChange={(event) => props.onChange(event.target.value === '' ? undefined : event.target.value)} className="w-full min-w-0 bg-transparent text-right text-[15px] tabular-nums outline-none placeholder:text-center placeholder:text-on-surface-variant" />
      {field.unit ? <span className="ml-1 hidden shrink-0 text-[12px] text-on-surface-variant min-[400px]:inline">{field.unit}</span> : null}
    </label>
  );
}

function SampleState(props: { row: SampleRow; alarm: boolean }) {
  if (props.alarm) return <AlertTriangle size={20} aria-label="Incompleta" className="justify-self-center text-error" />;
  if (props.row.state === 'complete') return <CheckCircle2 size={20} aria-label="Completa" className="justify-self-center text-en-linea" />;
  if (props.row.state === 'optional') return <span title={OPTIONAL_SAMPLE_LABEL} className="justify-self-center text-[10.5px] font-bold uppercase tracking-wider text-on-surface-variant"><span className="sm:hidden">{OPTIONAL_SAMPLE_TAG}</span><span className="hidden sm:inline">{OPTIONAL_SAMPLE_LABEL}</span></span>;
  return <span aria-hidden />;
}

/**
 * «Responsables y firmas» (design imp-04, José 20/11): one card per role, one open at a time; the others fold
 * into a row with the name. `renderFields` draws the open card's fields as the rest of the form does.
 */
export function RoleCardsWeb(props: { cards: readonly RoleCard[]; errors: Record<string, string>; renderFields: (fields: readonly FormField[]) => ReactNode }) {
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  const open = openRoleOf(props.cards, props.errors, picked);
  return (
    <section data-testid="roles-firmas" className="space-y-3">
      <p className="text-[13px] text-on-surface-variant">{roleCardsNote(props.cards)}</p>
      {props.cards.map((card) =>
        card.label === open ? (
          <div key={card.label} data-testid={`rol-${sectionSlug(card.label)}`} data-open="true" className="rounded-2xl border border-l-4 border-outline/15 border-l-primary bg-surface p-3">
            <button type="button" aria-expanded onClick={() => setPicked(null)} className="mb-3 flex min-h-11 w-full items-center justify-between gap-2 text-left">
              <span className="text-[12px] font-bold uppercase tracking-wider text-primary">{card.label}</span>
              <ChevronUp size={18} aria-hidden className="shrink-0 text-on-surface-variant" />
            </button>
            <div className="space-y-4">{props.renderFields(card.fields)}</div>
          </div>
        ) : (
          <FoldedRoleWeb key={card.label} card={card} onOpen={() => setPicked(card.label)} />
        )
      )}
    </section>
  );
}

/** A folded role: its initials, its name and position, or «Sin datos». */
function FoldedRoleWeb(props: { card: RoleCard; onOpen: () => void }) {
  const { card } = props;
  return (
    <button type="button" data-testid={`rol-${sectionSlug(card.label)}`} aria-expanded={false} onClick={props.onOpen} className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-outline/15 bg-surface px-3 py-2.5 text-left hover:bg-on-surface/5">
      <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-[14px] font-bold text-primary">{card.initials}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{card.label}</span>
        <span className={`block truncate text-[15px] ${card.filled ? 'text-on-surface' : 'text-on-surface-variant'}`}>{card.line}</span>
      </span>
      <ChevronDown size={18} aria-hidden className="shrink-0 text-on-surface-variant" />
    </button>
  );
}
