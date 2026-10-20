import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Modal } from '../../ui/Modal';
import { X } from 'lucide-react-native';
import { resumenDeReacciones, type Reaccion } from '@lilachat/shared';
import { Avatar } from '../../ui/Avatar';
import { useMargenes } from '../../ui/useMargenes';
import { useColores } from '../../ui/tema';
import { PanelDeEmojis } from '../PanelDeEmojis';

const TODAS = 'todas';

/**
 * Quién reaccionó (20/10; diseño `f1-app-quien-reacciono`): pestañas «Todas»
 * y una por emoji, y la lista. Mi fila dice «Toca para quitar».
 */
export function HojaDeReacciones(props: {
  reacciones: readonly Reaccion[] | null;
  yo: string;
  nombres: ReadonlyMap<string, string>;
  fotos: ReadonlyMap<string, string>;
  onQuitarMia: () => void;
  onCerrar: () => void;
}) {
  const colores = useColores();
  const margenes = useMargenes();
  const [pestana, setPestana] = useState(TODAS);
  const abierta = props.reacciones !== null;
  useEffect(() => {
    if (abierta) setPestana(TODAS);
  }, [abierta]);
  const reacciones = props.reacciones ?? [];
  const grupos = resumenDeReacciones(reacciones, props.yo);
  const filas = pestana === TODAS ? reacciones : reacciones.filter((una) => una.emoji === pestana);
  // La mía primero, como WhatsApp.
  const ordenadas = [...filas].sort((a, b) => Number(b.userId === props.yo) - Number(a.userId === props.yo));
  const nombreDe = (id: string) => (id === props.yo ? 'Tú' : (props.nombres.get(id) ?? 'Alguien'));

  return (
    <Modal visible={props.reacciones !== null} transparent animationType="slide" onRequestClose={props.onCerrar}>
      <Pressable className="flex-1 bg-black/40" onPress={props.onCerrar} accessibilityLabel="Cerrar" />
      <View testID="hoja-reacciones" className="max-h-[70%] rounded-t-xl bg-surface pt-3" style={{ paddingBottom: margenes.pie }}>
        <View className="mb-2 h-1.5 w-11 self-center rounded-full bg-outline/30" />
        <View className="flex-row items-center justify-between px-5">
          <Text className="text-[18px] font-semibold text-on-surface">Reacciones</Text>
          <Pressable testID="btn-cerrar-reacciones" accessibilityLabel="Cerrar" onPress={props.onCerrar} className="h-11 w-11 items-center justify-center rounded-full bg-background">
            <X size={18} color={colores['on-surface-variant']} />
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-1 max-h-12 border-b border-outline/10" contentContainerStyle={{ paddingHorizontal: 16, gap: 18 }}>
          {[{ clave: TODAS, texto: 'Todas', cuantos: reacciones.length }, ...grupos.map((grupo) => ({ clave: grupo.emoji, texto: grupo.emoji, cuantos: grupo.cuantos }))].map((tab) => (
            <Pressable key={tab.clave} testID={`pestana-reacciones-${tab.clave}`} onPress={() => setPestana(tab.clave)} className={`min-h-[44px] flex-row items-center gap-1.5 border-b-2 ${pestana === tab.clave ? 'border-primary' : 'border-transparent'}`}>
              <Text className={`text-[15px] ${pestana === tab.clave ? 'font-semibold text-primary' : 'text-on-surface'}`}>{tab.texto}</Text>
              <Text className="text-[13px] text-on-surface-variant">{tab.cuantos}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <ScrollView>
          {ordenadas.map((una) => {
            const mia = una.userId === props.yo;
            return (
              <Pressable
                key={una.userId}
                testID={`fila-reaccion-${mia ? 'mia' : una.userId}`}
                disabled={!mia}
                onPress={props.onQuitarMia}
                className="min-h-[60px] flex-row items-center gap-3 border-b border-outline/10 px-5"
              >
                <Avatar nombre={nombreDe(una.userId)} foto={props.fotos.get(una.userId)} tamano={40} />
                <View className="min-w-0 flex-1">
                  <Text className="text-[16px] text-on-surface">{nombreDe(una.userId)}</Text>
                  {mia ? <Text className="text-[13px] text-on-surface-variant">Toca para quitar</Text> : null}
                </View>
                <Text className="text-[26px]">{una.emoji}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

/** «+» de la barra: el panel de emojis entero, en una hoja (el mismo del escritor). */
export function HojaDeEmojis(props: { visible: boolean; onElegir: (emoji: string) => void; onCerrar: () => void }) {
  const margenes = useMargenes();
  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onCerrar}>
      <Pressable className="flex-1 bg-black/40" onPress={props.onCerrar} accessibilityLabel="Cerrar" />
      <View testID="hoja-emojis" className="rounded-t-xl bg-surface pt-3" style={{ paddingBottom: margenes.pie }}>
        <View className="mb-2 h-1.5 w-11 self-center rounded-full bg-outline/30" />
        {props.visible ? <PanelDeEmojis onElegir={props.onElegir} /> : null}
      </View>
    </Modal>
  );
}
