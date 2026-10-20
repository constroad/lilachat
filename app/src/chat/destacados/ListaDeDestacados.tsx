import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Star, X } from 'lucide-react-native';
import { formatChatTimestamp, nombreDeContacto, textoDelDestacado, type DestacadoEnLista } from '@lilachat/shared';
import { listarDestacados, quitarDestacado } from '../../api/client';
import { agendaPorTelefono } from '../../contacts/agendaEnMemoria';
import { useMargenes } from '../../ui/useMargenes';
import { useColores } from '../../ui/tema';

/**
 * Los mensajes que destaqué (José aprobó el 20/10), como WhatsApp: los de un
 * chat (desde su info) o todos (desde Ajustes). Tocar lleva al mensaje; la
 * estrella lo quita de la lista.
 */
export function ListaDeDestacados(props: { visible: boolean; jwt: string; yo: string; chatId?: string; onIr: (destacado: DestacadoEnLista) => void; onCerrar: () => void; onCambio?: () => void }) {
  const colores = useColores();
  const margenes = useMargenes();
  const [lista, setLista] = useState<DestacadoEnLista[] | null>(null);
  const [fallo, setFallo] = useState(false);
  const { visible, jwt, chatId } = props;

  useEffect(() => {
    if (!visible) return;
    setFallo(false);
    void listarDestacados(jwt).then((respuesta) => {
      if (!respuesta.ok) return setFallo(true);
      setLista(respuesta.data.destacados.filter((destacado) => !chatId || destacado.chatId === chatId));
    });
  }, [visible, jwt, chatId]);

  const agenda = agendaPorTelefono();
  const autor = (destacado: DestacadoEnLista) => (destacado.autor.id === props.yo ? 'Tú' : nombreDeContacto({ delServidor: destacado.autor.name, telefono: destacado.autor.phone, agenda }));
  const chat = (destacado: DestacadoEnLista) => (destacado.chat.kind === 'group' ? (destacado.chat.name ?? 'Grupo') : nombreDeContacto({ delServidor: destacado.chat.name, telefono: destacado.chat.phone, agenda }));
  const quitar = async (destacado: DestacadoEnLista) => {
    setLista((antes) => antes?.filter((uno) => uno !== destacado) ?? antes);
    const respuesta = await quitarDestacado(jwt, destacado.chatId, destacado.seq);
    if (!respuesta.ok) setLista((antes) => (antes ? [destacado, ...antes] : antes));
    else props.onCambio?.();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={props.onCerrar}>
      <Pressable className="flex-1 bg-black/40" onPress={props.onCerrar} accessibilityLabel="Cerrar" />
      <View testID="lista-destacados" className="max-h-[80%] rounded-t-xl bg-surface pt-3" style={{ paddingBottom: margenes.pie }}>
        <View className="mb-2 h-1.5 w-11 self-center rounded-full bg-outline/30" />
        <View className="flex-row items-center gap-2 px-5 pb-2">
          <Text className="text-[18px] font-semibold text-on-surface">Mensajes destacados</Text>
          {lista ? (
            <View className="rounded-full bg-primary/10 px-2 py-0.5">
              <Text className="text-[13px] font-semibold text-primary">{lista.length}</Text>
            </View>
          ) : null}
          <View className="flex-1" />
          <Pressable testID="btn-cerrar-destacados" accessibilityLabel="Cerrar" onPress={props.onCerrar} className="h-11 w-11 items-center justify-center">
            <X size={20} color={colores['on-surface-variant']} />
          </Pressable>
        </View>
        <ScrollView className="border-t border-outline/10">
          {fallo ? <Text className="px-5 py-6 text-center text-[13px] text-error">No se pudo cargar. Revisa tu conexión.</Text> : null}
          {lista === null && !fallo ? <View className="mx-5 my-4 h-14 rounded-xl bg-surface-variant" /> : null}
          {lista?.length === 0 ? (
            <View className="items-center px-8 py-8" testID="destacados-vacio">
              <Star size={28} color={colores.primary} />
              <Text className="mt-3 text-[15px] font-semibold text-on-surface">Sin mensajes destacados</Text>
              <Text className="mt-1 text-center text-[13px] text-on-surface-variant">Mantén presionado un mensaje y toca la estrella para guardarlo acá. Solo tú lo ves.</Text>
            </View>
          ) : null}
          {lista?.map((destacado) => (
            <Pressable key={`${destacado.chatId}:${destacado.seq}`} testID={`fila-destacado-${destacado.seq}`} onPress={() => { props.onCerrar(); props.onIr(destacado); }} className="min-h-[64px] flex-row items-center gap-3 border-b border-outline/10 px-5 py-2">
              <View className="min-w-0 flex-1">
                <Text className="text-[12px] text-on-surface-variant" numberOfLines={1}>{props.chatId ? autor(destacado) : `${autor(destacado)} · ${chat(destacado)}`}</Text>
                <Text className="text-[15px] text-on-surface" numberOfLines={2}>{textoDelDestacado(destacado.mensaje)}</Text>
              </View>
              <Text className="text-[12px] text-on-surface-variant">{destacado.mensaje.at ? formatChatTimestamp(destacado.mensaje.at) : ''}</Text>
              <Pressable testID={`quitar-destacado-${destacado.seq}`} accessibilityLabel="Quitar de destacados" onPress={() => void quitar(destacado)} className="h-11 w-9 items-center justify-center">
                <Star size={18} color={colores.primary} fill={colores.primary} />
              </Pressable>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}
