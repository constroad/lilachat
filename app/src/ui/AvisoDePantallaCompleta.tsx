import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { PhoneIncoming } from 'lucide-react-native';
import { llamadaNativa } from '../../modules/llamada-entrante/src';
import { useAlVolver } from './useAlVolver';
import { useColores } from './tema';

/**
 * Desde Android 14 el sistema puede negar las llamadas a pantalla completa
 * (FL8.1). Sin eso, con el teléfono bloqueado la llamada es solo una
 * notificación más. Se muestra SOLO si están negadas, con el atajo a Ajustes;
 * al volver de Ajustes se vuelve a mirar.
 */
export function AvisoDePantallaCompleta({ visible }: { visible: boolean }) {
  const colores = useColores();
  const [permitido, setPermitido] = useState(() => llamadaNativa.puedePantallaCompleta());
  useAlVolver(visible, () => setPermitido(llamadaNativa.puedePantallaCompleta()));
  if (permitido) return null;

  return (
    <Pressable
      testID="btn-pantalla-completa"
      onPress={llamadaNativa.abrirAjustesPantallaCompleta}
      className="mb-2 min-h-[56px] flex-row items-center gap-3 rounded-2xl border border-error/30 bg-surface p-4"
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-error/10">
        <PhoneIncoming size={18} color={colores.error} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-semibold text-on-surface">Llamadas a pantalla completa</Text>
        <Text className="text-[11px] text-on-surface-variant">
          Android las tiene apagadas: con el teléfono bloqueado no vas a ver quién te llama. Toca para permitirlas.
        </Text>
      </View>
    </Pressable>
  );
}
