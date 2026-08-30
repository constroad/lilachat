import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Phone,
  Search,
  MoreVertical,
  UserPlus,
  Video,
} from 'lucide-react-native';
import { Linking } from 'react-native';
import {
  accionesDeMiembro,
  nombreDeContacto,
  puedeEditarInfo,
  clasificarMedias,
  type AccionDeMiembro,
} from '@lilachat/shared';
import { EditarNombreDeGrupo } from './EditarNombreDeGrupo';
import { elegirFotoDeGrupo, subirFotoDeGrupo } from './fotoDeGrupo';
import { IdentidadDelChat } from './IdentidadDelChat';
import { confirmacionDe } from './confirmacionesDeMiembro';
import { AjustesDelChat } from './AjustesDelChat';
import { AccionesDeMiembro } from './AccionesDeMiembro';
import { ElegirParaSumar } from './ElegirParaSumar';
import type { Credential } from '../auth/credentialStore';
import { agendaPorTelefono } from '../contacts/agendaEnMemoria';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';
import type { ServerMessage } from './socketClient';

/**
 * «Chat Detail» — la pantalla de `design/stitch/info-grupo-alpha.png`.
 *
 * Estaba diseñada y sin implementar, y José lo notó: «no está implementada la
 * screen de detail chat, revisá nuevamente Stitch porque esa screen sí existe».
 * Tenía razón; peor todavía, yo había construido el visor de imágenes sin mirar
 * su diseño, que también existe.
 *
 * **Sirve para 1:1 y para grupo, y no son la misma pantalla.** El diseño muestra
 * un grupo, pero la mayoría de las conversaciones son de a dos: ahí no hay
 * «participantes» que listar ni grupo del que salir, y dejar esas filas vacías o
 * inertes es peor que no ponerlas. Lo que cambia se decide por `kind`.
 */
type Miembro = {
  id: string;
  name: string | null;
  phone: string | null;
  role: 'admin' | 'member';
  esYo: boolean;
};

type Detalle = {
  id: string;
  kind: 'direct' | 'group';
  name?: string;
  avatarUrl?: string;
  encrypted: boolean;
  members: Miembro[];
};

type Estado =
  | { fase: 'cargando' }
  | { fase: 'error'; mensaje: string }
  | { fase: 'listo'; detalle: Detalle };

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://lilachat.constroad.com';

export function ChatDetailScreen({
  visible,
  chatId,
  chatName,
  credential,
  mensajes,
  onCerrar,
  onSalio,
  onLlamar,
  onVerImagen,
  onInfoCambiada,
}: {
  visible: boolean;
  chatId: string;
  chatName: string;
  credential: Credential;
  /** Los mensajes ya cargados: de ahí sale la tira de multimedia, sin pedir nada. */
  mensajes: ServerMessage[];
  onCerrar: () => void;
  /**
   * Se salió del grupo: hay que cerrar TAMBIÉN la conversación.
   *
   * Cerrar solo el detalle deja a la persona dentro del chat que acaba de
   * abandonar, con el campo de escribir habilitado sobre algo donde ya no puede
   * escribir. Hay que tocar atrás para enterarse de que funcionó (visto en el
   * emulador, 29/08/2026).
   */
  onSalio?: () => void;
  onLlamar?: (video: boolean) => void;
  onVerImagen?: (url: string) => void;
  /**
   * Cambió el nombre o la foto: la cabecera de la conversación de atrás sigue
   * mostrando los viejos hasta que la lista se recargue, y ver el nombre nuevo
   * acá y el viejo al cerrar se lee como que no se guardó.
   */
  onInfoCambiada?: (info: { name?: string; avatarUrl?: string }) => void;
}) {
  const colores = useColores();
  const margenes = useMargenes();
  const [estado, setEstado] = useState<Estado>({ fase: 'cargando' });
  const [silenciado, setSilenciado] = useState(false);

  const [accionando, setAccionando] = useState(false);
  /** La hoja para elegir a quién sumar. */
  const [agregando, setAgregando] = useState(false);
  /** De qué participante está abierta la hoja de acciones. */
  const [menuDe, setMenuDe] = useState<Miembro | null>(null);
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [aviso, setAviso] = useState('');

  /**
   * Sumar o salir. Las dos recargan el detalle al terminar: es la lista que la
   * persona está mirando, y dejarla vieja después de una acción propia es lo que
   * hace dudar de si funcionó.
   */
  const llamar = useCallback(
    async (
      ruta: string,
      cuerpo?: Record<string, unknown>,
      metodo: 'POST' | 'DELETE' | 'PATCH' = 'POST'
    ) => {
      setAccionando(true);
      setAviso('');
      try {
        const respuesta = await fetch(`${BASE_URL}/api/chats/${chatId}/${ruta}`, {
          method: metodo,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${credential.jwt}`,
          },
          // Sacar a alguien va sin cuerpo: el id viaja en la ruta.
          ...(metodo === 'DELETE' ? {} : { body: JSON.stringify(cuerpo ?? {}) }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!respuesta.ok) {
          const cuerpoError = (await respuesta.json().catch(() => null)) as {
            message?: string;
          } | null;
          // El motivo del server se muestra: son accionables («ya está en el
          // grupo»), no errores técnicos.
          setAviso(cuerpoError?.message ?? 'No se pudo.');
          return false;
        }
        return true;
      } catch {
        setAviso('Sin conexión. Probá de nuevo.');
        return false;
      } finally {
        setAccionando(false);
      }
    },
    [chatId, credential.jwt]
  );

  const cargar = useCallback(async () => {
    setEstado({ fase: 'cargando' });
    try {
      const respuesta = await fetch(`${BASE_URL}/api/chats/${chatId}/detail`, {
        headers: { Authorization: `Bearer ${credential.jwt}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!respuesta.ok) {
        setEstado({ fase: 'error', mensaje: 'No pudimos cargar los datos del chat.' });
        return;
      }
      setEstado({ fase: 'listo', detalle: (await respuesta.json()) as Detalle });
    } catch {
      // **El error se DICE.** Una pantalla que se queda en blanco al fallar la
      // red es indistinguible de una pantalla rota.
      setEstado({ fase: 'error', mensaje: 'Sin conexión. Probá de nuevo.' });
    }
  }, [chatId, credential.jwt]);

  useEffect(() => {
    if (visible) void cargar();
  }, [visible, cargar]);

  /**
   * Media, documentos y links del chat, agrupados como en WhatsApp. Sale de los
   * mensajes que la pantalla anterior YA tiene cargados: no se pide nada al
   * server para un vistazo.
   */
  const clasificado = useMemo(() => {
    const c = clasificarMedias(mensajes.filter((m) => !m.deletedAt));
    return {
      medias: [...c.medias].reverse(),
      docs: [...c.docs].reverse(),
      links: [...c.links].reverse(),
    };
  }, [mensajes]);
  const [pestana, setPestana] = useState<'media' | 'docs' | 'links'>('media');

  const agenda = agendaPorTelefono();
  const nombreDe = (miembro: Miembro) =>
    miembro.esYo
      ? 'Vos'
      : nombreDeContacto({ delServidor: miembro.name, telefono: miembro.phone, agenda }) ||
        'Sin nombre';

  const detalle = estado.fase === 'listo' ? estado.detalle : null;
  const esGrupo = detalle?.kind === 'group';

  /**
   * Los ids de los que ya están. Va memoizado porque el selector lo recibe como
   * dependencia: un array nuevo en cada render lo haría recalcular la lista
   * entera —agenda incluida— por cada tecla del buscador.
   */
  const yaEstan = useMemo(() => detalle?.members.map((uno) => uno.id) ?? [], [detalle]);

  /**
   * Qué se puede hacer con cada participante.
   *
   * Lo decide `accionesDeMiembro`, que le pregunta a las MISMAS reglas que
   * después aplica el server. Armar la lista de botones acá —«mostrar sacar si
   * soy admin»— sería una segunda copia de esas reglas, y las dos copias se
   * separan en el primer cambio.
   */
  const accionesPara = useCallback(
    (miembro: Miembro): AccionDeMiembro[] => {
      const yo = detalle?.members.find((uno) => uno.esYo);
      if (!yo || !detalle) return [];
      return accionesDeMiembro({
        quien: yo.id,
        aQuien: miembro.id,
        esGrupo: detalle.kind === 'group',
        miembros: detalle.members.map((uno) => ({ userId: uno.id, role: uno.role })),
      });
    },
    [detalle]
  );

  const puedoEditarInfo =
    detalle !== null &&
    puedeEditarInfo({
      quien: detalle.members.find((uno) => uno.esYo)?.id ?? '',
      esGrupo: detalle.kind === 'group',
      miembros: detalle.members.map((uno) => ({ userId: uno.id, role: uno.role })),
    }).ok;

  /** El nombre que se muestra: el del server manda sobre el que llegó por prop. */
  const nombreVisible = (esGrupo ? detalle?.name : undefined) ?? chatName;

  const guardarNombre = async (nombre: string) => {
    if (await llamar('', { name: nombre }, 'PATCH')) {
      setEditandoNombre(false);
      onInfoCambiada?.({ name: nombre });
      await cargar();
    }
  };

  const cambiarFoto = async () => {
    const eleccion = await elegirFotoDeGrupo();
    if (eleccion.tipo === 'sin-permiso') {
      return setAviso('Permití la cámara para sacar la foto.');
    }
    if (eleccion.tipo !== 'foto') return;

    setSubiendoFoto(true);
    setAviso('');
    const r = await subirFotoDeGrupo({
      baseUrl: BASE_URL,
      chatId,
      jwt: credential.jwt,
      foto: eleccion.foto,
    });
    setSubiendoFoto(false);
    if (!r.ok) return setAviso(r.motivo);
    onInfoCambiada?.({ avatarUrl: r.avatarUrl });
    await cargar();
  };

  /**
   * Todas SE PREGUNTAN antes, y el texto dice qué va a pasar de verdad.
   *
   * Son las únicas acciones de esta pantalla que le cambian algo a otra
   * persona, y dos de las tres no las puede deshacer quien las hace: al nombrar
   * admin **ya no se lo podés quitar** —solo esa persona puede dejarlo— y al
   * renunciar hace falta que otro admin te nombre de vuelta. Un «¿estás
   * seguro?» a secas no informa nada de eso.
   */
  const confirmarAccion = (miembro: Miembro, accion: AccionDeMiembro) => {
    const quien = nombreDe(miembro);
    const guion = confirmacionDe(accion, quien);
    Alert.alert(guion.titulo, guion.cuerpo, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: guion.boton,
        style: accion === 'sacar' ? 'destructive' : 'default',
        onPress: () => {
          void (async () => {
            // Se recarga la lista que la persona está mirando: dejarla vieja
            // después de una acción propia es lo que hace dudar de si pasó.
            const hecho = await llamar(
              `members/${miembro.id}`,
              guion.cuerpoHttp,
              guion.metodo
            );
            if (hecho) await cargar();
          })();
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      <View className="flex-1 bg-background" testID="pantalla-detalle-chat">
        <View
          className="flex-row items-center gap-2 border-b border-outline/10 bg-surface px-3 pb-3"
          style={{ paddingTop: margenes.cabecera }}
        >
          <Pressable
            testID="btn-cerrar-detalle"
            accessibilityLabel="Volver a la conversación"
            onPress={onCerrar}
            className="h-11 w-11 items-center justify-center"
          >
            <ArrowLeft size={22} color={colores['on-surface']} />
          </Pressable>
          <Text className="flex-1 text-lg font-bold text-on-surface">Detalle del chat</Text>
        </View>

        {estado.fase === 'cargando' ? (
          /* Esqueleto con la GEOMETRÍA real: así el contenido no salta al
             llegar, que es la regla del catálogo de UI. */
          <View className="px-4 pt-6" testID="detalle-cargando">
            <View className="items-center">
              <View className="h-24 w-24 rounded-full bg-surface-variant" />
              <View className="mt-3 h-5 w-40 rounded bg-surface-variant" />
            </View>
            {[0, 1, 2].map((i) => (
              <View key={i} className="mt-4 h-14 rounded-xl bg-surface-variant" />
            ))}
          </View>
        ) : estado.fase === 'error' ? (
          <View className="flex-1 items-center justify-center px-8" testID="detalle-error">
            <Text className="text-center text-base text-on-surface">{estado.mensaje}</Text>
            <Pressable
              testID="btn-reintentar-detalle"
              onPress={() => void cargar()}
              className="mt-5 min-h-[48px] items-center justify-center rounded-xl bg-primary px-6"
            >
              <Text className="text-sm font-semibold text-on-primary">Reintentar</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: margenes.pie + 24 }}>
            <IdentidadDelChat
              nombre={nombreVisible}
              avatarUrl={detalle!.avatarUrl}
              debajo={
                esGrupo
                  ? `${detalle!.members.length} participantes`
                  : (detalle!.members.find((m) => !m.esYo)?.phone ?? '')
              }
              editable={puedoEditarInfo}
              subiendoFoto={subiendoFoto}
              onCambiarFoto={() => void cambiarFoto()}
              onEditarNombre={() => setEditandoNombre(true)}
            />

            {/* Fila de acciones del diseño. Solo van las que HACEN algo: una
                acción inerte enseña que los botones de esta app no responden. */}
            <View className="mt-6 flex-row justify-center gap-3 px-4">
              {!esGrupo && onLlamar ? (
                <>
                  <AccionRedonda
                    testID="btn-detalle-llamar"
                    etiqueta="Llamar"
                    onPress={() => onLlamar(false)}
                  >
                    <Phone size={20} color={colores.primary} />
                  </AccionRedonda>
                  <AccionRedonda
                    testID="btn-detalle-video"
                    etiqueta="Video"
                    onPress={() => onLlamar(true)}
                  >
                    <Video size={20} color={colores.primary} />
                  </AccionRedonda>
                </>
              ) : null}
              {esGrupo ? (
                <AccionRedonda
                  testID="btn-detalle-agregar"
                  etiqueta="Añadir"
                  onPress={() => setAgregando(true)}
                >
                  <UserPlus size={20} color={colores.primary} />
                </AccionRedonda>
              ) : null}
              <AccionRedonda testID="btn-detalle-buscar" etiqueta="Buscar" deshabilitado>
                <Search size={20} color={colores['on-surface-variant']} />
              </AccionRedonda>
            </View>

            <SeccionCompartido
              clasificado={clasificado}
              pestana={pestana}
              onPestana={setPestana}
              onVerMedia={(m) => onVerImagen?.(m.media!.url ?? m.media!.thumbUrl!)}
            />

            {esGrupo ? (
              <>
                <Rotulo>Participantes</Rotulo>
                <View className="px-4">
                  {detalle!.members.map((miembro) => (
                    <View
                      key={miembro.id}
                      testID={`miembro-${miembro.id}`}
                      className="mb-2 flex-row items-center gap-3 rounded-xl border border-outline/10 bg-surface p-3"
                    >
                      <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <Text className="text-sm font-bold text-primary">
                          {nombreDe(miembro).slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                      <Text className="min-w-0 flex-1 text-sm font-semibold text-on-surface">
                        {nombreDe(miembro)}
                      </Text>
                      {miembro.role === 'admin' ? (
                        <View className="shrink-0 rounded bg-primary/15 px-2 py-0.5">
                          <Text className="text-[10px] font-semibold text-primary">Admin</Text>
                        </View>
                      ) : null}
                      {/* El menú aparece solo si hay algo que hacer con esa
                          persona. Una fila con «⋮» que abre una hoja vacía —o
                          peor, con opciones que fallan— enseña que los botones
                          de esta app no responden. Las mismas reglas las
                          revalida el server: esconder un botón no es un
                          permiso. */}
                      {accionesPara(miembro).length > 0 ? (
                        <Pressable
                          testID={`btn-menu-${miembro.id}`}
                          accessibilityLabel={`Opciones de ${nombreDe(miembro)}`}
                          disabled={accionando}
                          onPress={() => setMenuDe(miembro)}
                          className={`h-11 w-11 shrink-0 items-center justify-center ${accionando ? 'opacity-40' : ''}`}
                        >
                          <MoreVertical size={18} color={colores['on-surface-variant']} />
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            {aviso ? (
              <Text
                testID="aviso-detalle"
                className="mt-4 px-4 text-sm text-error"
              >
                {aviso}
              </Text>
            ) : null}

            <AjustesDelChat
              esGrupo={esGrupo}
              cifrado={detalle!.encrypted}
              silenciado={silenciado}
              onSilenciar={setSilenciado}
              accionando={accionando}
              onSalir={async () => {
                // `onSalio` cierra el detalle Y la conversación: quedarse
                // adentro del grupo que se acaba de dejar no tiene sentido.
                if (await llamar('leave')) (onSalio ?? onCerrar)();
              }}
            />
          </ScrollView>
        )}
        <EditarNombreDeGrupo
          visible={editandoNombre}
          nombreActual={nombreVisible}
          guardando={accionando}
          onCerrar={() => setEditandoNombre(false)}
          onGuardar={(nombre) => void guardarNombre(nombre)}
        />
        <AccionesDeMiembro
          visible={menuDe !== null}
          nombre={menuDe ? nombreDe(menuDe) : ''}
          acciones={menuDe ? accionesPara(menuDe) : []}
          onCerrar={() => setMenuDe(null)}
          onElegir={(accion) => {
            const miembro = menuDe;
            setMenuDe(null);
            if (miembro) confirmarAccion(miembro, accion);
          }}
        />
        <ElegirParaSumar
          visible={agregando}
          credential={credential}
          yaEstan={yaEstan}
          onCerrar={() => setAgregando(false)}
          onElegir={async (userId) => {
            setAgregando(false);
            // Se recarga el detalle: la lista de participantes es justo lo que
            // la persona está mirando, y dejarla vieja hace dudar de si funcionó.
            if (await llamar('members', { userId })) await cargar();
          }}
        />
      </View>
    </Modal>
  );
}

function Rotulo({ children }: { children: string }) {
  return (
    <Text className="mb-2 mt-6 px-4 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
      {children}
    </Text>
  );
}

/**
 * Los botones redondos de la fila del diseño.
 *
 * Los que todavía no hacen nada van **apagados y sin respuesta al toque**, no
 * activos y mudos: un botón que se ve normal y no reacciona enseña que los
 * botones de esta app no funcionan, y esa lección después se aplica a los que sí.
 */
function AccionRedonda({
  children,
  etiqueta,
  onPress,
  testID,
  deshabilitado,
}: {
  children: React.ReactNode;
  etiqueta: string;
  onPress?: () => void;
  testID: string;
  deshabilitado?: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={deshabilitado}
      accessibilityLabel={etiqueta}
      className={`items-center ${deshabilitado ? 'opacity-40' : ''}`}
    >
      <View className="h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        {children}
      </View>
      <Text className="mt-1 text-[11px] text-on-surface-variant">{etiqueta}</Text>
    </Pressable>
  );
}

/**
 * «Compartido en el chat»: Media, Docs y Links en pestañas, como WhatsApp.
 *
 * Mezclar fotos, PDFs y enlaces en una sola tira obliga a scrollear entre cosas
 * distintas para encontrar la que se busca. Cada pestaña muestra lo suyo; la que
 * está vacía lo dice, en vez de desaparecer y dejar dudando si hubo algo.
 */
function SeccionCompartido({
  clasificado,
  pestana,
  onPestana,
  onVerMedia,
}: {
  clasificado: {
    medias: ServerMessage[];
    docs: ServerMessage[];
    links: { seq: number; url: string }[];
  };
  pestana: 'media' | 'docs' | 'links';
  onPestana: (p: 'media' | 'docs' | 'links') => void;
  onVerMedia: (m: ServerMessage) => void;
}) {
  const colores = useColores();
  const tabs = [
    { id: 'media' as const, etiqueta: 'Media', n: clasificado.medias.length },
    { id: 'docs' as const, etiqueta: 'Docs', n: clasificado.docs.length },
    { id: 'links' as const, etiqueta: 'Links', n: clasificado.links.length },
  ];

  return (
    <>
      <Rotulo>Compartido en el chat</Rotulo>
      <View className="mx-4 mb-3 flex-row rounded-xl border border-outline/10 bg-surface p-1">
        {tabs.map((tab) => {
          const activo = pestana === tab.id;
          return (
            <Pressable
              key={tab.id}
              testID={`tab-${tab.id}`}
              onPress={() => onPestana(tab.id)}
              className={`min-h-[40px] flex-1 flex-row items-center justify-center gap-1.5 rounded-lg ${activo ? 'bg-primary/[0.14]' : ''}`}
            >
              <Text
                className={`text-[13px] ${activo ? 'font-semibold text-primary' : 'text-on-surface-variant'}`}
              >
                {tab.etiqueta}
              </Text>
              {tab.n > 0 ? (
                <Text className={`text-[11px] ${activo ? 'text-primary' : 'text-on-surface-variant'}`}>
                  {tab.n}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {pestana === 'media' ? (
        clasificado.medias.length === 0 ? (
          <Vacio texto="Todavía no compartieron fotos ni videos." />
        ) : (
          // Cuadrícula de 3, como la galería de WhatsApp: mejor que una tira
          // horizontal para ver de un vistazo todo lo que hay.
          <View className="flex-row flex-wrap gap-1 px-4">
            {clasificado.medias.map((m) => (
              <Pressable
                key={m.seq}
                testID={`detalle-media-${m.seq}`}
                onPress={() => onVerMedia(m)}
                className="overflow-hidden rounded-md"
                style={{ width: '32.5%', aspectRatio: 1 }}
              >
                <Image
                  source={{ uri: m.media!.thumbUrl! }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                />
                {(m.media!.mime ?? '').startsWith('video/') ? (
                  <View className="absolute inset-0 items-center justify-center">
                    <View className="h-8 w-8 items-center justify-center rounded-full bg-black/50">
                      <Video size={16} color="#ffffff" />
                    </View>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
        )
      ) : null}

      {pestana === 'docs' ? (
        clasificado.docs.length === 0 ? (
          <Vacio texto="Todavía no compartieron documentos." />
        ) : (
          <View className="px-4">
            {clasificado.docs.map((m) => (
              <Pressable
                key={m.seq}
                testID={`detalle-doc-${m.seq}`}
                onPress={() => onVerMedia(m)}
                className="mb-2 min-h-[56px] flex-row items-center gap-3 rounded-xl border border-outline/10 bg-surface p-3"
              >
                <View className="h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <FileText size={20} color={colores.primary} />
                </View>
                <Text className="min-w-0 flex-1 text-[14px] font-semibold text-on-surface" numberOfLines={2}>
                  {m.media!.fileName ?? 'Documento'}
                </Text>
              </Pressable>
            ))}
          </View>
        )
      ) : null}

      {pestana === 'links' ? (
        clasificado.links.length === 0 ? (
          <Vacio texto="Todavía no compartieron enlaces." />
        ) : (
          <View className="px-4">
            {clasificado.links.map((l, i) => (
              <Pressable
                key={`${l.seq}-${i}`}
                testID={`detalle-link-${l.seq}-${i}`}
                onPress={() => void Linking.openURL(l.url)}
                className="mb-2 min-h-[56px] flex-row items-center gap-3 rounded-xl border border-outline/10 bg-surface p-3"
              >
                <View className="h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <ExternalLink size={18} color={colores.primary} />
                </View>
                <Text className="min-w-0 flex-1 text-[13px] text-primary" numberOfLines={2}>
                  {l.url}
                </Text>
              </Pressable>
            ))}
          </View>
        )
      ) : null}
    </>
  );
}

function Vacio({ texto }: { texto: string }) {
  return <Text className="px-4 pb-2 text-sm text-on-surface-variant">{texto}</Text>;
}
