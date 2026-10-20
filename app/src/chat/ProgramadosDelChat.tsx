import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Modal } from '../ui/Modal';
import { CalendarClock, X } from 'lucide-react-native';
import { formatEventWhen } from '@lilachat/shared';
import type { Programado } from '../api/client';
import { textoDeProgramados } from './programados';
import { useMargenes } from '../ui/useMargenes';
import { useColores } from '../ui/tema';

/**
 * Los mensajes programados de este chat (FL9d; auditoría §46.2): un aviso sobre
 * la barra de escribir con cuántos hay, y al tocarlo la lista con la hora de
 * cada uno y «Cancelar». Sin pendientes no se dibuja nada.
 */
export function ProgramadosDelChat(props: { pendientes: Programado[]; onCancelar: (id: string) => Promise<void> }) {
  const colores = useColores();
  const margenes = useMargenes();
  const [abierto, setAbierto] = useState(false);
  if (props.pendientes.length === 0) return null;

  const confirmar = (programado: Programado) =>
    Alert.alert('¿Cancelar este mensaje?', programado.body, [
      { text: 'No', style: 'cancel' },
      { text: 'Cancelar mensaje', style: 'destructive', onPress: () => void props.onCancelar(programado.id) },
    ]);

  return (
    <>
      <Pressable
        testID="chip-programados"
        onPress={() => setAbierto(true)}
        hitSlop={{ top: 4, bottom: 4 }}
        className="mx-4 mb-1 min-h-[36px] flex-row items-center gap-2 self-start rounded-full bg-primary/[0.10] px-3"
      >
        <CalendarClock size={15} color={colores.primary} />
        <Text className="text-[12px] font-semibold text-primary">{textoDeProgramados(props.pendientes.length)}</Text>
      </Pressable>
      <Modal visible={abierto} transparent animationType="slide" onRequestClose={() => setAbierto(false)}>
        <Pressable className="flex-1 bg-black/40" onPress={() => setAbierto(false)} accessibilityLabel="Cerrar" />
        <View className="max-h-[70%] rounded-t-xl bg-surface px-5 pt-3" style={{ paddingBottom: margenes.pie }} testID="hoja-programados">
          <View className="mb-3 h-1.5 w-11 self-center rounded-full bg-outline/30" />
          <Text className="mb-2 text-base font-bold text-on-surface">{textoDeProgramados(props.pendientes.length)}</Text>
          <ScrollView>
            {props.pendientes.map((programado) => (
              <View key={programado.id} className="min-h-[56px] flex-row items-center gap-3 border-b border-outline/10 py-2">
                <View className="min-w-0 flex-1">
                  <Text className="text-[14px] text-on-surface" numberOfLines={2}>
                    {programado.body}
                  </Text>
                  <Text className="text-[12px] text-on-surface-variant">{formatEventWhen(new Date(programado.sendAt))}</Text>
                </View>
                <Pressable
                  testID={`cancelar-programado-${programado.id}`}
                  accessibilityLabel="Cancelar este mensaje"
                  onPress={() => confirmar(programado)}
                  className="h-11 w-11 items-center justify-center"
                >
                  <X size={20} color={colores.error} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
