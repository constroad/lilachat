import { Text, TextInput, View } from 'react-native';
import { birthdayFieldError, type BirthdayDraft } from '@lilachat/shared';
import { useColores } from '../ui/tema';

/**
 * The three birthday boxes (day, month, optional year) and the error under
 * them, shared by «Completa tu perfil» and «Crea tu usuario» (José, 14/11: the
 * people invited by email were never asked). The error shows only once day and
 * month are typed (`birthdayFieldError`).
 */
export function BirthdayFields(props: { value: BirthdayDraft; onChange: (next: BirthdayDraft) => void; fieldClass: string }) {
  const colors = useColores();
  const { value, onChange, fieldClass } = props;
  const hint = birthdayFieldError(value);
  return (
    <>
      <View className="flex-row gap-2">
        <TextInput testID="perfil-dia" accessibilityLabel="Día" className={`${fieldClass} w-20 text-center`} placeholder="Día" placeholderTextColor={colors.outline} keyboardType="number-pad" maxLength={2} value={value.day} onChangeText={(day) => onChange({ ...value, day })} />
        <TextInput testID="perfil-mes" accessibilityLabel="Mes" className={`${fieldClass} w-20 text-center`} placeholder="Mes" placeholderTextColor={colors.outline} keyboardType="number-pad" maxLength={2} value={value.month} onChangeText={(month) => onChange({ ...value, month })} />
        <TextInput testID="perfil-anio" accessibilityLabel="Año" className={`${fieldClass} min-w-0 flex-1 text-center`} placeholder="Año (opcional)" placeholderTextColor={colors.outline} keyboardType="number-pad" maxLength={4} value={value.year} onChangeText={(year) => onChange({ ...value, year })} />
      </View>
      {hint ? <Text testID="perfil-error-cumple" className="mt-2 text-sm text-error">{hint}</Text> : null}
    </>
  );
}
