import { Pressable, Text } from 'react-native';
import { CornerDownRight } from 'lucide-react-native';
import { useColores } from '../ui/tema';
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
  compact = false,
}: {
  citado: Citado;
  testID: string;
  onPress?: () => void;
  /** Sobre la propia (violeta sólido, FL13) la cita va en blanco translúcido. */
  enBurbujaPropia?: boolean;
  /** Slack format: a thread reply sent to the chat is one line, «↳ Respondió en un hilo», not a block that grows the row (José 25/10). */
  compact?: boolean;
}) {
  const colores = useColores();
  if (compact && citado.enHilo) {
    return (
      <Pressable testID={testID} onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityHint={onPress ? 'Abrir el hilo' : undefined} className="mt-0.5 min-h-[24px] flex-row items-center gap-1 self-start">
        <CornerDownRight size={13} color={colores['on-surface-variant']} />
        <Text className="text-[12px] text-on-surface-variant" numberOfLines={1}>Respondió en un hilo</Text>
      </Pressable>
    );
  }
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityHint={onPress ? (citado.enHilo ? 'Abrir el hilo' : 'Ir al mensaje original') : undefined}
      className={`mx-1.5 mt-1.5 rounded-md border-l-2 px-2 py-1 ${
        enBurbujaPropia ? 'border-on-burbuja-propia bg-white/15' : 'border-primary bg-primary/[0.08]'
      }`}
    >
      {/* A thread reply sent to the chat says so, like Slack (José, 20/10). */}
      {citado.enHilo ? (
        <Text className={`text-[11px] ${enBurbujaPropia ? 'text-on-burbuja-propia-suave' : 'text-on-surface-variant'}`} numberOfLines={1}>
          Respondió en un hilo
        </Text>
      ) : null}
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
