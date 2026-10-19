import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Bell, Trash2 } from 'lucide-react-native';
import { agendaDelete, recordatoriosDelGrupo, type AgendaReminder } from '../agenda/agendaApi';
import { cuandoSuena } from '../agenda/recordatorios';
import { CreateReminderScreen } from '../agenda/CreateReminderScreen';
import type { Credential } from '../auth/credentialStore';
import { suscribirTarjeta } from './tarjetasVivas';
import { Rotulo } from '../ui/Rotulo';
import { useColores } from '../ui/tema';

const LADO_DE_LA_MINIATURA = 44;

/**
 * Los recordatorios que viven en el grupo (José, 19/10), en su detalle. Los
 * ven todos; un admin los edita tocándolos y los borra. En vivo: si otro admin
 * cambia uno, la lista se vuelve a pedir. Sin recordatorios, no aparece.
 */
export function RecordatoriosDelGrupo(props: { chatId: string; nombreDelGrupo: string; credential: Credential; soyAdmin: boolean }) {
  const colores = useColores();
  const jwt = props.credential.jwt;
  const [lista, setLista] = useState<AgendaReminder[]>([]);
  const [editando, setEditando] = useState<AgendaReminder | null>(null);
  const cargar = useCallback(async () => {
    const respuesta = await recordatoriosDelGrupo(props.chatId, jwt);
    if (respuesta.ok) setLista(respuesta.data.reminders);
  }, [props.chatId, jwt]);
  useEffect(() => {
    void cargar();
  }, [cargar]);
  useEffect(() => {
    const soltar = lista.map((uno) => suscribirTarjeta('recordatorio', uno._id, () => void cargar()));
    return () => soltar.forEach((fn) => fn());
  }, [lista, cargar]);

  const borrar = (recordatorio: AgendaReminder) =>
    Alert.alert('Borrar el recordatorio', `«${recordatorio.title}» deja de sonarle a todo el grupo.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => void agendaDelete(`/reminders/${recordatorio._id}`, jwt).then(() => cargar()) },
    ]);

  if (lista.length === 0) return null;
  return (
    <>
      <Rotulo sangrado>{`Recordatorios del grupo · ${lista.length}`}</Rotulo>
      <View className="mx-4 overflow-hidden rounded-2xl border border-outline/10 bg-surface" testID="recordatorios-del-grupo">
        {lista.map((recordatorio, indice) => (
          <Pressable
            key={recordatorio._id}
            testID={`recordatorio-grupo-${recordatorio._id}`}
            disabled={!props.soyAdmin}
            onPress={() => setEditando(recordatorio)}
            accessibilityLabel={props.soyAdmin ? `Editar el recordatorio ${recordatorio.title}` : undefined}
            className="min-h-[64px] flex-row items-center gap-3 px-4 py-2.5"
          >
            {indice > 0 ? <View className="absolute right-0 top-0 h-px bg-outline/10" style={{ left: 16 + LADO_DE_LA_MINIATURA + 12 }} /> : null}
            {recordatorio.imageUrl ? (
              <Image source={{ uri: recordatorio.imageUrl }} style={{ width: LADO_DE_LA_MINIATURA, height: LADO_DE_LA_MINIATURA, borderRadius: 10 }} contentFit="cover" />
            ) : (
              <View className="items-center justify-center rounded-full bg-primary/10" style={{ width: LADO_DE_LA_MINIATURA, height: LADO_DE_LA_MINIATURA }}>
                <Bell size={20} color={colores.primary} />
              </View>
            )}
            <View className="min-w-0 flex-1">
              <Text className="text-[15px] font-semibold text-on-surface" numberOfLines={1}>
                {recordatorio.title}
              </Text>
              <Text className="text-[12px] text-on-surface-variant" numberOfLines={1}>
                {cuandoSuena(recordatorio)}
              </Text>
            </View>
            {props.soyAdmin ? (
              <Pressable testID={`btn-borrar-recordatorio-${recordatorio._id}`} accessibilityLabel="Borrar el recordatorio" onPress={() => borrar(recordatorio)} className="h-11 w-11 items-center justify-center">
                <Trash2 size={18} color={colores['on-surface-variant']} />
              </Pressable>
            ) : null}
          </Pressable>
        ))}
      </View>
      {editando ? (
        <CreateReminderScreen
          visible
          credential={props.credential}
          grupo={{ id: props.chatId, name: props.nombreDelGrupo }}
          editando={editando}
          onClose={() => setEditando(null)}
          onCreated={() => void cargar()}
        />
      ) : null}
    </>
  );
}
