import { Pressable, Text } from 'react-native';
import type { Citado } from './filasDelChat';

/**
 * La cita del mensaje al que una respuesta contesta. Va DENTRO de la burbuja,
 * arriba del contenido, como WhatsApp. Tocarla lleva al original (FL9;
 * auditoría §46.2: no hacía nada).
 */
export function CitaDeRespuesta({ citado, testID, onPress }: { citado: Citado; testID: string; onPress?: () => void }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityHint={onPress ? 'Ir al mensaje original' : undefined}
      className="mx-1.5 mt-1.5 rounded-md border-l-2 border-primary bg-primary/[0.08] px-2 py-1"
    >
      {citado.autor ? (
        <Text className="text-[11px] font-semibold text-primary" numberOfLines={1}>
          {citado.autor}
        </Text>
      ) : null}
      <Text className="text-[12px] text-on-surface-variant" numberOfLines={1}>
        {citado.texto}
      </Text>
    </Pressable>
  );
}
