import { Pressable, Text } from 'react-native';
import type { Citado } from './filasDelChat';

/**
 * La cita del mensaje al que una respuesta contesta. Va DENTRO de la burbuja,
 * arriba del contenido, como WhatsApp. Tocarla lleva al original (FL9;
 * auditoría §46.2: no hacía nada).
 */
export function CitaDeRespuesta({
  citado,
  testID,
  onPress,
  enBurbujaPropia = false,
}: {
  citado: Citado;
  testID: string;
  onPress?: () => void;
  /** Sobre la propia (violeta sólido, FL13) la cita va en blanco translúcido. */
  enBurbujaPropia?: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityHint={onPress ? 'Ir al mensaje original' : undefined}
      className={`mx-1.5 mt-1.5 rounded-md border-l-2 px-2 py-1 ${
        enBurbujaPropia ? 'border-on-burbuja-propia bg-white/15' : 'border-primary bg-primary/[0.08]'
      }`}
    >
      {citado.autor ? (
        <Text className={`text-[11px] font-semibold ${enBurbujaPropia ? 'text-on-burbuja-propia' : 'text-primary'}`} numberOfLines={1}>
          {citado.autor}
        </Text>
      ) : null}
      <Text className={`text-[12px] ${enBurbujaPropia ? 'text-on-burbuja-propia-suave' : 'text-on-surface-variant'}`} numberOfLines={1}>
        {citado.texto}
      </Text>
    </Pressable>
  );
}
