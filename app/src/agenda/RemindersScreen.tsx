import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Interruptor } from '../ui/Interruptor';
import { Bell, RotateCw } from 'lucide-react-native';
import { formatEventWhen, nextOccurrence } from '@lilachat/shared';
import type { Credential } from '../auth/credentialStore';
import { agendaGet, agendaPost, type AgendaReminder } from './agendaApi';
import { useColores } from '../ui/tema';

/**
 * Recordatorios (diseño «My Reminders»).
 *
 * Hasta el 17/10/2026 tenía su PROPIO control segmentado («Mis
 * recordatorios / Compartidos») debajo del de la Agenda («Eventos / Avisos»):
 * dos rieles de pestañas apilados. Ahora es una sola lista con dos secciones,
 * y la de compartidos solo aparece si hay alguno.
 *
 * Tocar uno propio lo abre para editar (José: «no hay como editar avisos»).
 * Los compartidos son de otro: se ven, no se tocan.
 */

/**
 * El color del icono de cada recordatorio: en una lista de diez, el color es
 * lo que deja encontrar el tuyo sin leer. Sale del id para que sea ESTABLE; la
 * paleta la da el tema (en oscuro son otros tonos).
 */
function colorDe(id: string, paleta: readonly string[]): string {
  let suma = 0;
  for (let i = 0; i < id.length; i += 1) suma += id.charCodeAt(i);
  return paleta[suma % paleta.length]!;
}

const RECURRENCE_LABEL: Record<string, string> = {
  once: 'Una vez',
  daily: 'Diario',
  weekly: 'Semanal',
};

type Lista = { mine: AgendaReminder[]; shared: AgendaReminder[] };

export function RemindersScreen({
  credential,
  recarga,
  onEditar,
  onCantidad,
}: {
  credential: Credential;
  /** Sube cuando algo se creó, editó o borró: se vuelve a pedir SIN esqueleto. */
  recarga: number;
  onEditar: (reminder: AgendaReminder) => void;
  /** Cuántos están activos: el número del segmento «Recordatorios» (18/10). */
  onCantidad?: (cuantos: number) => void;
}) {
  const colores = useColores();
  const [data, setData] = useState<Lista | null>(null);
  const cantidadRef = useRef(onCantidad);
  cantidadRef.current = onCantidad;
  useEffect(() => {
    if (data) cantidadRef.current?.([...data.mine, ...data.shared].filter((recordatorio) => recordatorio.active).length);
  }, [data]);
  const [fallo, setFallo] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const dataRef = useRef<Lista | null>(null);
  dataRef.current = data;

  const load = useCallback(async () => {
    const result = await agendaGet<Lista>('/reminders', credential.jwt);
    // Sin red NO es «sin recordatorios»: se conserva lo que había y se dice.
    if (result.ok) {
      setData(result.data);
      setFallo(false);
    } else setFallo(true);
  }, [credential.jwt]);

  useEffect(() => {
    void load();
  }, [load, recarga]);

  const toggle = async (reminder: AgendaReminder, active: boolean) => {
    const conValor = (valor: boolean) => (lista: Lista | null) =>
      lista ? { ...lista, mine: lista.mine.map((item) => (item._id === reminder._id ? { ...item, active: valor } : item)) } : lista;
    setData(conValor(active));
    const result = await agendaPost(`/reminders/${reminder._id}/toggle`, credential.jwt, { active });
    // Si el server no lo guardó, el interruptor vuelve: mentir el estado es peor.
    if (!result.ok) setData(conValor(!active));
  };

  if (data === null && !fallo) {
    return (
      <View className="px-4 pt-4" testID="recordatorios-cargando">
        {[0, 1].map((index) => (
          <View key={index} className="mb-3 h-20 rounded-xl bg-surface-variant" />
        ))}
      </View>
    );
  }

  const mine = data?.mine ?? [];
  const shared = data?.shared ?? [];

  return (
    <ScrollView
      testID="pantalla-recordatorios"
      contentContainerStyle={{ padding: 16, paddingBottom: 96, flexGrow: 1 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load().finally(() => setRefreshing(false));
          }}
        />
      }
    >
      {fallo ? (
        <Pressable testID="recordatorios-error" onPress={() => void load()} className="mb-3 flex-row items-center gap-2 rounded-xl bg-error/10 px-4 py-3">
          <RotateCw size={16} color={colores.error} />
          <Text className="flex-1 text-[13px] text-error">No se pudo actualizar. Toca para reintentar.</Text>
        </Pressable>
      ) : null}

      {mine.length === 0 && shared.length === 0 && !fallo ? (
        <View className="flex-1 items-center justify-center px-8" testID="recordatorios-vacio">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Bell size={28} color={colores.primary} />
          </View>
          <Text className="mt-4 text-lg font-semibold text-on-surface">Sin recordatorios</Text>
          <Text className="mt-1 text-center text-sm leading-5 text-on-surface-variant">Crea uno para que no se te pase nada.</Text>
        </View>
      ) : null}

      {mine.length > 0 && shared.length > 0 ? <Rotulo texto="Tuyos" /> : null}
      {mine.map((reminder) => (
        <Fila key={reminder._id} reminder={reminder} propio onPress={() => onEditar(reminder)} onToggle={(v) => void toggle(reminder, v)} />
      ))}

      {shared.length > 0 ? <Rotulo texto="Compartidos en tus chats" /> : null}
      {shared.map((reminder) => (
        <Fila key={reminder._id} reminder={reminder} propio={false} />
      ))}
    </ScrollView>
  );
}

const Rotulo = ({ texto }: { texto: string }) => (
  <Text className="mb-2 mt-2 text-[11px] font-semibold uppercase tracking-wider text-primary">{texto}</Text>
);

function Fila({
  reminder,
  propio,
  onPress,
  onToggle,
}: {
  reminder: AgendaReminder;
  propio: boolean;
  onPress?: () => void;
  onToggle?: (activo: boolean) => void;
}) {
  const colores = useColores();
  const next = nextOccurrence({ startsAt: new Date(reminder.startsAt), recurrence: reminder.recurrence, from: new Date() });
  return (
    <Pressable
      testID={`recordatorio-${reminder._id}`}
      disabled={!propio}
      onPress={onPress}
      android_ripple={propio ? { color: colores.outline } : undefined}
      className={`mb-3 flex-row items-center gap-3 rounded-xl bg-primary/[0.07] p-4 ${reminder.active && next ? '' : 'opacity-60'}`}
    >
      <View className="h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: colorDe(reminder._id, colores.avisos) }}>
        <Bell size={19} color={colores['on-primary']} />
      </View>

      <View className="min-w-0 flex-1">
        <Text className="text-base font-semibold text-on-surface" numberOfLines={1}>
          {reminder.title}
        </Text>
        {reminder.note ? (
          <Text className="text-[13px] text-on-surface-variant" numberOfLines={1}>
            {reminder.note}
          </Text>
        ) : null}
        <View className="mt-1 flex-row items-center gap-2">
          <View className="rounded bg-primary/15 px-1.5 py-0.5">
            <Text className="text-[10px] font-semibold text-primary">{RECURRENCE_LABEL[reminder.recurrence] ?? reminder.recurrence}</Text>
          </View>
          <Text className="text-[11px] text-on-surface-variant">{next ? formatEventWhen(next) : 'Ya pasó'}</Text>
        </View>
      </View>

      {propio && onToggle ? (
        <Interruptor testID={`switch-${reminder._id}`} value={reminder.active} onValueChange={onToggle} />
      ) : null}
    </Pressable>
  );
}
