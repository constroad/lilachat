import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { MapPin, RefreshCw } from 'lucide-react-native';
import { precisionNoteOf, streetOptionsOf, type FormField, type GeoPoint, type WorkMapStreet } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { ChoiceField, ErrorLine, Label } from './AppFormFields';
import type { ReadingState } from './useFieldAutofill';

const NO_STREETS = 'No hay calles del mapa de obra para elegir.';
const DENIED = 'No se pudo leer el GPS. Activa la ubicación y vuelve a intentar.';

/** The point's place (CON-CAP): one block for the three `gps` numbers, read on opening, taken again on demand. */
export function GpsReadingField(props: { reading: GeoPoint | null; state: ReadingState; error?: string; onTake: () => void }) {
  const colors = useColores();
  const { reading, state } = props;
  const note = reading ? precisionNoteOf(reading.precision || undefined) : null;
  const ok = note?.tone === 'ok';
  return (
    <View testID="campo-gps" className="rounded-2xl border border-outline/15 p-3">
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-row items-center gap-1.5"><MapPin size={16} color={colors.primary} /><Text className="text-[15px] font-semibold text-on-surface">Ubicación del punto</Text></View>
        {state === 'asking' ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Pressable testID="gps-tomar" onPress={props.onTake} className="h-11 flex-row items-center gap-1.5 rounded-xl border border-outline/25 px-3">
            <RefreshCw size={14} color={colors.primary} />
            <Text className="text-[14px] font-semibold text-primary">{reading ? 'Volver a tomar' : 'Tomar ubicación'}</Text>
          </Pressable>
        )}
      </View>
      {reading ? <Text testID="gps-coordenadas" className="mt-1 font-mono text-[12px] text-on-surface-variant">{reading.lat.toFixed(6)}, {reading.lng.toFixed(6)}</Text> : null}
      {note ? (
        <View testID="gps-precision" className={`mt-2 self-start rounded-full border px-2.5 py-1 ${ok ? 'border-en-linea/30 bg-en-linea/10' : 'border-warning/30 bg-warning/10'}`}>
          <Text className={`text-[12px] font-semibold ${ok ? 'text-en-linea' : 'text-warning'}`}>{note.text}</Text>
        </View>
      ) : null}
      {state === 'denied' ? <Text className="mt-2 text-[13px] text-on-surface-variant">{DENIED}</Text> : null}
      <ErrorLine text={props.error} />
    </View>
  );
}

type StreetProps = { field: Extract<FormField, { kind: 'text' }>; value: unknown; error?: string; onChange: (value: unknown) => void; streets: readonly WorkMapStreet[] | null; reading: GeoPoint | null };

/** A street of the service's work map, the nearest one already picked; the engineer can change it. */
export function WorkStreetField({ field, value, error, onChange, streets, reading }: StreetProps) {
  if (!streets || streets.length === 0) {
    return (
      <View testID={`campo-${field.name}`}>
        <Label field={field} />
        {streets ? <Text className="rounded-xl border border-dashed border-outline/30 px-3 py-3 text-[14px] text-on-surface-variant">{NO_STREETS}</Text> : <View className="h-11 rounded-xl bg-surface-variant" />}
        <ErrorLine text={error} />
      </View>
    );
  }
  const choice = { ...field, kind: 'choice' as const, options: streetOptionsOf(streets, reading), segmented: false, searchable: true };
  return <ChoiceField field={choice} value={value} error={error} onChange={onChange} />;
}
