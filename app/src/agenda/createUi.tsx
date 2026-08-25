import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

/**
 * Las piezas compartidas de las pantallas de crear (diseños «New Event» y
 * «New Poll»).
 *
 * El lenguaje visual de los dos diseños es el mismo y por eso vive acá: rótulos
 * de sección en MAYÚSCULAS y en color de acento, y campos **rellenos sobre una
 * superficie tintada, SIN borde**. Yo los había hecho con borde y fondo blanco,
 * que es el patrón contrario.
 *
 * Lo que NO se comparte es la cabecera: «New Event» lleva un héroe centrado con
 * icono y «New Poll» un título alineado a la izquierda. Son distintas a
 * propósito en el diseño, y aplanarlas en una sola —como estaba— no da ninguna
 * de las dos.
 */
export const SectionLabel = ({ children }: { children: string }) => (
  <Text className="mb-2 mt-6 text-[11px] font-semibold uppercase tracking-wider text-primary">
    {children}
  </Text>
);

/** El campo del diseño: relleno tintado, sin borde, sin sombra. */
export const FilledField = (props: React.ComponentProps<typeof TextInput>) => (
  <TextInput
    {...props}
    placeholderTextColor="#8b86a0"
    className="min-h-[52px] rounded-xl bg-primary/[0.07] px-4 py-3 text-base text-on-surface"
  />
);

/**
 * Una fila con icono, dos líneas y chevron («Mañana, 7:00 PM / Termina a las
 * 10:00 PM», «Agregar ubicación / O enlace de videollamada»).
 *
 * En el diseño esto NO es un campo de texto: es una fila que se toca y abre
 * algo. Yo lo había hecho con un input numérico de «horas desde ahora», que no
 * se parece ni funciona igual.
 */
export function PickerRow({
  icon,
  title,
  hint,
  onPress,
  testID,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      className="mb-2 min-h-[64px] flex-row items-center gap-3 rounded-xl bg-primary/[0.07] px-4 py-3"
    >
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-surface">{icon}</View>
      <View className="min-w-0 flex-1">
        <Text className="text-[15px] font-semibold text-on-surface" numberOfLines={1}>
          {title}
        </Text>
        <Text className="text-[12px] text-on-surface-variant" numberOfLines={1}>
          {hint}
        </Text>
      </View>
      <ChevronRight size={18} color="#7b7486" />
    </Pressable>
  );
}

/** Fila de ajuste: icono, título, explicación y switch (sección «OPTIONS»). */
export function ToggleRow({
  icon,
  label,
  hint,
  value,
  onChange,
  testID,
}: {
  icon?: React.ReactNode;
  label: string;
  hint: string;
  value: boolean;
  onChange: (next: boolean) => void;
  testID: string;
}) {
  return (
    <View className="mb-2 flex-row items-center gap-3 rounded-xl bg-primary/[0.07] px-4 py-3">
      {icon ? (
        <View className="h-9 w-9 items-center justify-center rounded-lg bg-surface">{icon}</View>
      ) : null}
      <View className="min-w-0 flex-1">
        <Text className="text-[15px] font-semibold text-on-surface">{label}</Text>
        <Text className="text-[12px] leading-4 text-on-surface-variant">{hint}</Text>
      </View>
      <Switch testID={testID} value={value} onValueChange={onChange} trackColor={{ true: '#6b38d4' }} />
    </View>
  );
}

/** El botón del pie: ancho completo, acento, con icono a la izquierda. */
export function PrimaryAction({
  label,
  icon,
  onPress,
  disabled,
  testID,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-[54px] flex-row items-center justify-center gap-2 rounded-xl ${
        disabled ? 'bg-primary/40' : 'bg-primary'
      }`}
    >
      {icon}
      <Text className="text-base font-bold text-on-primary">{label}</Text>
    </Pressable>
  );
}
