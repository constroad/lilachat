import { useRef, type ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { formRows, itemPath, newItem, visibleFields, type FormField, type FormValues, type ItemField } from '@lilachat/shared';
import { FieldError } from '../../ui/Overlay';
import { Label } from './AppFormFields';

type ListOfItems = Extract<FormField, { kind: 'list' }>;
/** Draws one field of a card item with the dialog's own kit (choice, date, photos…). */
export type RenderItemField = (field: ItemField, value: unknown, error: string | undefined, onChange: (value: unknown) => void, key: string) => ReactNode;
type Props = {
  field: ListOfItems;
  value: unknown;
  errors: Readonly<Record<string, string>>;
  /** The new items, and which cell changed: its error goes, the others stay. */
  onChange: (items: FormValues[], changed: string) => void;
  renderField: RenderItemField;
};

const asItems = (value: unknown): FormValues[] => (Array.isArray(value) ? value.map((item) => (item && typeof item === 'object' ? (item as FormValues) : {})) : []);

/**
 * A list of items (José, 28/10: one row with the number of trucks and their m³ beside it, and a
 * button to add rows; agentes: the quote's products). The app's twin is `ListField` there:
 * short typed fields side by side in a row, anything else a card per item.
 */
export function ListField({ field, value, errors, onChange, renderField }: Props) {
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
  const removable = items.length > field.min;
  return (
    <div data-testid={`lista-${field.name}`}>
      <Label field={field} />
      {field.help ? <p className="-mt-1 mb-1.5 text-[12px] text-on-surface-variant">{field.help}</p> : null}
      {field.layout === 'row' ? (
        <RowItems field={field} items={items} keys={keys.current} errors={errors} removable={removable} onCell={setCell} onRemove={remove} />
      ) : (
        <div className="space-y-2.5">
          {items.map((item, index) => (
            <div key={keys.current[index]} data-testid={`item-${field.name}-${index}`} className="space-y-3 rounded-2xl border border-outline/15 p-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">{`${field.label} · ${index + 1}`}</p>
                {removable ? (
                  <button type="button" data-testid={`quitar-${field.name}-${index}`} onClick={() => remove(index)} className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-[13px] text-on-surface-variant hover:bg-on-surface/5">
                    <Trash2 size={15} /> Quitar
                  </button>
                ) : null}
              </div>
              {formRows(visibleFields(field.fields, item)).map((row) => {
                const cells = row.map((child) => renderField(child, item[child.name], errors[itemPath(field.name, index, child.name)], setCell(index, child.name), `${keys.current[index]}-${child.name}`));
                return row.length === 2 ? <div key={row[0]!.name} data-row="2" className="grid grid-cols-2 items-start gap-3">{cells}</div> : cells;
              })}
            </div>
          ))}
        </div>
      )}
      {items.length < field.max ? (
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
