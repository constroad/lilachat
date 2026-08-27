import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { Check, Search } from 'lucide-react-native';
import { groupContactsByLetter, type Contact, type ContactGroup } from '@lilachat/shared';
import type { Credential } from '../auth/credentialStore';
import { emparejarAgenda, invitarContacto, listContacts } from './contactsApi';
import { useAgendaDelTelefono, useAgendaParaInvitar } from './useAgendaParaInvitar';
import { buscarEn, indexarParaBuscar } from './busqueda';
import { useConsultaDiferida } from '../ui/useConsultaDiferida';
import { textoDeInvitacion } from '../settings/actualizacion';

/** La puerta de entrada que se ofrece primero: deja la app actualizándose sola. */
const TIENDA_URL = 'https://lilastore.constroad.com/get';

/** Cuántos contactos de la agenda se dibujan sin buscar. Ver `SeccionInvitar`. */
const MAXIMO_INVITABLES = 30;

/** Junta dos listas agrupadas sin repetir a nadie, y reagrupa por letra. */
function unirGrupos(a: ContactGroup[], b: ContactGroup[]): ContactGroup[] {
  const porId = new Map<string, Contact>();
  for (const grupo of [...a, ...b]) {
    for (const contacto of grupo.contacts) porId.set(contacto.id, contacto);
  }
  return groupContactsByLetter([...porId.values()]);
}

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
  const agendaCruda = useAgendaDelTelefono();
  const [query, setQuery] = useState('');

  /**
   * Quiénes de MI agenda están en Lilachat — el modelo de WhatsApp.
   *
   * Se pregunta por los números guardados en vez de recibir el padrón: así
   * nadie descubre un número que no tuviera. `GET /api/contacts` sigue dando
   * con quien ya tengo conversación, que es lo que se ve mientras la agenda
   * carga o si no hay permiso.
   */
  const load = useCallback(async () => {
    const yaHablo = await listContacts(credential.jwt);
    const base = yaHablo.ok ? yaHablo.data.groups : [];

    if (agendaCruda.estado !== 'listo') {
      setGroups(base);
      return;
    }

    const emparejados = await emparejarAgenda(
      credential.jwt,
      agendaCruda.agenda.map((contacto) => contacto.telefono)
    );
    // Con quien ya hablo SIEMPRE está, aunque no lo tenga agendado: perder una
    // conversación abierta porque el contacto no está en la libreta sería peor
    // que mostrar un número de más.
    setGroups(emparejados.ok ? unirGrupos(base, emparejados.data.groups) : base);
  }, [credential.jwt, agendaCruda]);

  useEffect(() => {
    void load();
  }, [load]);

  const consultaDiferida = useConsultaDiferida(query);

  const filtrados = useMemo(() => {
    if (!groups) return null;
    const needle = consultaDiferida.trim().toLowerCase();
    if (!needle) return groups;
    return groups
      .map((group) => ({
        ...group,
        contacts: group.contacts.filter((contact) =>
          `${contact.name ?? ''} ${contact.phone}`.toLowerCase().includes(needle)
        ),
      }))
      .filter((group) => group.contacts.length > 0);
  }, [groups, consultaDiferida]);

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
              // La invitación está JUSTO abajo desde el 26/08/2026: mandar a
              // otra pantalla era un paso de más y una copia que envejeció.
              : 'Todavía no hay nadie más en Lilachat. Invitá a alguien desde acá abajo.'}
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
            jwt={credential.jwt}
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
  jwt,
  registrados,
  miNombre,
  enlaceApp,
  consulta,
}: {
  jwt: string;
  registrados: Contact[] | null;
  miNombre: string | null;
  enlaceApp: string;
  consulta: string;
}) {
  const agenda = useAgendaParaInvitar(registrados);
  const [aviso, setAviso] = useState<string | null>(null);

  /**
   * **Todos los hooks ANTES de cualquier return.**
   *
   * Estaban después de los `return null` de «cargando», «error» y «denegado»:
   * el primer render salía con 2 hooks y el siguiente con 5, y React tiraba
   * «Rendered more hooks than during the previous render» — la pantalla de
   * «Algo se rompió» al tocar el lápiz (27/08/2026).
   *
   * Este repo YA tenía la lección escrita en `web/src/App.tsx`, del mismo
   * defecto en la pantalla de acceso. Se repitió igual.
   */
  const indexados = useMemo(
    () => indexarParaBuscar(agenda.estado === 'listo' ? agenda.paraInvitar : []),
    [agenda]
  );
  const diferida = useConsultaDiferida(consulta);
  const coinciden = useMemo(() => buscarEn(indexados, diferida), [indexados, diferida]);


  /**
   * Primero se CREA la admisión, después se comparte. Sin el primer paso la
   * persona instala la app y el server nunca le manda el código.
   */
  const invitar = async (contacto: { nombre: string; telefono: string } | null) => {
    if (contacto) {
      const alta = await invitarContacto(jwt, contacto.telefono);
      if (!alta.ok) {
        setAviso(alta.message ?? 'No se pudo habilitar a esa persona.');
        return;
      }
      setAviso(null);
    }
    await Share.share({
      message: textoDeInvitacion({ tienda: TIENDA_URL, app: enlaceApp, deParte: miNombre }),
      title: contacto ? `Invitar a ${contacto.nombre}` : 'Invitar a Lilachat',
    });
  };

  if (agenda.estado === 'cargando') return null;

  // Un fallo al leer la agenda NO se esconde: antes esto dejaba la sección
  // invisible y parecía que no había nadie a quien invitar.
  if (agenda.estado === 'error') {
    return (
      <View className="mt-6 px-4" testID="invitar-con-error">
        <Text className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
          Invitar a Lilachat
        </Text>
        <Text className="text-[13px] leading-5 text-on-surface-variant">
          No pudimos leer tu agenda. Ya nos avisó solo.
        </Text>
        <Pressable
          testID="btn-compartir-enlace"
          onPress={() => void invitar(null)}
          className="mt-3 min-h-[48px] items-center justify-center rounded-xl bg-primary px-6"
        >
          <Text className="text-sm font-semibold text-on-primary">Compartir el enlace</Text>
        </Pressable>
      </View>
    );
  }

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
          onPress={() => void invitar(null)}
          className="mt-3 min-h-[48px] items-center justify-center rounded-xl bg-primary px-6"
        >
          <Text className="text-sm font-semibold text-on-primary">Compartir el enlace</Text>
        </Pressable>
      </View>
    );
  }

  /**
   * La clave de búsqueda se calcula UNA vez, no en cada tecla. Antes esto
   * recorría ~600 contactos armando un string y bajándolo a minúsculas por
   * cada render — era lo que hacía sentir trabado el buscador.
  if (coinciden.length === 0) return null;

  /**
   * Se dibujan las primeras y no las 600.
   *
   * Esta sección vive dentro de un `ScrollView`, que monta TODAS las filas de
   * una: con una agenda de 633 contactos, abrir «nuevo chat» tardaba segundos.
   * El buscador está justo arriba y es el camino real para encontrar a alguien
   * — nadie scrollea 600 filas.
   */
  const visibles = coinciden.slice(0, MAXIMO_INVITABLES);
  const ocultos = coinciden.length - visibles.length;

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
            onPress={() => void invitar(contacto)}
            className="min-h-[44px] items-center justify-center rounded-full bg-primary/[0.10] px-4"
          >
            <Text className="text-[13px] font-semibold text-primary">Invitar</Text>
          </Pressable>
        </View>
      ))}
      {aviso ? (
        <Text testID="aviso-invitar" className="px-4 pb-1 text-[12px] text-error">
          {aviso}
        </Text>
      ) : null}
      {ocultos > 0 ? (
        <Text className="px-4 py-3 text-[12px] text-on-surface-variant">
          Y {ocultos} más en tu agenda. Buscá por nombre para encontrarlos.
        </Text>
      ) : null}
    </View>
  );
}
