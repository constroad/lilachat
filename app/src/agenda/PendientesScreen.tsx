import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { ListTodo, RotateCw } from 'lucide-react-native';
import type { Credential } from '../auth/credentialStore';
import { agendaPorTelefono } from '../contacts/agendaEnMemoria';
import type { AgendaEvent, AgendaReminder } from './agendaApi';
import { DetalleDeEvento } from './DetalleDeEvento';
import { FilaDeEvento, FilaDeRecordatorio } from './FilasDePendientes';
import { usePendientes } from './usePendientes';
import { useColores } from '../ui/tema';

const Rotulo = ({ texto, cuantos }: { texto: string; cuantos: number }) => (
  <Text className="mb-2 mt-3 text-[11px] font-bold uppercase tracking-wider text-primary">
    {texto} · {cuantos}
  </Text>
);

/**
 * «Pendientes» (José aprobó el 20/10; antes «Agenda» con dos sub-pestañas):
 * eventos y recordatorios en UNA línea por cuándo tocan —Vencidos, Hoy,
 * Mañana, Esta semana, Más adelante— incluidos los recordatorios de mis
 * chats. Al final, los míos apagados, para prenderlos.
 */
export function PendientesScreen(props: { credential: Credential; recarga: number; onEditarEvento: (evento: AgendaEvent) => void; onEditarRecordatorio: (recordatorio: AgendaReminder) => void; onCambio?: () => void }) {
  const colores = useColores();
  const { secciones, apagados, eventos, fallo, cargar, prender } = usePendientes(props.credential.jwt, props.recarga, props.onCambio);
  const [refrescando, setRefrescando] = useState(false);
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const abierto = eventos.find((evento) => evento.id === abiertoId) ?? null;
  const agenda = agendaPorTelefono();
  const refresco = <RefreshControl refreshing={refrescando} onRefresh={() => { setRefrescando(true); void cargar().finally(() => setRefrescando(false)); }} />;

  return (
    <View className="flex-1 bg-background" testID="pantalla-pendientes">
      {fallo ? (
        <Pressable testID="pendientes-error" onPress={() => void cargar()} className="mx-4 mt-3 flex-row items-center gap-2 rounded-xl bg-error/10 px-4 py-3">
          <RotateCw size={16} color={colores.error} />
          <Text className="flex-1 text-[13px] text-error">No se pudo actualizar. Toca para reintentar.</Text>
        </Pressable>
      ) : null}
      {secciones === null ? (
        fallo ? null : (
          <View className="px-4 pt-4" testID="pendientes-cargando">
            {[0, 1, 2].map((indice) => <View key={indice} className="mb-2 h-16 rounded-xl bg-surface-variant" />)}
          </View>
        )
      ) : secciones.length === 0 && apagados.length === 0 ? (
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} refreshControl={refresco}>
          <View className="flex-1 items-center justify-center px-8" testID="pendientes-vacio">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <ListTodo size={28} color={colores.primary} />
            </View>
            <Text className="mt-4 text-lg font-semibold text-on-surface">Nada pendiente</Text>
            <Text className="mt-1 text-center text-sm leading-5 text-on-surface-variant">Los eventos y recordatorios de tus chats aparecen acá, por cuándo tocan.</Text>
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 96 }} refreshControl={refresco}>
          {secciones.map((seccion) => (
            <View key={seccion.clave} testID={`seccion-${seccion.clave}`}>
              <Rotulo texto={seccion.titulo} cuantos={seccion.items.length} />
              {seccion.items.map((item) =>
                item.tipo === 'evento' ? (
                  <FilaDeEvento key={`e-${item.id}`} evento={item.evento} onAbrir={() => setAbiertoId(item.id)} />
                ) : (
                  <FilaDeRecordatorio key={`r-${item.id}`} recordatorio={item.recordatorio} cuando={item.cuando} agenda={agenda} vencido={seccion.clave === 'vencidos'} onEditar={() => props.onEditarRecordatorio(item.recordatorio)} />
                )
              )}
            </View>
          ))}
          {apagados.length ? (
            <View testID="seccion-apagados">
              <Rotulo texto="Apagados" cuantos={apagados.length} />
              {apagados.map((recordatorio) => (
                <FilaDeRecordatorio key={recordatorio._id} recordatorio={recordatorio} cuando={new Date(recordatorio.startsAt)} agenda={agenda} onEditar={() => props.onEditarRecordatorio(recordatorio)} onPrender={(activo) => void prender(recordatorio, activo)} />
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}
      <DetalleDeEvento
        evento={abierto}
        credential={props.credential}
        onCerrar={() => setAbiertoId(null)}
        onEditar={(evento) => {
          setAbiertoId(null);
          props.onEditarEvento(evento);
        }}
        onInvitados={() => void cargar()}
      />
    </View>
  );
}
