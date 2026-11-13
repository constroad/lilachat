import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, CircleAlert, CircleCheck, Plus, Trash2 } from 'lucide-react';
import { formRows, itemPath, newItem, optionsForRow, rowAmounts, rowTitleOf, sharePercent, splitLineOf, splitRows, togglePick, typedAfterEdit, visibleFields, type ChoiceOption, type FormField, type FormValues, type ItemField, type ListSplit } from '@lilachat/shared';
import { FieldError } from '../../ui/Overlay';
import { Label } from './AppFormFields';

type ListOfItems = Extract<FormField, { kind: 'list' }>;
/** Draws one field of a card item with the dialog's own kit (choice, date, photos…). */
export type RenderItemField = (field: ItemField, value: unknown, error: string | undefined, onChange: (value: unknown) => void, key: string, half: boolean) => ReactNode;
type Props = {
  field: ListOfItems;
  value: unknown;
  errors: Readonly<Record<string, string>>;
  /** The new items, and which cell changed: its error goes, the others stay. */
  onChange: (items: FormValues[], changed: string) => void;
  renderField: RenderItemField;
  /** The total this list splits among its ticked rows (José 13/11: the expense's partidas). */
  split?: ListSplit;
};

const asItems = (value: unknown): FormValues[] => (Array.isArray(value) ? value.map((item) => (item && typeof item === 'object' ? (item as FormValues) : {})) : []);

/** An item's fields to fill: its title field is not edited, and each choice offers only this row's options (`x-match`). */
const cellsOf = (field: ListOfItems, item: FormValues): ItemField[] =>
  visibleFields(field.fields, item)
    .filter((child) => child.name !== field.rowTitle)
    .map((child) => (child.kind === 'choice' ? { ...child, options: optionsForRow(child.options, item) } : child));

/**
 * A list of items (José, 28/10: one row with the number of trucks and their m³ beside it, and a
 * button to add rows; agentes: the quote's products). The app's twin is `ListField` there:
 * short typed fields side by side in a row, anything else a card per item.
 */
export function ListField(props: Props) {
  return props.field.pickBy ? <PickItems {...props} /> : <RowsOrCards {...props} />;
}

function RowsOrCards({ field, value, errors, onChange, renderField }: Props) {
  const items = asItems(value);
  // Stable keys: removing the second row must not hand its typing to the third.
  const keys = useRef<number[]>([]);
  const nextKey = useRef(0);
  while (keys.current.length < items.length) keys.current.push(nextKey.current++);
  if (keys.current.length > items.length) keys.current.length = items.length;
  const setCell = (index: number, name: string) => (cell: unknown) => onChange(items.map((item, at) => (at === index ? { ...item, [name]: cell } : item)), itemPath(field.name, index, name));
  const remove = (index: number) => {
    keys.current.splice(index, 1);
    onChange(items.filter((_item, at) => at !== index), field.name);
  };
  // Fixed rows (agentes 2483da7): one per tank, nothing added nor removed.
  const removable = !field.fixedRows && items.length > field.min;
  return (
    <div data-testid={`lista-${field.name}`}>
      <Label field={field} />
      {field.help ? <p className="-mt-1 mb-1.5 text-[12px] text-on-surface-variant">{field.help}</p> : null}
      {field.fixedRows && items.length === 0 ? <p data-testid={`sin-filas-${field.name}`} className="rounded-xl border border-dashed border-outline/30 px-3 py-3 text-[14px] text-on-surface-variant">No hay filas para completar</p> : null}
      {field.layout === 'row' ? (
        <RowItems field={field} items={items} keys={keys.current} errors={errors} removable={removable} onCell={setCell} onRemove={remove} />
      ) : (
        <div className="space-y-2.5">
          {items.map((item, index) => (
            <div key={keys.current[index]} data-testid={`item-${field.name}-${index}`} className="space-y-3 rounded-2xl border border-outline/15 p-3">
              <div className="flex items-center justify-between">
                {field.fixedRows ? <p data-testid={`titulo-${field.name}-${index}`} className="text-[15px] font-semibold">{rowTitleOf(field, item) || `${field.label} · ${index + 1}`}</p> : <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">{`${field.label} · ${index + 1}`}</p>}
                {removable ? (
                  <button type="button" data-testid={`quitar-${field.name}-${index}`} onClick={() => remove(index)} className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-[13px] text-on-surface-variant hover:bg-on-surface/5">
                    <Trash2 size={15} /> Quitar
                  </button>
                ) : null}
              </div>
              {formRows(cellsOf(field, item)).map((row) => {
                const cells = row.map((child) => renderField(child, item[child.name], errors[itemPath(field.name, index, child.name)], setCell(index, child.name), `${keys.current[index]}-${child.name}`, row.length === 2));
                return row.length === 2 ? <div key={row[0]!.name} data-row="2" className="grid grid-cols-2 items-start gap-3">{cells}</div> : cells;
              })}
            </div>
          ))}
        </div>
      )}
      {!field.fixedRows && items.length < field.max ? (
        <button type="button" data-testid={`agregar-${field.name}`} onClick={() => onChange([...items, newItem(field.fields)], field.name)} className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 text-[14px] font-semibold text-primary hover:bg-primary/5">
          <Plus size={17} /> {field.addLabel}
        </button>
      ) : null}
      <FieldError>{errors[field.name]}</FieldError>
    </div>
  );
}

/** Short fields side by side, their labels once on top; each row's errors under it. */
function RowItems(props: { field: ListOfItems; items: FormValues[]; keys: number[]; errors: Readonly<Record<string, string>>; removable: boolean; onCell: (index: number, name: string) => (value: unknown) => void; onRemove: (index: number) => void }) {
  const { field, items, errors } = props;
  const columns = `repeat(${field.fields.length}, minmax(0, 1fr))${props.removable ? ' 2.75rem' : ''}`;
  return (
    <div className="space-y-2">
      <div className="grid gap-2 text-[12px] text-on-surface-variant" style={{ gridTemplateColumns: columns }}>
        {field.fields.map((child) => <span key={child.name} className="truncate">{child.label}</span>)}
      </div>
      {items.map((item, index) => {
        const rowErrors = field.fields.flatMap((child) => {
          const message = errors[itemPath(field.name, index, child.name)];
          return message ? [field.fields.length > 1 ? `${child.label}: ${message}` : message] : [];
        });
        return (
          <div key={props.keys[index]} data-testid={`fila-${field.name}-${index}`}>
            <div className="grid items-center gap-2" style={{ gridTemplateColumns: columns }}>
              {field.fields.map((child) => {
                const invalid = Boolean(errors[itemPath(field.name, index, child.name)]);
                const cell = item[child.name];
                return (
                  <label key={child.name} className={`flex h-11 min-w-0 items-center rounded-xl border bg-background px-3 focus-within:border-primary ${invalid ? 'border-error' : 'border-outline/25'}`}>
                    <input
                      data-testid={`campo-${field.name}-${index}-${child.name}`}
                      aria-label={child.label}
                      aria-invalid={invalid || undefined}
                      inputMode={child.kind === 'number' ? (child.integer ? 'numeric' : 'decimal') : undefined}
                      maxLength={child.kind === 'text' ? child.maxLength : undefined}
                      value={typeof cell === 'string' || typeof cell === 'number' ? String(cell) : ''}
                      onChange={(event) => props.onCell(index, child.name)(event.target.value === '' ? undefined : event.target.value)}
                      className="h-full min-w-0 flex-1 bg-transparent text-[15px] tabular-nums outline-none"
                    />
                    {child.kind === 'number' && child.unit ? <span className="ml-1 text-[13px] font-semibold text-on-surface-variant">{child.unit}</span> : null}
                  </label>
                );
              })}
              {props.removable ? (
                <button type="button" data-testid={`quitar-${field.name}-${index}`} aria-label={`Quitar la fila ${index + 1}`} onClick={() => props.onRemove(index)} className="grid h-11 w-11 place-items-center rounded-xl text-on-surface-variant hover:bg-on-surface/5">
                  <Trash2 size={17} />
                </button>
              ) : null}
            </div>
            {rowErrors.length ? <FieldError>{rowErrors.join(' ')}</FieldError> : null}
          </div>
        );
      })}
    </div>
  );
}

/**
 * A list keyed by one choice (agentes 12/11: the expense's partidas), as design gst-02 draws it: every option a chip
 * to tick, and only a ticked one a row, with its share of the total and its amount by hand. José could not pick a
 * second partida from a dropdown per row, and a long list of rows pushed the amount out of sight.
 */
function PickItems({ field, value, errors, onChange, split }: Props) {
  const items = asItems(value);
  const key = field.pickBy!;
  const choice = field.fields.find((child) => child.name === key);
  const options = choice?.kind === 'choice' ? choice.options : [];
  const side = field.fields.filter((child) => child.name !== key);
  const { setCell, toggle, even, typed } = useSplitPick(field, items, onChange, split);
  const ticked = options.filter((option) => items.some((item) => item[key] === option.value));
  return (
    <div data-testid={`lista-${field.name}`}>
      <div className="flex items-center justify-between gap-2">
        <Label field={field} />
        {items.length ? <span data-testid={`elegidos-${field.name}`} className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">{`${items.length} ${items.length === 1 ? 'elegida' : 'elegidas'}`}</span> : null}
      </div>
      {field.help ? <p className="-mt-1 mb-1.5 text-[12px] text-on-surface-variant">{field.help}</p> : null}
      <div role="group" aria-label={field.label} className="flex flex-wrap gap-2">
        {options.map((option) => <PickChip key={option.value} name={field.name} option={option} on={items.some((item) => item[key] === option.value)} onToggle={() => toggle(option.value)} />)}
      </div>
      {ticked.length ? (
        <div className="mt-3 space-y-2">
          {ticked.map((option) => {
            const index = items.findIndex((item) => item[key] === option.value);
            const percent = split ? sharePercent(rowAmounts([items[index]!], split.plan.amount)[0]!, split.total) : null;
            const adjusted = Boolean(split) && typed.size > 0 && !typed.has(option.value);
            const rowErrors = side.flatMap((child) => errors[itemPath(field.name, index, child.name)] ?? []);
            return (
              <div key={option.value} data-testid={`fila-${field.name}-${option.value}`}>
                <div className="flex min-h-[52px] items-center gap-2.5 rounded-xl border-[1.5px] border-primary bg-primary/[0.04] p-3">
                  <button type="button" aria-label={`Quitar ${option.label}`} data-testid={`quitar-${field.name}-${option.value}`} onClick={() => toggle(option.value)} className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-primary text-on-primary"><Check size={13} strokeWidth={3} /></button>
                  <span className="min-w-0 flex-1 text-[13px] font-bold">
                    <span className="break-words">{option.label}</span>
                    {percent !== null ? <span className="ml-1.5 text-[11px] font-medium text-on-surface-variant tabular-nums">{`(${percent} %)`}</span> : null}
                  </span>
                  {adjusted ? <span data-testid={`ajustado-${field.name}-${option.value}`} className="rounded border border-outline/30 px-1.5 text-[10px] font-bold uppercase text-on-surface-variant">ajustado</span> : null}
                  {side.map((child) => <SideCell key={child.name} field={child} testId={`campo-${field.name}-${index}-${child.name}`} value={items[index]![child.name]} invalid={Boolean(errors[itemPath(field.name, index, child.name)])} onChange={setCell(index, child.name)} />)}
                </div>
                {rowErrors.length ? <FieldError>{rowErrors.join(' ')}</FieldError> : null}
              </div>
            );
          })}
        </div>
      ) : null}
      {split && items.length ? <SplitBanner name={field.name} split={split} items={items} onEven={items.length > 1 ? even : undefined} /> : null}
      <FieldError>{errors[field.name]}</FieldError>
    </div>
  );
}

/** One partida to tick: a chip, outlined and ticked when it is in (design gst-02). */
function PickChip(props: { name: string; option: ChoiceOption; on: boolean; onToggle: () => void }) {
  return (
    <button type="button" role="checkbox" aria-checked={props.on} data-testid={`opcion-${props.name}-${props.option.value}`} onClick={props.onToggle} className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl border px-3 text-[13px] transition-colors ${props.on ? 'border-primary bg-primary/10 font-bold text-primary' : 'border-outline/25 font-medium text-on-surface-variant hover:bg-background'}`}>
      <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${props.on ? 'border-primary bg-primary text-on-primary' : 'border-outline/40'}`}>{props.on ? <Check size={11} strokeWidth={3.5} /> : null}</span>
      {props.option.label}
    </button>
  );
}

const BANNER_TONE = { ok: 'border-en-linea/30 bg-en-linea/10 text-en-linea', warn: 'border-warning/30 bg-warning/10 text-warning', error: 'border-error/30 bg-error/5 text-error', neutral: 'border-outline/20 bg-background text-on-surface-variant' } as const;

/** «Asignado S/ 500.00 de S/ 500.00 · 100 % cuadrado», or what is missing or over (design gst-02). */
function SplitBanner(props: { name: string; split: ListSplit; items: FormValues[]; /** Starts over in equal shares; none with a single row. */ onEven?: () => void }) {
  const line = splitLineOf(props.split.total, props.items, props.split.plan, props.split.unit);
  const Icon = line.tone === 'ok' ? CircleCheck : CircleAlert;
  return (
    <div data-testid={`reparto-${props.name}`} className={`mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 ${BANNER_TONE[line.tone]}`}>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-semibold">
        <Icon size={16} aria-hidden className="shrink-0" />
        {line.text}
        {line.tone === 'ok' ? <span data-testid={`cuadrado-${props.name}`} className="rounded border border-en-linea/40 bg-en-linea/10 px-1.5 text-[10px] font-bold uppercase tracking-wider">100 % cuadrado</span> : null}
      </p>
      {props.onEven ? <button type="button" data-testid={`partes-iguales-${props.name}`} onClick={props.onEven} className="min-h-8 rounded-full border border-current/30 px-3 text-xs font-semibold hover:bg-background/60">Partes iguales</button> : null}
    </div>
  );
}

/** A tick shares the total among the ticked rows; an amount typed by hand stays and the rest adjusts (José 13/11). */
function useSplitPick(field: ListOfItems, items: FormValues[], onChange: Props['onChange'], split?: ListSplit) {
  const [typed, setTyped] = useState<ReadonlySet<string>>(new Set());
  const key = field.pickBy!;
  const settle = (rows: FormValues[], kept: ReadonlySet<string>) => (split ? splitRows(rows, split.plan, key, split.total, kept) : rows);
  const current = useRef({ items, settle, typed, onChange });
  current.current = { items, settle, typed, onChange };
  const total = split?.total ?? 0;
  // The total changed (typed, or read from the voucher): the untyped rows follow it.
  useEffect(() => {
    const { items: rows, settle: apply, typed: kept, onChange: emit } = current.current;
    const next = rows.length ? apply(rows, kept) : rows;
    if (JSON.stringify(next) !== JSON.stringify(rows)) emit(next, field.name);
  }, [total, field.name]);
  return {
    typed,
    toggle: (option: string) => onChange(settle(togglePick(field, items, option), typed), field.name),
    even: () => {
      setTyped(new Set());
      onChange(settle(items, new Set()), field.name);
    },
    setCell: (index: number, name: string) => (cell: unknown) => {
      const kept = typedAfterEdit(typed, split?.plan, name, items[index]?.[key]);
      setTyped(kept);
      onChange(settle(items.map((item, at) => (at === index ? { ...item, [name]: cell } : item)), kept), itemPath(field.name, index, name));
    },
  };
}

/** The amount beside a ticked option: a short box with its unit. */
function SideCell(props: { field: ItemField; testId: string; value: unknown; invalid: boolean; onChange: (value: unknown) => void }) {
  const { field } = props;
  const number = field.kind === 'number';
  return (
    <label className={`flex h-10 w-36 shrink-0 items-center rounded-lg border bg-background px-2.5 focus-within:border-primary ${props.invalid ? 'border-error' : 'border-outline/25'}`}>
      {number && field.unit ? <span className="mr-1 text-[13px] font-semibold text-on-surface-variant">{field.unit}</span> : null}
      <input
        data-testid={props.testId}
        aria-label={field.label}
        aria-invalid={props.invalid || undefined}
        placeholder={field.label}
        inputMode={number ? (field.integer ? 'numeric' : 'decimal') : undefined}
        value={typeof props.value === 'string' || typeof props.value === 'number' ? String(props.value) : ''}
        onChange={(event) => props.onChange(event.target.value === '' ? undefined : event.target.value)}
        className="h-full min-w-0 flex-1 bg-transparent text-[15px] tabular-nums outline-none"
      />
    </label>
  );
}
