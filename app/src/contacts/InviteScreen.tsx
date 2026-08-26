import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import * as Contacts from 'expo-contacts';
import { Search, Send, X } from 'lucide-react-native';
import { useMargenes } from '../ui/useMargenes';
import { textoDeInvitacion } from '../settings/actualizacion';

/**
 * Invitar a alguien de la agenda del teléfono.
 *
 * **Los contactos NO salen del server y NO viajan a ningún lado.** Se leen del
 * teléfono, se muestran, y lo único que sale de acá es el mensaje que la persona
 * decide compartir. Subir la agenda para cruzarla contra los registrados sería
 * el camino cómodo y es exactamente lo que no se hace: en un chat familiar, la
 * lista de con quién habla alguien es el dato más sensible que hay.
 *
 * Por eso tampoco se marca «este ya tiene Lilachat»: no se puede saber sin
 * mandar los números. Quien ya está aparece en «Nuevo chat», que es donde
 * corresponde.
 */
const TIENDA = 'https://lilastore.constroad.com/get';

type ContactoTelefono = { id: string; nombre: string; telefono: string };

export function InviteScreen({
  visible,
  miNombre,
  enlaceApp,
  onClose,
}: {
  visible: boolean;
  miNombre: string | null;
  /** El APK directo. Vacío si todavía no hay release pública. */
  enlaceApp: string;
  onClose: () => void;
}) {
  const margenes = useMargenes();
  const [permiso, setPermiso] = useState<'pidiendo' | 'ok' | 'denegado'>('pidiendo');
  const [contactos, setContactos] = useState<ContactoTelefono[] | null>(null);
  const [consulta, setConsulta] = useState('');

  const cargar = useCallback(async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      setPermiso('denegado');
      return;
    }
    setPermiso('ok');

    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
    });

    // Un contacto sin número no se puede invitar; uno con varios entra una vez
    // por número, porque no hay forma de saber cuál es el del WhatsApp.
    const filas = data.flatMap((contacto) =>
      (contacto.phoneNumbers ?? [])
        .filter((numero) => Boolean(numero.number))
        .map((numero, indice) => ({
          id: `${contacto.id ?? contacto.name}-${indice}`,
          nombre: contacto.name?.trim() || (numero.number as string),
          telefono: numero.number as string,
        }))
    );

    filas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    setContactos(filas);
  }, []);

  useEffect(() => {
    if (!visible) return;
    setContactos(null);
    setPermiso('pidiendo');
    void cargar();
  }, [visible, cargar]);

  const invitar = async (contacto: ContactoTelefono) => {
    const mensaje = textoDeInvitacion({ tienda: TIENDA, app: enlaceApp, deParte: miNombre });
    // La hoja de compartir de Android: desde ahí elige WhatsApp, SMS o lo que
    // tenga. No se abre WhatsApp a la fuerza — no todo el mundo lo usa, y un
    // enlace `whatsapp://` que no resuelve no hace nada y parece que se rompió.
    await Share.share({ message: `${mensaje}\n\n(${contacto.telefono})` });
  };

  const aguja = consulta.trim().toLowerCase();
  const visibles = (contactos ?? []).filter((contacto) =>
    `${contacto.nombre} ${contacto.telefono}`.toLowerCase().includes(aguja)
  );

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

        {permiso === 'denegado' ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-center text-base font-semibold text-on-surface">
              Sin acceso a tus contactos
            </Text>
            <Text className="mt-2 text-center text-sm leading-5 text-on-surface-variant">
              Lilachat necesita leer tu agenda para mostrarte a quién invitar. Se lee en el
              teléfono y no se envía a ningún lado.
            </Text>
            <Pressable
              testID="btn-compartir-igual"
              onPress={() =>
                void Share.share({
                  message: textoDeInvitacion({
                    tienda: TIENDA,
                    app: enlaceApp,
                    deParte: miNombre,
                  }),
                })
              }
              className="mt-6 min-h-[48px] items-center justify-center rounded-xl bg-primary px-6"
            >
              <Text className="text-sm font-semibold text-on-primary">
                Compartir el enlace igual
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
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

            <ScrollView
              className="flex-1"
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: margenes.pie }}
            >
              {contactos === null ? (
                // Geometría de la fila real: sin esto la lista salta al llegar.
                [0, 1, 2, 3, 4].map((indice) => (
                  <View key={indice} className="mb-2 h-14 rounded-xl bg-surface" />
                ))
              ) : visibles.length === 0 ? (
                <Text className="px-2 py-8 text-center text-sm leading-5 text-on-surface-variant">
                  {aguja
                    ? 'Nadie de tu agenda coincide con eso.'
                    : 'No encontramos contactos en este teléfono.'}
                </Text>
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
                      onPress={() => void invitar(contacto)}
                      className="min-h-[44px] flex-row items-center gap-1.5 rounded-full bg-primary px-4"
                    >
                      <Send size={14} color="#ffffff" />
                      <Text className="text-[13px] font-semibold text-on-primary">Invitar</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </ScrollView>
          </>
        )}
      </View>
    </Modal>
  );
}
