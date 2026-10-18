import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Check, CheckCheck, X } from 'lucide-react-native';
import { nombreDeContacto } from '@lilachat/shared';
import { infoDeMensaje, type MiembroDeInfo } from '../api/client';
import { agendaPorTelefono } from '../contacts/agendaEnMemoria';
import { useMargenes } from '../ui/useMargenes';
import { useColores } from '../ui/tema';

type Carga = { fase: 'cargando' } | { fase: 'lista'; miembros: MiembroDeInfo[] } | { fase: 'error'; motivo: string };

const SECCIONES = [
  { estado: 'read', titulo: 'Leído por' },
  { estado: 'delivered', titulo: 'Entregado a' },
  { estado: 'sent', titulo: 'Todavía no le llegó a' },
] as const;

/**
 * «Info» de un mensaje propio (FL9), como WhatsApp: quién lo leyó, a quién le
 * llegó y a quién todavía no. Los acuses son un cursor por persona: se dice el
 * estado, no la hora. Los nombres, con la agenda del teléfono.
 */
export function InfoDelMensaje(props: { visible: boolean; chatId: string; seq: number; jwt: string; onCerrar: () => void }) {
  const colores = useColores();
  const margenes = useMargenes();
  const [carga, setCarga] = useState<Carga>({ fase: 'cargando' });
  const { visible, chatId, seq, jwt } = props;

  useEffect(() => {
    if (!visible) return;
    let vigente = true;
    setCarga({ fase: 'cargando' });
    void infoDeMensaje(chatId, seq, jwt).then((respuesta) => {
      if (!vigente) return;
      setCarga(respuesta.ok ? { fase: 'lista', miembros: respuesta.data.miembros } : { fase: 'error', motivo: respuesta.message ?? 'No se pudo cargar. Revisa la señal.' });
    });
    return () => {
      vigente = false;
    };
  }, [visible, chatId, seq, jwt]);

  const agenda = agendaPorTelefono();
  const nombreDe = (miembro: MiembroDeInfo) =>
    nombreDeContacto({ delServidor: miembro.name, telefono: miembro.phone, agenda }) || 'Alguien';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={props.onCerrar}>
      <Pressable className="flex-1 bg-black/40" onPress={props.onCerrar} accessibilityLabel="Cerrar" />
      <View className="max-h-[70%] rounded-t-xl bg-surface px-5 pt-3" style={{ paddingBottom: margenes.pie + 8 }} testID="hoja-info-mensaje">
        <View className="mb-2 flex-row items-center">
          <Text className="flex-1 text-base font-bold text-on-surface">Info del mensaje</Text>
          <Pressable testID="btn-cerrar-info" accessibilityLabel="Cerrar" onPress={props.onCerrar} className="h-11 w-11 items-center justify-center">
            <X size={20} color={colores['on-surface-variant']} />
          </Pressable>
        </View>
        {carga.fase === 'cargando' ? (
          <View className="items-center py-6">
            <ActivityIndicator color={colores.primary} />
          </View>
        ) : carga.fase === 'error' ? (
          <Text className="py-4 text-sm text-error">{carga.motivo}</Text>
        ) : (
          <ScrollView>
            {SECCIONES.map(({ estado, titulo }) => {
              const deEstaSeccion = carga.miembros.filter((miembro) => miembro.estado === estado);
              if (deEstaSeccion.length === 0) return null;
              return (
                <View key={estado} className="mb-3" testID={`info-${estado}`}>
                  <View className="mb-1 flex-row items-center gap-2">
                    {estado === 'sent' ? (
                      <Check size={16} color={colores['on-surface-variant']} />
                    ) : (
                      <CheckCheck size={16} color={estado === 'read' ? colores['check-leido'] : colores['on-surface-variant']} />
                    )}
                    <Text className="text-[13px] font-semibold text-on-surface-variant">{titulo}</Text>
                  </View>
                  {deEstaSeccion.map((miembro) => (
                    <Text key={miembro.id} className="min-h-[36px] py-2 pl-6 text-[15px] text-on-surface">
                      {nombreDe(miembro)}
                    </Text>
                  ))}
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}
