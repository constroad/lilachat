import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Sheet } from '../ui/Sheet';
import { ETIQUETAS_DE_DURACION, type DuracionDeFijado } from '@lilachat/shared';

/** «¿Por cuánto tiempo?» al fijar (diseño `fm-app-duracion.png`). Abre en 7 días, como WhatsApp. */
const OPCIONES: DuracionDeFijado[] = ['24h', '7d', '30d', 'siempre'];

export function HojaDeFijarMensaje(props: { visible: boolean; onFijar: (duracion: DuracionDeFijado) => void; onCerrar: () => void }) {
  const [elegida, setElegida] = useState<DuracionDeFijado>('7d');
  useEffect(() => {
    if (props.visible) setElegida('7d');
  }, [props.visible]);
  return (
    <Sheet visible={props.visible} onClose={props.onCerrar} testID="hoja-fijar" className="px-6 pt-2">
      <Text className="mt-5 text-xl font-bold text-on-surface">¿Por cuánto tiempo?</Text>
      <Text className="mt-1 text-[15px] leading-6 text-on-surface-variant">Se ve arriba del chat para todos. Puedes desfijarlo cuando quieras.</Text>
      <View className="mt-4">
        {OPCIONES.map((opcion) => {
          const activa = opcion === elegida;
          return (
            <Pressable
              key={opcion}
              testID={`duracion-${opcion}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: activa }}
              onPress={() => setElegida(opcion)}
              className={`-mx-6 min-h-[56px] flex-row items-center justify-between px-6 ${activa ? 'bg-primary/[0.06]' : ''}`}
            >
              <Text className="text-base text-on-surface">{ETIQUETAS_DE_DURACION[opcion]}</Text>
              <View className={`h-6 w-6 items-center justify-center rounded-full border-2 ${activa ? 'border-primary' : 'border-outline/60'}`}>
                {activa ? <View className="h-3 w-3 rounded-full bg-primary" /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      <View className="mt-5 flex-row justify-end gap-3">
        <Pressable testID="btn-cancelar-fijar" onPress={props.onCerrar} className="h-12 items-center justify-center px-5">
          <Text className="text-base font-medium text-on-surface-variant">Cancelar</Text>
        </Pressable>
        <Pressable testID="btn-confirmar-fijar" onPress={() => props.onFijar(elegida)} className="h-12 items-center justify-center rounded-xl bg-primary px-7">
          <Text className="text-base font-semibold text-on-primary">Fijar</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}
