import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronRight, Star } from 'lucide-react-native';
import { useColores } from '../../ui/tema';
import { ListaDeDestacados } from './ListaDeDestacados';

/** «Mensajes destacados» en la info del chat (20/10): cuántos, y la lista de ese chat. */
export function TarjetaDeDestacados(props: { chatId: string; jwt: string; yo: string; cuantos: number; onIr: (seq: number) => void }) {
  const colores = useColores();
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <Pressable testID="tarjeta-destacados" onPress={() => setAbierta(true)} className="mx-4 mt-4 min-h-[56px] flex-row items-center gap-3 rounded-xl border border-outline/10 bg-surface px-4">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-primary/10">
          <Star size={18} color={colores.primary} />
        </View>
        <Text className="flex-1 text-[15px] text-on-surface">Mensajes destacados</Text>
        <Text className="text-[14px] text-on-surface-variant">{props.cuantos}</Text>
        <ChevronRight size={18} color={colores.outline} />
      </Pressable>
      <ListaDeDestacados visible={abierta} jwt={props.jwt} yo={props.yo} chatId={props.chatId} onIr={(destacado) => props.onIr(destacado.seq)} onCerrar={() => setAbierta(false)} />
    </>
  );
}
