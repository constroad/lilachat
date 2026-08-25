import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Check, Search } from 'lucide-react-native';
import type { Contact, ContactGroup } from '@lilachat/shared';
import type { Credential } from '../auth/credentialStore';
import { listContacts } from './contactsApi';

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
}: {
  credential: Credential;
  selected: string[];
  onToggle: (contact: Contact) => void;
  multiple: boolean;
  header?: React.ReactNode;
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
      </ScrollView>
    </View>
  );
}
