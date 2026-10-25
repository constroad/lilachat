import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Check, Search } from 'lucide-react-native';
import {
  candidatosParaSumar,
  groupContactsByLetter,
  spaceMembersAsContacts,
  type Contact,
  type ContactGroup,
} from '@lilachat/shared';
import type { Credential } from '../auth/credentialStore';
import { spaceMembers } from '../spaces/spacesApi';
import { emparejarAgenda, listContacts } from './contactsApi';
import { useAgendaDelTelefono, useAgendaParaInvitar } from './useAgendaParaInvitar';
import { buscarEn, indexarParaBuscar } from './busqueda';
import { useConsultaDiferida } from '../ui/useConsultaDiferida';
import { useInvitar } from './useInvitar';
import { useColores } from '../ui/tema';
import { Avatar } from '../ui/Avatar';

/** El avatar de cada contacto (dp): 44, el mismo en toda lista de personas. */
const AVATAR_DE_CONTACTO = 44;
/** 16 de margen + el avatar + 12 de aire: donde empieza el nombre. */
const SANGRIA_DEL_NOMBRE = 16 + AVATAR_DE_CONTACTO + 12;

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
  conInvitar,
  excluidos,
  vacio,
  spaceId,
}: {
  credential: Credential;
  selected: string[];
  onToggle: (contact: Contact) => void;
  multiple: boolean;
  header?: React.ReactNode;
  /**
   * Con `true`, al pie va la sección «Invitar a Lilachat» con la gente de la
   * agenda que todavía no está — la misma composición que WhatsApp muestra al
   * tocar el lápiz. El cruce se hace EN EL TELÉFONO (`separarAgenda`).
   */
  conInvitar?: boolean;
  /**
   * Quiénes NO se pueden elegir: los que ya están en el grupo al que se suma.
   *
   * Se esconden en vez de mostrarse y fallar al tocarlos: hacerle descubrir la
   * regla a los golpes es peor que no ofrecer la opción.
   */
  excluidos?: readonly string[];
  /** Qué decir cuando no queda nadie para elegir (y no hay búsqueda). */
  vacio?: string;
  /**
   * Inside a space the list is ITS active members, not the contacts: someone who
   * signed up with a phone and never talked to the person adding is no contact,
   * yet is in the space (25/10/2026, Max in «Constroad»). No phone book, no
   * «Invitar».
   */
  spaceId?: string;
}) {
  const colores = useColores();
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
    //
    // `?? []`: hasta el 18/10 el server contestaba sin `groups` si ningún número
    // de la agenda era válido, y esto reventaba con el selector en esqueleto.
    setGroups(emparejados.ok ? unirGrupos(base, emparejados.data.groups ?? []) : base);
  }, [credential.jwt, agendaCruda]);

  useEffect(() => {
    if (!spaceId) void load();
  }, [load, spaceId]);

  useEffect(() => {
    if (!spaceId) return;
    let current = true;
    void spaceMembers(credential.jwt, spaceId).then((result) => {
      if (current) setGroups(result.ok ? spaceMembersAsContacts(result.data.members) : []);
    });
    return () => {
      current = false;
    };
  }, [credential.jwt, spaceId]);

  const consultaDiferida = useConsultaDiferida(query);

  /**
   * Los elegibles y el padrón completo salen de la MISMA llamada: la sección
   * «Invitar a Lilachat» se calcula con TODOS los registrados, incluidos los que
   * ya están en el grupo — si no, quien ya está adentro reaparecería abajo
   * ofreciéndole instalar la app que está usando.
   */
  const { paraSumar: elegibles, registrados: todos } = useMemo(
    () => candidatosParaSumar({ registrados: groups ?? [], yaEstan: excluidos ?? [] }),
    [groups, excluidos]
  );

  const filtrados = useMemo(() => {
    if (!groups) return null;
    const needle = consultaDiferida.trim().toLowerCase();
    if (!needle) return elegibles;
    return elegibles
      .map((group) => ({
        ...group,
        contacts: group.contacts.filter((contact) =>
          `${contact.name ?? ''} ${contact.phone}`.toLowerCase().includes(needle)
        ),
      }))
      .filter((group) => group.contacts.length > 0);
  }, [groups, elegibles, consultaDiferida]);

  return (
    <View className="flex-1">
      <View className="px-4 pb-2">
        <View className="flex-row items-center gap-2 rounded-xl bg-primary/[0.07] px-3 py-2.5">
          <Search size={16} color={colores.outline} />
          <TextInput
            testID="buscar-contactos"
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar contactos…"
            placeholderTextColor={colores["on-surface-variant"]}
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
              : (vacio ?? 'Todavía no hay nadie más en Lilachat. Invita a alguien desde aquí abajo.')}
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
                    <Avatar nombre={contact.name ?? contact.phone} tamano={AVATAR_DE_CONTACTO} />
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
                        {elegido ? <Check size={13} color={colores["on-primary"]} /> : null}
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))
        )}
        {conInvitar ? (
          <SeccionInvitar jwt={credential.jwt} registrados={groups === null ? null : todos} consulta={query} />
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
  consulta,
}: {
  jwt: string;
  registrados: Contact[] | null;
  consulta: string;
}) {
  const colores = useColores();
  const agenda = useAgendaParaInvitar(registrados);
  const { invitar, invitando, fallo } = useInvitar(jwt);

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
   * Sin nadie a quien invitar, la sección entera NO se dibuja.
   *
   * Este `return` estuvo COMENTADO sin querer: el bloque de documentación de
   * arriba quedó sin cerrar y se tragó la línea, así que la cabecera «Invitar a
   * Lilachat» se pintaba sobre una lista vacía. Un defecto invisible al leer el
   * archivo: la línea muerta parecía parte del comentario.
   */
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
        <View key={contacto.id}>
          <View testID={`invitable-${contacto.id}`} className="min-h-[64px] flex-row items-center gap-3 px-4 py-2.5">
            <Avatar nombre={contacto.nombre} tamano={AVATAR_DE_CONTACTO} />
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
              disabled={invitando === contacto.id}
              className="min-h-[44px] flex-row items-center justify-center gap-1.5 rounded-full bg-primary/[0.10] px-4"
            >
              {invitando === contacto.id ? <ActivityIndicator size="small" color={colores.primary} /> : null}
              <Text className="text-[13px] font-semibold text-primary">Invitar</Text>
            </Pressable>
          </View>
          {/* El motivo va debajo de ESTA fila (FL13d): al pie de la lista quedaba
              fuera de la pantalla y el botón parecía no hacer nada. */}
          {fallo?.id === contacto.id ? (
            <Text testID={`fallo-invitar-${contacto.id}`} className="pb-2.5 pr-4 text-[12px] text-error" style={{ paddingLeft: SANGRIA_DEL_NOMBRE }}>
              {fallo.texto}
            </Text>
          ) : null}
        </View>
      ))}
      {ocultos > 0 ? (
        <Text className="px-4 py-3 text-[12px] text-on-surface-variant">
          Y {ocultos} más en tu agenda. Busca por nombre para encontrarlos.
        </Text>
      ) : null}
    </View>
  );
}
