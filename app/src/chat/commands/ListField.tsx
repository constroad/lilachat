import { useRef, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';
import { formRows, itemPath, newItem, visibleFields, type FormField, type FormValues, type ItemField } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { ErrorLine, Label } from './AppFormFields';

type ListOfItems = Extract<FormField, { kind: 'list' }>;
/** Draws one field of a card item with the sheet's own kit (choice, date, photos…). */
export type RenderItemField = (field: ItemField, value: unknown, error: string | undefined, onChange: (value: unknown) => void, key: string, half: boolean) => ReactNode;
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
 * button to add rows; agentes: the quote's products). Short typed fields go side by side in
 * a row; anything else is a card per item with the sheet's own fields. «+ Agregar» adds one
 * up to the maximum, the bin removes one down to the minimum.
 */
export function ListField({ field, value, errors, onChange, renderField }: Props) {
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
  const removable = items.length > field.min;
  return (
    <View testID={`lista-${field.name}`}>
      <Label field={field} />
      {field.help ? <Text className="-mt-1 mb-1.5 text-[13px] text-on-surface-variant">{field.help}</Text> : null}
      {field.layout === 'row' ? (
        <RowItems field={field} items={items} keys={keys.current} errors={errors} removable={removable} onCell={setCell} onRemove={remove} />
      ) : (
        <View className="gap-2.5">
          {items.map((item, index) => (
            <View key={keys.current[index]} testID={`item-${field.name}-${index}`} className="gap-3 rounded-2xl border border-outline/15 p-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">{`${field.label} · ${index + 1}`}</Text>
                {removable ? (
                  <Pressable testID={`quitar-${field.name}-${index}`} accessibilityLabel={`Quitar ${index + 1}`} onPress={() => remove(index)} hitSlop={8} className="min-h-[36px] flex-row items-center gap-1 px-1">
                    <Trash2 size={16} color={colors['on-surface-variant']} />
                    <Text className="text-[14px] text-on-surface-variant">Quitar</Text>
                  </Pressable>
                ) : null}
              </View>
              {formRows(visibleFields(field.fields, item)).map((row) => {
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
      {items.length < field.max ? (
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
