import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Check, CircleAlert, CircleCheck, Plus, Trash2 } from 'lucide-react-native';
import { formRows, itemPath, newItem, optionsForRow, rowAmounts, rowTitleOf, sharePercent, splitBalanced, splitLineOf, splitRows, togglePick, typedAfterEdit, visibleFields, type ChoiceOption, type FormField, type FormValues, type ItemField, type ListSplit } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { ErrorLine, Label } from './AppFormFields';

type ListOfItems = Extract<FormField, { kind: 'list' }>;
/** An item's fields to fill: its title field is not edited, and each choice offers only this row's options (`x-match`). */
const cellsOf = (field: ListOfItems, item: FormValues): ItemField[] =>
  visibleFields(field.fields, item)
    .filter((child) => child.name !== field.rowTitle)
    .map((child) => (child.kind === 'choice' ? { ...child, options: optionsForRow(child.options, item) } : child));
/** Draws one field of a card item with the sheet's own kit (choice, date, photos…). */
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

/**
 * A list of items (José, 28/10: one row with the number of trucks and their m³ beside it, and a
 * button to add rows; agentes: the quote's products). Short typed fields go side by side in
 * a row; anything else is a card per item with the sheet's own fields. «+ Agregar» adds one
 * up to the maximum, the bin removes one down to the minimum.
 */
export function ListField(props: Props) {
  return props.field.pickBy ? <PickItems {...props} /> : <RowsOrCards {...props} />;
}

function RowsOrCards({ field, value, errors, onChange, renderField }: Props) {
  const colors = useColores();
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
  const add = () => onChange([...items, newItem(field.fields)], field.name);
  // Fixed rows (agentes 2483da7): one per tank, nothing added nor removed.
  const removable = !field.fixedRows && items.length > field.min;
  return (
    <View testID={`lista-${field.name}`}>
      <Label field={field} />
      {field.help ? <Text className="-mt-1 mb-1.5 text-[13px] text-on-surface-variant">{field.help}</Text> : null}
      {field.fixedRows && items.length === 0 ? <Text testID={`sin-filas-${field.name}`} className="rounded-xl border border-dashed border-outline/30 px-3 py-3 text-[14px] text-on-surface-variant">No hay filas para completar</Text> : null}
      {field.layout === 'row' ? (
        <RowItems field={field} items={items} keys={keys.current} errors={errors} removable={removable} onCell={setCell} onRemove={remove} />
      ) : (
        <View className="gap-2.5">
          {items.map((item, index) => (
            <View key={keys.current[index]} testID={`item-${field.name}-${index}`} className="gap-3 rounded-2xl border border-outline/15 p-3">
              <View className="flex-row items-center justify-between">
                {field.fixedRows ? <Text testID={`titulo-${field.name}-${index}`} className="text-[16px] font-semibold text-on-surface">{rowTitleOf(field, item) || `${field.label} · ${index + 1}`}</Text> : <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">{`${field.label} · ${index + 1}`}</Text>}
                {removable ? (
                  <Pressable testID={`quitar-${field.name}-${index}`} accessibilityLabel={`Quitar ${index + 1}`} onPress={() => remove(index)} hitSlop={8} className="min-h-[36px] flex-row items-center gap-1 px-1">
                    <Trash2 size={16} color={colors['on-surface-variant']} />
                    <Text className="text-[14px] text-on-surface-variant">Quitar</Text>
                  </Pressable>
                ) : null}
              </View>
              {formRows(cellsOf(field, item)).map((row) => {
                const cell = (child: ItemField, half: boolean) => renderField(child, item[child.name], errors[itemPath(field.name, index, child.name)], setCell(index, child.name), `${keys.current[index]}-${child.name}`, half);
                return row.length === 2 ? (
                  <View key={row[0]!.name} className="flex-row items-start gap-3">
                    {row.map((child) => <View key={child.name} className="min-w-0 flex-1">{cell(child, true)}</View>)}
                  </View>
                ) : (
                  cell(row[0]!, false)
                );
              })}
            </View>
          ))}
        </View>
      )}
      {!field.fixedRows && items.length < field.max ? (
        <Pressable testID={`agregar-${field.name}`} accessibilityRole="button" onPress={add} className="mt-2 h-12 flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40">
          <Plus size={18} color={colors.primary} />
          <Text className="text-[15px] font-semibold text-primary">{field.addLabel}</Text>
        </Pressable>
      ) : null}
      <ErrorLine text={errors[field.name]} />
    </View>
  );
}

/** Short fields side by side, their labels once on top; each row's errors under it. */
function RowItems(props: { field: ListOfItems; items: FormValues[]; keys: number[]; errors: Readonly<Record<string, string>>; removable: boolean; onCell: (index: number, name: string) => (value: unknown) => void; onRemove: (index: number) => void }) {
  const { field, items, errors } = props;
  const colors = useColores();
  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        {field.fields.map((child) => (
          <Text key={child.name} className="flex-1 text-[13px] text-on-surface-variant" numberOfLines={1}>{child.label}</Text>
        ))}
        {props.removable ? <View className="w-11" /> : null}
      </View>
      {items.map((item, index) => {
        const rowErrors = field.fields.flatMap((child) => {
          const message = errors[itemPath(field.name, index, child.name)];
          return message ? [field.fields.length > 1 ? `${child.label}: ${message}` : message] : [];
        });
        return (
          <View key={props.keys[index]} testID={`fila-${field.name}-${index}`}>
            <View className="flex-row items-center gap-2">
              {field.fields.map((child) => (
                <RowCell key={child.name} field={child} testID={`campo-${field.name}-${index}-${child.name}`} value={item[child.name]} invalid={Boolean(errors[itemPath(field.name, index, child.name)])} onChange={props.onCell(index, child.name)} />
              ))}
              {props.removable ? (
                <Pressable testID={`quitar-${field.name}-${index}`} accessibilityLabel={`Quitar la fila ${index + 1}`} onPress={() => props.onRemove(index)} className="h-11 w-11 items-center justify-center rounded-xl">
                  <Trash2 size={18} color={colors['on-surface-variant']} />
                </Pressable>
              ) : null}
            </View>
            {rowErrors.length ? <ErrorLine text={rowErrors.join(' ')} /> : null}
          </View>
        );
      })}
    </View>
  );
}

/**
 * A list keyed by one choice (agentes 12/11: the expense's partidas), as design gst-02 draws it: every option a chip
 * to tick, and only a ticked one a row, with its share of the total and its amount by hand (José: two controls per
 * line, not a sheet of rows to fill).
 */
function PickItems({ field, value, errors, onChange, split }: Props) {
  const colors = useColores();
  const items = asItems(value);
  const key = field.pickBy!;
  const choice = field.fields.find((child) => child.name === key);
  const options = choice?.kind === 'choice' ? choice.options : [];
  const side = field.fields.filter((child) => child.name !== key);
  const shared = usePickSplit({ field, items, onChange, split });
  const { setCell, toggle, typed } = shared;
  const ticked = options.filter((option) => items.some((item) => item[key] === option.value));
  return (
    <View testID={`lista-${field.name}`}>
      <View className="flex-row items-center justify-between">
        <Label field={field} />
        {items.length ? <Text testID={`elegidos-${field.name}`} className="mb-1.5 text-[11px] font-bold uppercase tracking-[1px] text-primary">{`${items.length} ${items.length === 1 ? 'elegida' : 'elegidas'}`}</Text> : null}
      </View>
      {field.help ? <Text className="-mt-1 mb-1.5 text-[13px] text-on-surface-variant">{field.help}</Text> : null}
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => <PickChip key={option.value} name={field.name} option={option} on={items.some((item) => item[key] === option.value)} onToggle={() => toggle(option.value)} />)}
      </View>
      {ticked.length ? (
        <View className="mt-3 gap-2">
          {ticked.map((option) => {
            const index = items.findIndex((item) => item[key] === option.value);
            const percent = split ? sharePercent(rowAmounts([items[index]!], split.plan.amount)[0]!, split.total) : null;
            const adjusted = Boolean(split) && typed.size > 0 && !typed.has(option.value);
            const rowErrors = side.flatMap((child) => errors[itemPath(field.name, index, child.name)] ?? []);
            return (
              <View key={option.value} testID={`fila-${field.name}-${option.value}`}>
                <View className="min-h-[56px] flex-row items-center gap-2.5 rounded-xl border-[1.5px] border-primary bg-primary/[0.04] p-3">
                  <Pressable testID={`quitar-${field.name}-${option.value}`} accessibilityRole="button" accessibilityLabel={`Quitar ${option.label}`} onPress={() => toggle(option.value)} hitSlop={10} className="h-6 w-6 items-center justify-center rounded-md bg-primary">
                    <Check size={15} color={colors['on-primary']} />
                  </Pressable>
                  <Text className="flex-1 text-[14px] font-bold text-on-surface" numberOfLines={2}>
                    {option.label}
                    {percent !== null ? <Text className="text-[12px] font-medium text-on-surface-variant">{`  (${percent} %)`}</Text> : null}
                  </Text>
                  {adjusted ? <Text testID={`ajustado-${field.name}-${option.value}`} className="text-[10px] font-bold uppercase text-on-surface-variant">ajustado</Text> : null}
                  {side.map((child) => <View key={child.name} className="w-32"><RowCell field={child} testID={`campo-${field.name}-${index}-${child.name}`} value={items[index]![child.name]} invalid={Boolean(errors[itemPath(field.name, index, child.name)])} onChange={setCell(index, child.name)} /></View>)}
                </View>
                {rowErrors.length ? <ErrorLine text={rowErrors.join(' ')} /> : null}
              </View>
            );
          })}
        </View>
      ) : null}
      {split && items.length ? <SplitLine field={field.name} split={split} items={items} onEven={items.length > 1 ? shared.even : undefined} /> : null}
      <ErrorLine text={errors[field.name]} />
    </View>
  );
}

/** One partida to tick: a chip, outlined and ticked when it is in (design gst-02). */
function PickChip(props: { name: string; option: ChoiceOption; on: boolean; onToggle: () => void }) {
  const colors = useColores();
  return (
    <Pressable testID={`opcion-${props.name}-${props.option.value}`} accessibilityRole="checkbox" accessibilityState={{ checked: props.on }} onPress={props.onToggle} className={`min-h-[44px] flex-row items-center gap-2 rounded-xl border px-3 ${props.on ? 'border-primary bg-primary/10' : 'border-outline/25'}`}>
      <View className={`h-5 w-5 items-center justify-center rounded border ${props.on ? 'border-primary bg-primary' : 'border-outline/40'}`}>{props.on ? <Check size={13} color={colors['on-primary']} /> : null}</View>
      <Text className={`text-[14px] ${props.on ? 'font-bold text-primary' : 'font-medium text-on-surface-variant'}`}>{props.option.label}</Text>
    </Pressable>
  );
}

/**
 * The list splits a total (José 13/11: «ofrecer repartir el monto, debe ser inteligente»): a tick
 * shares the total among the ticked rows, an amount typed by hand stays and the rest adjusts.
 */
function usePickSplit(params: { field: ListOfItems; items: FormValues[]; onChange: Props['onChange']; split?: ListSplit }) {
  const { field, items, onChange, split } = params;
  const key = field.pickBy!;
  const [typed, setTyped] = useState<ReadonlySet<string>>(new Set());
  const settle = (rows: FormValues[], kept: ReadonlySet<string>) => (split ? splitRows(rows, split.plan, key, split.total, kept, split.weights) : rows);
  const toggle = (option: string) => onChange(settle(togglePick(field, items, option), typed), field.name);
  const setCell = (index: number, name: string) => (cell: unknown) => {
    const rows = items.map((item, at) => (at === index ? { ...item, [name]: cell } : item));
    const kept = typedAfterEdit(typed, split?.plan, name, items[index]?.[key]);
    if (kept !== typed) setTyped(kept);
    onChange(settle(rows, kept), itemPath(field.name, index, name));
  };
  const even = () => {
    setTyped(new Set());
    onChange(settle(items, new Set()), field.name);
  };
  // The total changed (typed, or read from the voucher): the untyped rows follow it. The rows the app sent that already add up stay as they came.
  const latest = useRef({ items, settle, typed, onChange, split });
  latest.current = { items, settle, typed, onChange, split };
  const total = split?.total ?? 0;
  const opening = useRef(true);
  useEffect(() => {
    const now = latest.current;
    const first = opening.current;
    opening.current = false;
    if (!now.items.length || (first && now.split && splitBalanced(now.split.total, now.items, now.split.plan))) return;
    const next = now.settle(now.items, now.typed);
    if (JSON.stringify(next) !== JSON.stringify(now.items)) now.onChange(next, field.name);
  }, [total, field.name]);
  // The way of sharing changed («A mano» → «Según partida»): what was typed is let go and the rows follow it.
  const mode = split?.mode;
  const modeSeen = useRef(mode);
  useEffect(() => {
    if (modeSeen.current === mode) return;
    modeSeen.current = mode;
    const now = latest.current;
    setTyped(new Set());
    const next = now.items.length ? now.settle(now.items, new Set()) : now.items;
    if (JSON.stringify(next) !== JSON.stringify(now.items)) now.onChange(next, field.name);
  }, [mode, field.name]);
  return { toggle, setCell, even, typed };
}

const BANNER_TONE = {
  ok: { box: 'border-en-linea/30 bg-en-linea/10', text: 'text-en-linea', icon: 'en-linea' },
  warn: { box: 'border-warning/30 bg-warning/10', text: 'text-warning', icon: 'warning' },
  error: { box: 'border-error/30 bg-error/5', text: 'text-error', icon: 'error' },
  neutral: { box: 'border-outline/20 bg-background', text: 'text-on-surface-variant', icon: 'on-surface-variant' },
} as const;

/** «Asignado S/ 500.00 de S/ 500.00 · 100 % cuadrado», or what is missing or over, and «Partes iguales» (design gst-02). */
function SplitLine(props: { field: string; split: ListSplit; items: FormValues[]; onEven?: () => void }) {
  const colors = useColores();
  const { split } = props;
  const line = splitLineOf(split.total, props.items, split.plan, split.unit);
  const tone = BANNER_TONE[line.tone];
  const Icon = line.tone === 'ok' ? CircleCheck : CircleAlert;
  return (
    <View testID={`reparto-${props.field}`} className={`mt-3 flex-row flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5 ${tone.box}`}>
      <View className="flex-1 flex-row flex-wrap items-center gap-x-2 gap-y-1">
        <Icon size={16} color={colors[tone.icon]} />
        <Text className={`text-[14px] font-semibold ${tone.text}`}>{line.text}</Text>
        {line.tone === 'ok' ? <Text testID={`cuadrado-${props.field}`} className="rounded border border-en-linea/40 bg-en-linea/10 px-1.5 text-[10px] font-bold uppercase tracking-[1px] text-en-linea">100 % cuadrado</Text> : null}
      </View>
      {props.onEven ? (
        <Pressable testID={`partes-iguales-${props.field}`} onPress={props.onEven} className="min-h-[44px] justify-center rounded-full border border-outline/25 px-3.5">
          <Text className="text-[13px] font-semibold text-on-surface">{split.weights ? 'Según partida' : 'Partes iguales'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** One cell: a number or a short text, with its unit inside the box. */
function RowCell(props: { field: ItemField; testID: string; value: unknown; invalid: boolean; onChange: (value: unknown) => void }) {
  const { field } = props;
  const number = field.kind === 'number';
  const text = typeof props.value === 'string' || typeof props.value === 'number' ? String(props.value) : '';
  return (
    <View className={`h-12 flex-1 flex-row items-center rounded-xl border bg-background px-3 ${props.invalid ? 'border-error' : 'border-outline/25'}`}>
      <TextInput
        testID={props.testID}
        accessibilityLabel={field.label}
        value={text}
        onChangeText={(next) => props.onChange(next === '' ? undefined : next)}
        keyboardType={number ? (field.integer ? 'number-pad' : 'decimal-pad') : 'default'}
        maxLength={field.kind === 'text' ? field.maxLength : undefined}
        className="h-12 min-w-0 flex-1 text-[16px] text-on-surface"
        style={number ? { fontVariant: ['tabular-nums'] } : undefined}
      />
      {number && field.unit ? <Text className="ml-1 text-[14px] font-semibold text-on-surface-variant">{field.unit}</Text> : null}
    </View>
  );
}
