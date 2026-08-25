import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { Bell, Plus } from 'lucide-react-native';
import { formatEventWhen, nextOccurrence } from '@lilachat/shared';
import type { Credential } from '../auth/credentialStore';
import { agendaGet, agendaPost, type AgendaReminder } from './agendaApi';

/**
 * Recordatorios (diseño «My Reminders»).
 *
 * Las DOS pestañas del diseño —«Mis recordatorios» y «Compartidos»— no son
 * decorativas: separan lo que solo me suena a mí de lo que suena en un chat, y
 * mezclarlas haría imposible saber quién más lo está viendo.
 */
/**
 * El color del icono de cada recordatorio.
 *
 * El diseño los pinta distintos (gota azul, teléfono naranja) y eso no es
 * decoración: en una lista de diez, el color es lo que deja encontrar el tuyo
 * sin leer. Sale del id para que sea ESTABLE — si dependiera del orden, el mismo
 * recordatorio cambiaría de color al agregar otro.
 */
const COLORES = ['#6b38d4', '#0058be', '#a12e70', '#c2410c', '#0f766e'];

function colorDe(id: string): string {
  let suma = 0;
  for (let i = 0; i < id.length; i += 1) suma += id.charCodeAt(i);
  return COLORES[suma % COLORES.length]!;
}

const RECURRENCE_LABEL: Record<string, string> = {
  once: 'Una vez',
  daily: 'Diario',
  weekly: 'Semanal',
};

export function RemindersScreen({
  credential,
  onCreate,
  hideFab,
}: {
  credential: Credential;
  onCreate: () => void;
  /** La Agenda pone su propio botón: dos flotantes encimados es un bug visible. */
  hideFab?: boolean;
}) {
  const [tab, setTab] = useState<'mine' | 'shared'>('mine');
  const [data, setData] = useState<{ mine: AgendaReminder[]; shared: AgendaReminder[] } | null>(null);

  const load = useCallback(async () => {
    const result = await agendaGet<{ mine: AgendaReminder[]; shared: AgendaReminder[] }>(
      '/reminders',
      credential.jwt
    );
    setData(result.ok ? result.data : { mine: [], shared: [] });
  }, [credential.jwt]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (reminder: AgendaReminder, active: boolean) => {
    setData((current) =>
      current
        ? {
            mine: current.mine.map((item) =>
              item._id === reminder._id ? { ...item, active } : item
            ),
            shared: current.shared,
          }
        : current
    );
    await agendaPost(`/reminders/${reminder._id}/toggle`, credential.jwt, { active });
  };

  const list = tab === 'mine' ? (data?.mine ?? []) : (data?.shared ?? []);

  return (
    <View className="flex-1 bg-background" testID="pantalla-recordatorios">
      {/* Control segmentado del diseño: dos opciones excluyentes, ancho
          completo, la activa en superficie blanca sobre el riel gris. */}
      <View className="mx-4 mt-3 flex-row rounded-lg bg-primary/[0.07] p-1">
        {(
          [
            { key: 'mine' as const, label: 'Mis recordatorios' },
            { key: 'shared' as const, label: 'Compartidos' },
          ]
        ).map((option) => (
          <Pressable
            key={option.key}
            testID={`tab-recordatorios-${option.key}`}
            onPress={() => setTab(option.key)}
            className={`min-h-[40px] flex-1 items-center justify-center rounded-md ${
              tab === option.key ? 'bg-surface' : ''
            }`}
          >
            <Text
              className={`text-[13px] font-semibold ${
                tab === option.key ? 'text-on-surface' : 'text-on-surface-variant'
              }`}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {data === null ? (
        <View className="px-4 pt-4" testID="recordatorios-cargando">
          {[0, 1].map((index) => (
            <View key={index} className="mb-3 h-20 rounded-xl bg-surface-variant" />
          ))}
        </View>
      ) : list.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8" testID="recordatorios-vacio">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Bell size={28} color="#6b38d4" />
          </View>
          <Text className="mt-4 text-lg font-semibold text-on-surface">Sin recordatorios</Text>
          <Text className="mt-1 text-center text-sm leading-5 text-on-surface-variant">
            {tab === 'mine'
              ? 'Crea uno para que no se te pase nada.'
              : 'Acá aparecen los que se comparten en tus chats.'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {list.map((reminder) => {
            const next = nextOccurrence({
              startsAt: new Date(reminder.startsAt),
              recurrence: reminder.recurrence,
              from: new Date(),
            });
            return (
              <View
                key={reminder._id}
                testID={`recordatorio-${reminder._id}`}
                className="mb-3 flex-row items-center gap-3 rounded-xl bg-primary/[0.07] p-4"
              >
                {/* Icono con COLOR PROPIO por recordatorio, como en el diseño
                    (gota azul, teléfono naranja). Todos del mismo morado los
                    volvía indistinguibles de un vistazo, que es justo lo que la
                    lista tiene que resolver. */}
                <View
                  className="h-11 w-11 items-center justify-center rounded-full"
                  style={{ backgroundColor: colorDe(reminder._id) }}
                >
                  <Bell size={19} color="#ffffff" />
                </View>

                <View className="min-w-0 flex-1">
                  <Text className="text-base font-semibold text-on-surface" numberOfLines={1}>
                    {reminder.title}
                  </Text>
                  {/* SEGUNDA línea: la nota. El diseño tiene tres líneas y yo
                      había hecho dos, apretando el chip contra el título. */}
                  {reminder.note ? (
                    <Text className="text-[13px] text-on-surface-variant" numberOfLines={1}>
                      {reminder.note}
                    </Text>
                  ) : null}
                  <View className="mt-1 flex-row items-center gap-2">
                    <View className="rounded bg-primary/15 px-1.5 py-0.5">
                      <Text className="text-[10px] font-semibold text-primary">
                        {RECURRENCE_LABEL[reminder.recurrence] ?? reminder.recurrence}
                      </Text>
                    </View>
                    <Text className="text-[11px] text-on-surface-variant">
                      {next ? formatEventWhen(next) : 'Ya pasó'}
                    </Text>
                  </View>
                </View>

                {tab === 'mine' ? (
                  <Switch
                    testID={`switch-${reminder._id}`}
                    value={reminder.active}
                    onValueChange={(value) => void toggle(reminder, value)}
                    trackColor={{ true: '#6b38d4' }}
                  />
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}

      {hideFab ? null : (
        <Pressable
          testID="btn-nuevo-recordatorio"
          onPress={onCreate}
          className="absolute bottom-5 right-5 h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg"
        >
          <Plus size={24} color="#ffffff" />
        </Pressable>
      )}
    </View>
  );
}
