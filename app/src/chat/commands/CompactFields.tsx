import { Pressable, Text, TextInput, View } from 'react-native';
import { AlertTriangle, Check, CheckCircle2, Info } from 'lucide-react-native';
import { isBlankAnswer, OPTIONAL_SAMPLE_LABEL, OPTIONAL_SAMPLE_TAG, SAMPLES_NOTE, sampleColumnsOf, sampleRowMessage, sampleRowsOf, sampleTagOf, type FormField, type FormValues, type SampleRow } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { ErrorLine, Label } from './AppFormFields';

/**
 * The compact pieces of a CTL-IMP section (design imp-01/02/03, José 19/11): the lane as chips and the
 * trays as rows with their state. Only the look: the values are the same the plain fields write.
 */
type TextField = Extract<FormField, { kind: 'text' }>;
type SetValue = (name: string) => (value: unknown) => void;
/** From this width the trays read as a table with a column «Estado» (design imp-03, tablet). */
const TABLE_FROM = 560;
const TAG_WIDTH = 40;
const STATE_WIDTH = { phone: 28, table: 72 };
const ROW_GAP = 6;

/** A text picked from its chips; a value written before them stays as one more chip, picked. */
export function TextChipsField(props: { field: TextField; value: unknown; error?: string; onChange: (value: unknown) => void }) {
  const colors = useColores();
  const { field } = props;
  const current = typeof props.value === 'string' ? props.value : '';
  const chips = field.chips ?? [];
  const options = current && !chips.includes(current) ? [...chips, current] : chips;
  return (
    <View>
      <Label field={field} />
      <View accessibilityRole="radiogroup" accessibilityLabel={field.label} className="flex-row" style={{ gap: 8 }}>
        {options.map((option) => {
          const on = option === current;
          return (
            <Pressable key={option} testID={`opcion-${field.name}-${option}`} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => props.onChange(option)} className={`h-11 min-w-0 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border px-2 ${on ? 'border-primary bg-primary' : 'border-outline/25 bg-background'}`}>
              {on ? <Check size={15} strokeWidth={3} color={colors['on-primary']} /> : null}
              <Text numberOfLines={1} className={`text-[14px] font-semibold ${on ? 'text-on-primary' : 'text-on-surface-variant'}`}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
      <ErrorLine text={props.error} />
    </View>
  );
}

/** The trays: a header with the columns, one compact row each, its state at the end. */
export function SampleRowsView(props: { fields: readonly FormField[]; values: FormValues; errors: Record<string, string>; set: SetValue; width: number }) {
  const rows = sampleRowsOf(props.fields, props.values);
  const columns = sampleColumnsOf(props.fields);
  const table = props.width >= TABLE_FROM;
  const stateWidth = table ? STATE_WIDTH.table : STATE_WIDTH.phone;
  return (
    <View testID="bandejas-filas" style={{ gap: 8 }}>
      <Text className="text-right text-[12px] text-on-surface-variant">{SAMPLES_NOTE}</Text>
      <View className="flex-row items-center px-2" style={{ gap: ROW_GAP }} importantForAccessibility="no-hide-descendants">
        <Text className="text-[10px] font-bold uppercase tracking-[1px] text-on-surface-variant" style={{ width: TAG_WIDTH }}>N.º</Text>
        {columns.map((column) => <Text key={column.label} numberOfLines={1} className="min-w-0 flex-1 text-center text-[10px] font-bold uppercase tracking-[1px] text-on-surface-variant">{`${column.label}${column.unit ? ` (${column.unit})` : ''}`}</Text>)}
        <Text className="text-center text-[10px] font-bold uppercase tracking-[1px] text-on-surface-variant" style={{ width: stateWidth }}>{table ? 'Estado' : ''}</Text>
      </View>
      {rows.map((row) => <SampleRowView key={row.index} row={row} values={props.values} errors={props.errors} set={props.set} stateWidth={stateWidth} table={table} />)}
    </View>
  );
}

function SampleRowView(props: { row: SampleRow; values: FormValues; errors: Record<string, string>; set: SetValue; stateWidth: number; table: boolean }) {
  const colors = useColores();
  const { row } = props;
  const message = sampleRowMessage(row, props.errors);
  const alarm = Boolean(message);
  const tagTone = alarm ? 'bg-error/10' : row.state === 'optional' ? 'bg-background' : 'bg-primary/10';
  const tagText = alarm ? 'text-error' : row.state === 'optional' ? 'text-on-surface-variant' : 'text-primary';
  return (
    <View testID={`bandeja-${row.index}`} accessibilityHint={row.state} className={`rounded-xl border p-2 ${alarm ? 'border-error/50 bg-error/5' : 'border-outline/15'}`}>
      <View className="flex-row items-center" style={{ gap: ROW_GAP }}>
        <View className={`h-8 items-center justify-center rounded-lg ${tagTone}`} style={{ width: TAG_WIDTH }}>
          <Text className={`text-[12px] font-bold ${tagText}`}>{sampleTagOf(row)}</Text>
        </View>
        {row.fields.map((field) => (field.kind === 'number' ? <SampleInput key={field.name} field={field} value={props.values[field.name]} invalid={Boolean(props.errors[field.name]) || (row.state === 'partial' && isBlankAnswer(props.values[field.name]))} onChange={props.set(field.name)} /> : null))}
        <View className="items-center" style={{ width: props.stateWidth }}>
          {alarm ? <AlertTriangle size={20} color={colors.error} /> : row.state === 'complete' ? <CheckCircle2 size={20} color={colors['en-linea']} /> : row.state === 'optional' ? <Text className="text-[10px] font-bold uppercase tracking-[1px] text-on-surface-variant">{props.table ? OPTIONAL_SAMPLE_LABEL : OPTIONAL_SAMPLE_TAG}</Text> : null}
        </View>
      </View>
      {message ? (
        <View accessibilityRole="alert" className="mt-1.5 flex-row items-center gap-1.5 pl-1">
          <Info size={14} color={colors.error} />
          <Text className="flex-shrink text-[12px] font-semibold text-error">{message}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** A 44 pt box with its unit inside; the decimal pad. */
function SampleInput(props: { field: Extract<FormField, { kind: 'number' }>; value: unknown; invalid: boolean; onChange: (value: unknown) => void }) {
  const colors = useColores();
  const { field } = props;
  const text = typeof props.value === 'string' || typeof props.value === 'number' ? String(props.value) : '';
  return (
    <View className={`h-11 min-w-0 flex-1 flex-row items-center rounded-lg border bg-background px-2 ${props.invalid ? 'border-error' : 'border-outline/25'}`}>
      <TextInput testID={`campo-${field.name}`} accessibilityLabel={field.label} value={text} placeholder="—" placeholderTextColor={colors['on-surface-variant']} keyboardType={field.integer ? 'number-pad' : 'decimal-pad'} onChangeText={(next) => props.onChange(next === '' ? undefined : next)} className="min-w-0 flex-1 py-0 text-right text-[15px] text-on-surface" style={{ fontVariant: ['tabular-nums'] }} />
      {field.unit ? <Text className="ml-1 text-[11px] text-on-surface-variant">{field.unit}</Text> : null}
    </View>
  );
}
