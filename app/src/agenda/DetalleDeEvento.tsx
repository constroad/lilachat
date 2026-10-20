import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { CalendarDays, MapPin, Pencil, UserPlus, X } from 'lucide-react-native';
import type { Credential } from '../auth/credentialStore';
import { ContactPicker } from '../contacts/ContactPicker';
import { agendaPorTelefono } from '../contacts/agendaEnMemoria';
import { agendaPost, type AgendaEvent } from './agendaApi';
import { asistentesPorRespuesta, cuandoDelEvento, origenDelEvento } from '@lilachat/shared';
import { useMargenes } from '../ui/useMargenes';
import { useColores } from '../ui/tema';

/**
 * El detalle de un evento, para TODOS (FL10, auditoría §46.3: quien no lo
 * creó no veía quiénes van ni en qué chat). Quien lo creó lo edita desde acá;
 * con «Pueden invitar a otros», cualquiera de los invitados suma gente.
 */
export function DetalleDeEvento(props: {
  evento: AgendaEvent | null;
  credential: Credential;
  onCerrar: () => void;
  onEditar: (evento: AgendaEvent) => void;
  /** Se sumó gente: la lista se vuelve a pedir. */
  onInvitados: () => void;
}) {
  const colores = useColores();
  const margenes = useMargenes();
  const { evento, credential } = props;
  const [invitando, setInvitando] = useState(false);
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  // La hoja vive montada: al abrir otro evento, lo del anterior se limpia.
  useEffect(() => {
    setInvitando(false);
    setElegidos([]);
    setError('');
  }, [evento?.id]);

  if (!evento) return null;
  const agenda = agendaPorTelefono();
  const yo = credential.userId;
  const personas = evento.personas ?? {};
  const asistentes = evento.attendees ?? [];
  const origen = origenDelEvento({
    chat: evento.chat,
    creadorId: evento.createdBy ?? '',
    invitadoPor: asistentes.find((a) => a.userId === yo)?.invitedBy,
    personas,
    yo,
    agenda,
  });

  const invitar = async () => {
    if (elegidos.length === 0 || enviando) return;
    setEnviando(true);
    const respuesta = await agendaPost<{ agregados: number }>(`/events/${evento.id}/invitar`, credential.jwt, { userIds: elegidos });
    setEnviando(false);
    if (!respuesta.ok) return setError(respuesta.message ?? 'No se pudo invitar. Inténtalo de nuevo.');
    setInvitando(false);
    setElegidos([]);
    props.onInvitados();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={invitando ? () => setInvitando(false) : props.onCerrar}>
      <Pressable className="flex-1 bg-black/40" onPress={props.onCerrar} accessibilityLabel="Cerrar" />
      <View className="max-h-[85%] rounded-t-xl bg-surface px-5 pt-3" style={{ paddingBottom: margenes.pie + 8 }} testID="hoja-detalle-evento">
        <View className="mb-1 flex-row items-center">
          <Text className="min-w-0 flex-1 text-lg font-bold text-on-surface" numberOfLines={2}>
            {invitando ? 'Invitar a alguien' : evento.title}
          </Text>
          <Pressable testID="btn-cerrar-detalle-evento" accessibilityLabel="Cerrar" onPress={invitando ? () => setInvitando(false) : props.onCerrar} className="h-11 w-11 items-center justify-center">
            <X size={20} color={colores['on-surface-variant']} />
          </Pressable>
        </View>

        {invitando ? (
          <>
            <View className="h-80">
              <ContactPicker
                credential={credential}
                multiple
                selected={elegidos}
                excluidos={asistentes.map((a) => a.userId)}
                vacio="Todos tus contactos ya están invitados."
                onToggle={(contacto) =>
                  setElegidos((antes) => (antes.includes(contacto.id) ? antes.filter((id) => id !== contacto.id) : [...antes, contacto.id]))
                }
              />
            </View>
            {error ? <Text className="mt-2 text-sm text-error">{error}</Text> : null}
            <Pressable
              testID="btn-confirmar-invitar"
              disabled={elegidos.length === 0 || enviando}
              onPress={() => void invitar()}
              className={`mt-3 min-h-[48px] items-center justify-center rounded-lg ${elegidos.length === 0 || enviando ? 'bg-primary/40' : 'bg-primary'}`}
            >
              <Text className="text-[15px] font-bold text-on-primary">
                {enviando ? 'Invitando…' : elegidos.length > 0 ? `Invitar (${elegidos.length})` : 'Elige a quién'}
              </Text>
            </Pressable>
          </>
        ) : (
          <ScrollView>
            {origen ? <Text className="text-[12px] text-on-surface-variant" testID="origen-evento">{origen}</Text> : null}
            <View className="mt-3 flex-row items-center gap-2">
              <CalendarDays size={16} color={colores.outline} />
              <Text className="min-w-0 flex-1 text-[15px] text-on-surface" testID="cuando-evento">
                {cuandoDelEvento(evento.startsAt, evento.endsAt)}
              </Text>
            </View>
            {evento.location ? (
              <View className="mt-2 flex-row items-center gap-2">
                <MapPin size={16} color={colores.outline} />
                <Text className="min-w-0 flex-1 text-[15px] text-on-surface">{evento.location}</Text>
              </View>
            ) : null}
            {evento.description ? <Text className="mt-3 text-[14px] leading-5 text-on-surface-variant">{evento.description}</Text> : null}

            {asistentesPorRespuesta({ asistentes, personas, yo, agenda }).map((grupo) => (
              <View key={grupo.clave} className="mt-4" testID={`asistentes-${grupo.clave}`}>
                <Text className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                  {grupo.titulo} · {grupo.nombres.length}
                </Text>
                {grupo.nombres.map((nombre, indice) => (
                  <Text key={`${grupo.clave}-${indice}`} className="min-h-[36px] py-2 text-[15px] text-on-surface">
                    {nombre}
                  </Text>
                ))}
              </View>
            ))}

            <View className="mt-4 flex-row gap-2">
              {evento.puedoInvitar ? (
                <Pressable testID="btn-invitar-evento" onPress={() => setInvitando(true)} className="min-h-[48px] flex-1 flex-row items-center justify-center gap-2 rounded-lg bg-primary/10">
                  <UserPlus size={17} color={colores.primary} />
                  <Text className="text-[14px] font-semibold text-primary">Invitar</Text>
                </Pressable>
              ) : null}
              {evento.mio ? (
                <Pressable testID="btn-editar-evento" onPress={() => props.onEditar(evento)} className="min-h-[48px] flex-1 flex-row items-center justify-center gap-2 rounded-lg bg-surface-variant">
                  <Pencil size={16} color={colores['on-surface-variant']} />
                  <Text className="text-[14px] font-semibold text-on-surface">Editar</Text>
                </Pressable>
              ) : null}
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}
