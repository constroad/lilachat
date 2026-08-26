import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { Check, Search } from 'lucide-react-native';
import type { Contact, ContactGroup } from '@lilachat/shared';
import type { Credential } from '../auth/credentialStore';
import { listContacts } from './contactsApi';
import { useAgendaParaInvitar } from './useAgendaParaInvitar';
import { textoDeInvitacion } from '../settings/actualizacion';

/** La puerta de entrada que se ofrece primero: deja la app actualizándose sola. */
const TIENDA_URL = 'https://lilastore.constroad.com/get';

/**
 * La lista de contactos del diseño «New Group».
 *
 * Composición de la captura: buscador relleno arriba, y la lista **agrupada por
 * letra** con su cabecera; cada fila es avatar + nombre + teléfono debajo, y el
 * círculo de selección a la derecha.
 *
 * Se reusa en los tres lugares donde hace falta elegir gente —nuevo chat, nuevo
 * grupo e invitados de un evento—, que es justo lo que evita que cada pantalla
 * invente su propio selector.
 */
export function ContactPicker({
  credential,
  selected,
  onToggle,
  multiple,
  header,
  invitacion,
}: {
  credential: Credential;
  selected: string[];
  onToggle: (contact: Contact) => void;
  multiple: boolean;
  header?: React.ReactNode;
  /**
   * Cuando viene, al pie va la sección «Invitar a Lilachat» con la gente de la
   * agenda que todavía no está — la misma composición que WhatsApp muestra al
   * tocar el lápiz. El cruce se hace EN EL TELÉFONO (`separarAgenda`).
   */
  invitacion?: { miNombre: string | null; enlaceApp: string };
}) {
  const [groups, setGroups] = useState<ContactGroup[] | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    const result = await listContacts(credential.jwt);
    setGroups(result.ok ? result.data.groups : []);
  }, [credential.jwt]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtrados = useMemo(() => {
    if (!groups) return null;
    const needle = query.trim().toLowerCase();
    if (!needle) return groups;
    return groups
      .map((group) => ({
        ...group,
        contacts: group.contacts.filter((contact) =>
          `${contact.name ?? ''} ${contact.phone}`.toLowerCase().includes(needle)
        ),
      }))
      .filter((group) => group.contacts.length > 0);
  }, [groups, query]);

  return (
    <View className="flex-1">
      <View className="px-4 pb-2">
        <View className="flex-row items-center gap-2 rounded-xl bg-primary/[0.07] px-3 py-2.5">
          <Search size={16} color="#7b7486" />
          <TextInput
            testID="buscar-contactos"
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar contactos…"
            placeholderTextColor="#8b86a0"
            className="min-w-0 flex-1 text-[15px] text-on-surface"
          />
        </View>
      </View>

      {header}

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Nota: la sección de invitar va al FINAL, después de los registrados.
            Arriba está con quién se puede hablar ya; abajo, a quién falta
            traer. Invertirlo pone primero lo que todavía no sirve. */}
        {filtrados === null ? (
          <View className="px-4 pt-2" testID="contactos-cargando">
            {[0, 1, 2].map((index) => (
              <View key={index} className="mb-1 flex-row items-center gap-3 py-2.5">
                <View className="h-11 w-11 rounded-full bg-primary/[0.07]" />
                <View className="flex-1">
                  <View className="h-3 w-1/3 rounded bg-primary/[0.07]" />
                  <View className="mt-2 h-3 w-1/2 rounded bg-primary/[0.07]" />
                </View>
              </View>
            ))}
          </View>
        ) : filtrados.length === 0 ? (
          <Text className="px-8 pt-8 text-center text-sm leading-5 text-on-surface-variant">
            {query
              ? 'Nadie coincide con lo que buscas.'
              : 'Todavía no hay nadie más en Lilachat. Invita a tu familia desde Ajustes.'}
          </Text>
        ) : (
          filtrados.map((group) => (
            <View key={group.letter}>
              {/* La cabecera de letra del diseño. */}
              <Text className="bg-background px-4 py-1 text-[11px] font-semibold text-on-surface-variant">
                {group.letter}
              </Text>
              {group.contacts.map((contact) => {
                const elegido = selected.includes(contact.id);
                return (
                  <Pressable
                    key={contact.id}
                    testID={`contacto-${contact.id}`}
                    onPress={() => onToggle(contact)}
                    className={`min-h-[64px] flex-row items-center gap-3 px-4 py-2.5 ${
                      elegido ? 'bg-primary/[0.07]' : ''
                    }`}
                  >
                    <View className="h-11 w-11 items-center justify-center rounded-full bg-primary">
                      <Text className="text-base font-bold text-on-primary">
                        {(contact.name ?? contact.phone).slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="text-[15px] font-semibold text-on-surface" numberOfLines={1}>
                        {contact.name ?? contact.phone}
                      </Text>
                      <Text className="text-[12px] text-on-surface-variant" numberOfLines={1}>
                        {contact.directChatId ? 'Ya tienen conversación' : contact.phone}
                      </Text>
                    </View>
                    {/* El círculo de selección de la captura. En modo de uno
                        solo no se dibuja: ahí tocar YA es elegir, y un radio
                        que nunca se ve marcado confunde. */}
                    {multiple ? (
                      <View
                        className={`h-6 w-6 items-center justify-center rounded-full border-2 ${
                          elegido ? 'border-primary bg-primary' : 'border-outline/40'
                        }`}
                      >
                        {elegido ? <Check size={13} color="#ffffff" /> : null}
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))
        )}
        {invitacion ? (
          <SeccionInvitar
            registrados={groups?.flatMap((grupo) => grupo.contacts) ?? null}
            miNombre={invitacion.miNombre}
            enlaceApp={invitacion.enlaceApp}
            consulta={query}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

/**
 * «Invitar a Lilachat»: la gente de la agenda que todavía no está.
 *
 * Vive acá abajo y no en su propia pantalla porque es donde la busca quien
 * toca el lápiz: primero con quién puede hablar, después a quién falta traer.
 */
function SeccionInvitar({
  registrados,
  miNombre,
  enlaceApp,
  consulta,
}: {
  registrados: Contact[] | null;
  miNombre: string | null;
  enlaceApp: string;
  consulta: string;
}) {
  const agenda = useAgendaParaInvitar(registrados);

  const compartir = (nombre: string) =>
    void Share.share({
      message: textoDeInvitacion({ tienda: TIENDA_URL, app: enlaceApp, deParte: miNombre }),
      title: `Invitar a ${nombre}`,
    });

  if (agenda.estado === 'pidiendo') return null;

  if (agenda.estado === 'denegado') {
    return (
      <View className="mt-6 px-4">
        <Text className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
          Invitar a Lilachat
        </Text>
        <Text className="text-[13px] leading-5 text-on-surface-variant">
          Sin acceso a tus contactos no podemos mostrarte a quién falta invitar. Se leen en el
          teléfono y no se envían a ningún lado.
        </Text>
        <Pressable
          testID="btn-compartir-enlace"
          onPress={() => compartir('un amigo')}
          className="mt-3 min-h-[48px] items-center justify-center rounded-xl bg-primary px-6"
        >
          <Text className="text-sm font-semibold text-on-primary">Compartir el enlace</Text>
        </Pressable>
      </View>
    );
  }

  const aguja = consulta.trim().toLowerCase();
  const visibles = agenda.paraInvitar.filter((contacto) =>
    `${contacto.nombre} ${contacto.telefono}`.toLowerCase().includes(aguja)
  );

  if (visibles.length === 0) return null;

  return (
    <View className="mt-6" testID="seccion-invitar">
      <Text className="bg-background px-4 py-1 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
        Invitar a Lilachat
      </Text>
      {visibles.map((contacto) => (
        <View
          key={contacto.id}
          testID={`invitable-${contacto.id}`}
          className="min-h-[64px] flex-row items-center gap-3 px-4 py-2.5"
        >
          <View className="h-11 w-11 items-center justify-center rounded-full bg-primary/[0.10]">
            <Text className="text-base font-bold text-primary">
              {contacto.nombre.slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-[15px] font-semibold text-on-surface" numberOfLines={1}>
              {contacto.nombre}
            </Text>
            <Text className="text-[12px] text-on-surface-variant" numberOfLines={1}>
              {contacto.telefono}
            </Text>
          </View>
          <Pressable
            testID={`btn-invitar-${contacto.id}`}
            onPress={() => compartir(contacto.nombre)}
            className="min-h-[44px] items-center justify-center rounded-full bg-primary/[0.10] px-4"
          >
            <Text className="text-[13px] font-semibold text-primary">Invitar</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
