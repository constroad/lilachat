import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { Search, Send, X } from 'lucide-react-native';
import type { Contact } from '@lilachat/shared';
import type { Credential } from '../auth/credentialStore';
import { useMargenes } from '../ui/useMargenes';
import { textoDeInvitacion } from '../settings/actualizacion';
import { listContacts } from './contactsApi';
import { useAgendaParaInvitar } from './useAgendaParaInvitar';

/**
 * Invitar a alguien de la agenda del teléfono.
 *
 * **Los contactos NO viajan.** Se leen en el aparato y se cruzan contra los
 * registrados que el server ya nos dio; lo único que sale de acá es el mensaje
 * que la persona decide compartir.
 *
 * Nació mostrando esqueletos para siempre: la lectura de la agenda fallaba y
 * «cargando» era la ausencia de datos, así que el fallo tenía la misma cara que
 * una carga lenta. Ahora los cuatro estados —cargando, sin permiso, error y
 * listo— muestran cosas distintas, y ninguno es el vacío.
 */
const TIENDA = 'https://lilastore.constroad.com/get';

export function InviteScreen({
  visible,
  credential,
  enlaceApp,
  onClose,
}: {
  visible: boolean;
  credential: Credential;
  /** El APK directo. Vacío si todavía no hay release pública. */
  enlaceApp: string;
  onClose: () => void;
}) {
  const margenes = useMargenes();
  const [registrados, setRegistrados] = useState<Contact[] | null>(null);
  const [consulta, setConsulta] = useState('');

  const cargarRegistrados = useCallback(async () => {
    const resultado = await listContacts(credential.jwt);
    // Si el server no contesta se sigue igual: sin la lista se ofrece invitar a
    // TODA la agenda, que es peor que nada pero mucho mejor que una pantalla
    // que no hace nada.
    setRegistrados(resultado.ok ? resultado.data.groups.flatMap((grupo) => grupo.contacts) : []);
  }, [credential.jwt]);

  useEffect(() => {
    if (!visible) return;
    void cargarRegistrados();
  }, [visible, cargarRegistrados]);

  const agenda = useAgendaParaInvitar(registrados);

  const compartir = (nombre: string) =>
    void Share.share({
      message: textoDeInvitacion({
        tienda: TIENDA,
        app: enlaceApp,
        deParte: credential.name ?? null,
      }),
      title: `Invitar a ${nombre}`,
    });

  const aguja = consulta.trim().toLowerCase();
  const visibles =
    agenda.estado === 'listo'
      ? agenda.paraInvitar.filter((contacto) =>
          `${contacto.nombre} ${contacto.telefono}`.toLowerCase().includes(aguja)
        )
      : [];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-background" testID="pantalla-invitar">
        <View
          className="flex-row items-center gap-2 px-4 pb-3"
          style={{ paddingTop: margenes.cabecera }}
        >
          <Pressable
            onPress={onClose}
            testID="btn-cerrar-invitar"
            className="h-11 w-11 items-center justify-center rounded-full"
          >
            <X size={22} color="#0b1c30" />
          </Pressable>
          <Text className="flex-1 text-xl font-bold text-on-surface">Invitar</Text>
        </View>

        {agenda.estado === 'listo' ? (
          <View className="mx-4 mb-2 flex-row items-center gap-2 rounded-full bg-surface px-3 py-2">
            <Search size={16} color="#7b7486" />
            <TextInput
              testID="buscar-contacto-telefono"
              value={consulta}
              onChangeText={setConsulta}
              placeholder="Buscar en tu agenda"
              placeholderTextColor="#7b7486"
              className="min-w-0 flex-1 text-sm text-on-surface"
            />
          </View>
        ) : null}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: margenes.pie }}
        >
          {agenda.estado === 'cargando' ? (
            [0, 1, 2, 3, 4].map((indice) => (
              <View key={indice} className="mb-2 h-14 rounded-xl bg-surface" />
            ))
          ) : agenda.estado === 'denegado' ? (
            <Aviso
              titulo="Sin acceso a tus contactos"
              cuerpo="Lilachat necesita leer tu agenda para mostrarte a quién invitar. Se lee en el teléfono y no se envía a ningún lado."
              accion="Compartir el enlace igual"
              onAccion={() => compartir('un amigo')}
            />
          ) : agenda.estado === 'error' ? (
            // El detalle va a la vista, no solo al log: sin él, «no se pudo» es
            // indistinguible de «no hay nadie» para quien reporta el problema.
            <Aviso
              titulo="No pudimos leer tu agenda"
              cuerpo={`Ya nos avisó solo. Podés compartir el enlace igual.\n\n(${agenda.mensaje})`}
              accion="Compartir el enlace"
              onAccion={() => compartir('un amigo')}
            />
          ) : visibles.length === 0 ? (
            <Aviso
              titulo={aguja ? 'Nadie coincide' : 'Toda tu agenda ya está'}
              cuerpo={
                aguja
                  ? 'Nadie de tu agenda coincide con lo que buscas.'
                  : 'No encontramos a nadie de tu agenda que falte invitar.'
              }
              accion="Compartir el enlace"
              onAccion={() => compartir('un amigo')}
            />
          ) : (
            visibles.map((contacto) => (
              <View
                key={contacto.id}
                testID={`contacto-tel-${contacto.id}`}
                className="mb-2 min-h-[56px] flex-row items-center gap-3 rounded-xl border border-outline/10 bg-surface px-4 py-2"
              >
                <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Text className="text-sm font-bold text-primary">
                    {contacto.nombre.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-semibold text-on-surface" numberOfLines={1}>
                    {contacto.nombre}
                  </Text>
                  <Text className="text-[12px] text-on-surface-variant" numberOfLines={1}>
                    {contacto.telefono}
                  </Text>
                </View>
                <Pressable
                  testID={`invitar-${contacto.id}`}
                  onPress={() => compartir(contacto.nombre)}
                  className="min-h-[44px] flex-row items-center gap-1.5 rounded-full bg-primary px-4"
                >
                  <Send size={14} color="#ffffff" />
                  <Text className="text-[13px] font-semibold text-on-primary">Invitar</Text>
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

/** Los estados que no son una lista. Ninguno deja la pantalla en blanco. */
function Aviso({
  titulo,
  cuerpo,
  accion,
  onAccion,
}: {
  titulo: string;
  cuerpo: string;
  accion: string;
  onAccion: () => void;
}) {
  return (
    <View className="items-center px-4 pt-10">
      <Text className="text-center text-base font-semibold text-on-surface">{titulo}</Text>
      <Text className="mt-2 text-center text-sm leading-5 text-on-surface-variant">{cuerpo}</Text>
      <Pressable
        testID="btn-compartir-igual"
        onPress={onAccion}
        className="mt-6 min-h-[48px] items-center justify-center rounded-xl bg-primary px-6"
      >
        <Text className="text-sm font-semibold text-on-primary">{accion}</Text>
      </Pressable>
    </View>
  );
}
