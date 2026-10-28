import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, FlatList, Keyboard, Pressable, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { Modal } from '../ui/Modal';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useScrollConTeclado } from './useScrollConTeclado';
import { ArrowLeft, Check, ClipboardCheck, Send, Smile, Square, SquareCheck, X } from 'lucide-react-native';
import { checklistMembers, deleteBeforeCursor, formatClock, memberBadge, usesFlatLayout, miReaccion, primerEnlace, puedeEditar, puedeReaccionar, resolveDeliveryState, type DeliveryState, type MemberPill } from '@lilachat/shared';
import type { MencionElegida, MencionEnMensaje } from '@lilachat/shared';
import { useMenciones, type MentionableMember } from './useMenciones';
import { SugerenciasDeMencion } from './SugerenciasDeMencion';
import { ThreadPicker } from './ThreadPicker';
import { ChecklistEnElChat } from './ChecklistEnElChat';
import { CreateChecklistScreen } from '../agenda/CreateChecklistScreen';
import { FLAT_INDENT, FlatMessageRow } from './FlatMessageRow';
import { useGroupsAsList } from '../ui/groupsAsList';
import { Avatar } from '../ui/Avatar';
import { useMargenes } from '../ui/useMargenes';
import { useColores } from '../ui/tema';
import { colorDeAutor } from './burbuja';
import { TextoConHora } from './TextoConHora';
import { TextoConEnlaces } from './TextoConEnlaces';
import { VistaPreviaDeEnlace } from './VistaPreviaDeEnlace';
import type { ChatMessage, PendingMessage } from './useChat';
import type { RespuestaDeReaccion } from './useCambiosDeMensajes';
import { BarraDeReacciones } from './reacciones/BarraDeReacciones';
import { PastillaDeReacciones } from './reacciones/PastillaDeReacciones';
import { useReaccionesEnPantalla } from './reacciones/useReaccionesEnPantalla';

/** Side of a sticker reply in the thread (dp). */
const STICKER_IN_THREAD = 120;
/** Lo escrito y no mandado en cada hilo, mientras la app está abierta. */
const borradores = new Map<string, string>();
/** How long the reply reached from a notice stays highlighted. */
const HIGHLIGHT_MS = 1500;
/** The second `scrollToIndex`, once the heights are measured (as in the chat). */
const SECOND_PASS_MS = 400;

type Respuesta = ChatMessage | PendingMessage;
const esPendiente = (mensaje: Respuesta): mensaje is PendingMessage => mensaje.pending === true;

/**
 * Un hilo (E3, 20/10; diseño `e3-app-hilo`): la raíz arriba, sus respuestas
 * como un chat y un campo para responder, con «También enviar al chat». Es un
 * modal dentro de la conversación: funciona igual en el teléfono y en el panel
 * de la tablet. Atrás lo cierra; lo escrito queda como borrador.
 */
/** The modal's slide-in; focusing earlier does not raise the keyboard. */
const FOCUS_AFTER_OPEN_MS = 350;

export function HiloScreen(props: {
  raiz: ChatMessage | null;
  /** The reply to bring into view and highlight: the one a tapped notice was about. */
  highlightReply?: number;
  /** Opened by «Responder» (pending 110): the reply field takes the keyboard. */
  focusInput?: boolean;
  chatId: string;
  chatName: string;
  yo: string;
  /** Para la tarjeta de los enlaces (20/10: en el hilo un link quedaba como texto). */
  jwt: string;
  esGrupo: boolean;
  nombres: ReadonlyMap<string, string>;
  fotos: ReadonlyMap<string, string>;
  /** Each member's role: the pill next to the name in the Slack format (design `s-02`). */
  roles: ReadonlyMap<string, MemberPill>;
  /** A chat of a company space: always the Slack format. */
  workspaceId?: string;
  respuestas: readonly ChatMessage[];
  pendientes: readonly PendingMessage[];
  leidoHasta: number;
  entregadoHasta: number;
  onEnviar: (texto: string, enElChat: boolean, menciones?: (texto: string) => MencionEnMensaje[]) => Promise<{ ok: boolean }>;
  /** Who `@` offers in the reply field (José 25/10: tagging did not work in threads). */
  mencionables?: MentionableMember[];
  /** Mentioned people who are not in the channel, once the reply left: the screen offers to add them. */
  onOutsideMentions?: (people: MencionElegida[]) => void;
  /** A line over the field (the offer to add them). */
  notice?: ReactNode;
  /** Reacciones (20/10): mantener presionada una respuesta muestra la barra. */
  reaccionar: (seq: number, emoji: string | null) => Promise<RespuestaDeReaccion>;
  /** Edit an own reply (José, 20/10: «in a thread I can't edit my message»); the same rule as the chat. */
  editar: (seq: number, texto: string) => Promise<{ ok: boolean; motivo?: string }>;
  /** Deletes for everyone, like «Eliminar para todos» in the chat. */
  onDelete?: (seq: number) => void;
  onCerrar: () => void;
}) {
  const colores = useColores();
  const margenes = useMargenes();
  // El teclado tapa el margen de la barra de navegación: la barra de escribir sube eso menos (20/10:
  // la franja vacía bajo «También enviar al chat»), y la lista sigue al teclado como el chat.
  const ScrollConTeclado = useScrollConTeclado(margenes.pie);
  const clave = `${props.chatId}:${props.raiz?.seq ?? ''}`;
  const [texto, setTexto] = useState('');
  const [enElChat, setEnElChat] = useState(false);
  const lista = useRef<FlatList<Respuesta>>(null);
  const [barraEn, setBarraEn] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ seq: number; original: string } | null>(null);
  const [picking, setPicking] = useState(false);
  const [notice, setNotice] = useState('');
  /** A checklist inside the thread (backlog 30): its card stays among the replies. */
  const [creatingChecklist, setCreatingChecklist] = useState(false);
  const input = useRef<TextInput>(null);
  const mentions = useMenciones(props.mencionables);
  /** The text the selection handler sees: the state of the render before has not arrived when it fires. */
  const latestText = useRef('');
  useEffect(() => {
    mentions.limpiar();
    setTexto(borradores.get(clave) ?? '');
    setEnElChat(false);
    setBarraEn(null);
    setEditing(null);
    setPicking(false);
    setNotice('');
    setCreatingChecklist(false);
  }, [clave]);
  const wantsKeyboard = Boolean(props.raiz && props.focusInput);
  useEffect(() => {
    if (!wantsKeyboard) return;
    // After the modal slides in: a focus during the animation is dropped on Android.
    const timer = setTimeout(() => input.current?.focus(), FOCUS_AFTER_OPEN_MS);
    return () => clearTimeout(timer);
  }, [wantsKeyboard, clave]);
  // Las hojas viven DENTRO del modal del hilo: las del chat quedarían detrás.
  const reacciones = useReaccionesEnPantalla({ mensajes: props.respuestas, reaccionar: props.reaccionar, yo: props.yo, nombres: props.nombres, fotos: props.fotos, alReaccionar: () => setBarraEn(null) });
  const filas: Respuesta[] = [...props.respuestas, ...props.pendientes];
  // From a notice: the tapped reply comes into view and is highlighted for a moment, like a quote in the chat.
  const [highlighted, setHighlighted] = useState<number | null>(null);
  /** Which opening already jumped, so a reply arriving later does not pull the list back. */
  const jumpedKey = useRef<string | null>(null);
  const replyIndex = props.highlightReply === undefined ? -1 : filas.findIndex((fila) => !esPendiente(fila) && fila.seq === props.highlightReply);
  useEffect(() => {
    if (props.raiz === null) jumpedKey.current = null;
    const key = `${clave}:${props.highlightReply}`;
    if (props.raiz === null || replyIndex < 0 || jumpedKey.current === key) return;
    jumpedKey.current = key;
    const scrollToReply = () => lista.current?.scrollToIndex({ index: replyIndex, animated: false, viewPosition: 0.4 });
    scrollToReply();
    setTimeout(scrollToReply, SECOND_PASS_MS);
    setHighlighted(props.highlightReply ?? null);
  }, [props.raiz, replyIndex, props.highlightReply, clave]);
  useEffect(() => {
    if (highlighted === null) return;
    const clearTimer = setTimeout(() => setHighlighted(null), HIGHLIGHT_MS);
    return () => clearTimeout(clearTimer);
  }, [highlighted]);
  const nombreDe = (id: string) => (id === props.yo ? 'Tú' : (props.nombres.get(id) ?? 'Alguien'));
  // The thread follows its chat: as a list in the Slack format (design `s-02`).
  const flat = usesFlatLayout({ kind: props.esGrupo ? 'group' : 'direct', workspaceId: props.workspaceId }, { groupsAsList: useGroupsAsList() });
  const badgeOf = (id: string) => memberBadge({ ...props.roles.get(id), isMe: id === props.yo });

  const startEditing = (seq: number) => {
    const reply = props.respuestas.find((one) => one.seq === seq);
    if (!reply?.body) return;
    setBarraEn(null);
    setEditing({ seq, original: reply.body });
    setTexto(reply.body);
    setNotice('');
    input.current?.focus();
  };
  const stopEditing = () => {
    setEditing(null);
    setTexto(borradores.get(clave) ?? '');
  };
  const saveEdit = async (edit: { seq: number; original: string }) => {
    const limpio = texto.trim();
    if (!limpio || limpio === edit.original) return stopEditing();
    const result = await props.editar(edit.seq, limpio);
    if (!result.ok) return setNotice(result.motivo ?? 'No se pudo editar.');
    stopEditing();
  };
  const confirmDelete = (seq: number) => {
    setBarraEn(null);
    Alert.alert('¿Eliminar el mensaje?', undefined, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar para todos', style: 'destructive', onPress: () => props.onDelete?.(seq) },
    ]);
  };
  const canDelete = (reply: ChatMessage) => Boolean(props.onDelete) && String(reply.senderId) === props.yo && !reply.deletedAt;
  const canEdit = (reply: ChatMessage) =>
    puedeEditar({ yo: props.yo, autor: String(reply.senderId), kind: reply.kind, eliminado: Boolean(reply.deletedAt), secreto: false, enviadoEn: reply.at, ahora: Date.now() }).permitido;

  const enviar = async () => {
    if (editing) return saveEdit(editing);
    const limpio = texto.trim();
    if (!limpio) return;
    setTexto('');
    borradores.delete(clave);
    // Como en Slack: «También enviar al chat» vale para una respuesta, no para las que siguen.
    setEnElChat(false);
    const ranges = mentions.rangos();
    const outside = mentions.outside(limpio);
    mentions.limpiar();
    const r = await props.onEnviar(limpio, enElChat, ranges);
    if (!r.ok) {
      setTexto(limpio);
      setEnElChat(enElChat);
    } else if (outside.length > 0) props.onOutsideMentions?.(outside);
    setTimeout(() => lista.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <Modal visible={props.raiz !== null} animationType="slide" onRequestClose={props.onCerrar}>
      <View className="flex-1 bg-background" testID="pantalla-hilo">
        <View className="flex-row items-center gap-2 border-b border-outline/10 bg-surface px-2 pb-2" style={{ paddingTop: margenes.cabecera }}>
          <Pressable testID="btn-cerrar-hilo" accessibilityLabel="Volver al chat" onPress={props.onCerrar} className="h-11 w-11 items-center justify-center">
            <ArrowLeft size={22} color={colores['on-surface']} />
          </Pressable>
          <View className="min-w-0 flex-1">
            <Text className="text-[17px] font-semibold text-on-surface">Hilo</Text>
            <Text className="text-[12px] text-on-surface-variant" numberOfLines={1}>
              {props.chatName}
            </Text>
          </View>
          <Pressable testID="btn-checklist-hilo" accessibilityLabel="Crear un checklist en el hilo" onPress={() => { Keyboard.dismiss(); setCreatingChecklist(true); }} className="h-11 w-11 items-center justify-center">
            <ClipboardCheck size={21} color={colores['on-surface-variant']} />
          </Pressable>
        </View>
        {props.raiz ? (
          <FlatList
            ref={lista}
            renderScrollComponent={(propsDelScroll) => <ScrollConTeclado {...propsDelScroll} />}
            data={filas}
            keyExtractor={(fila) => fila.clientKey}
            contentContainerStyle={{ padding: 12, gap: 8 }}
            onContentSizeChange={() => {
              if (jumpedKey.current === null) lista.current?.scrollToEnd({ animated: false });
            }}
            onScrollToIndexFailed={(fallo) => setTimeout(() => lista.current?.scrollToOffset({ offset: fallo.averageItemLength * fallo.index, animated: false }), 100)}
            ListHeaderComponent={flat ? (
              <FlatThreadRoot root={props.raiz} name={props.nombres.get(String(props.raiz.senderId)) ?? nombreDe(String(props.raiz.senderId))} photo={props.fotos.get(String(props.raiz.senderId))} badge={badgeOf(String(props.raiz.senderId))} count={props.respuestas.length} myUserId={props.yo} names={props.nombres} />
            ) : (
              <CabeceraDelHilo raiz={props.raiz} nombre={nombreDe(String(props.raiz.senderId))} foto={props.fotos.get(String(props.raiz.senderId))} cuantas={props.respuestas.length} />
            )}
            renderItem={({ item, index }) => {
              const mia = esPendiente(item) || String(item.senderId) === props.yo;
              const confirmada = esPendiente(item) ? null : item;
              if (flat) {
                const senderId = esPendiente(item) ? props.yo : String(item.senderId);
                const toggleBar = confirmada && puedeReaccionar({ seq: confirmada.seq, deletedAt: confirmada.deletedAt, kind: confirmada.kind }) ? () => setBarraEn((antes) => (antes === confirmada.seq ? null : confirmada.seq)) : undefined;
                return (
                  <View className={confirmada && highlighted === confirmada.seq ? 'rounded-lg bg-primary/15' : undefined}>
                    {confirmada && barraEn === confirmada.seq ? (
                      <BarraDeReacciones seq={confirmada.seq} mia={mia} conAvatar={false} indent={FLAT_INDENT} miEmoji={miReaccion(confirmada.reacciones, props.yo)} onElegir={reacciones.elegir} onMas={reacciones.masEmojis} onEditar={canEdit(confirmada) ? startEditing : undefined} onDelete={canDelete(confirmada) ? confirmDelete : undefined} />
                    ) : null}
                    <FlatMessageRow
                      item={item}
                      previous={filas[index - 1]}
                      myUserId={props.yo}
                      jwt={props.jwt}
                      linkPreview
                      names={props.nombres}
                      everyName={props.nombres}
                      delivery={resolveDeliveryState({ seq: confirmada ? confirmada.seq : null, otherReadSeq: props.leidoHasta, otherDeliveredSeq: props.entregadoHasta })}
                      authorName={props.nombres.get(senderId)}
                      authorPhoto={props.fotos.get(senderId)}
                      badge={badgeOf(senderId)}
                      onSelect={toggleBar}
                    />
                    {confirmada?.reacciones?.length && !confirmada.deletedAt ? (
                      <PastillaDeReacciones id={`hilo-${confirmada.seq}`} reacciones={confirmada.reacciones} yo={props.yo} mia={mia} conAvatar={false} indent={FLAT_INDENT} onTocar={() => reacciones.verReacciones(confirmada.seq)} />
                    ) : null}
                  </View>
                );
              }
              return (
                <View className={confirmada && highlighted === confirmada.seq ? 'rounded-lg bg-primary/15' : undefined}>
                  {confirmada && barraEn === confirmada.seq ? (
                    <BarraDeReacciones seq={confirmada.seq} mia={mia} conAvatar={false} miEmoji={miReaccion(confirmada.reacciones, props.yo)} onElegir={reacciones.elegir} onMas={reacciones.masEmojis} onEditar={canEdit(confirmada) ? startEditing : undefined} onDelete={canDelete(confirmada) ? confirmDelete : undefined} />
                  ) : null}
                  <BurbujaDelHilo
                    mensaje={item}
                    mia={mia}
                    autor={esPendiente(item) ? 'Tú' : nombreDe(String(item.senderId))}
                    conAutor={props.esGrupo}
                    yo={props.yo}
                    jwt={props.jwt}
                    nombres={props.nombres}
                    entrega={resolveDeliveryState({ seq: confirmada ? confirmada.seq : null, otherReadSeq: props.leidoHasta, otherDeliveredSeq: props.entregadoHasta })}
                    onLongPress={confirmada && puedeReaccionar({ seq: confirmada.seq, deletedAt: confirmada.deletedAt, kind: confirmada.kind }) ? () => setBarraEn((antes) => (antes === confirmada.seq ? null : confirmada.seq)) : undefined}
                  />
                  {confirmada?.reacciones?.length && !confirmada.deletedAt ? (
                    <PastillaDeReacciones id={`hilo-${confirmada.seq}`} reacciones={confirmada.reacciones} yo={props.yo} mia={mia} conAvatar={false} onTocar={() => reacciones.verReacciones(confirmada.seq)} />
                  ) : null}
                </View>
              );
            }}
          />
        ) : null}
        <KeyboardStickyView offset={{ closed: 0, opened: margenes.pie }}>
        {props.notice}
        <SugerenciasDeMencion
          sugerencias={editing ? [] : mentions.sugerencias}
          onElegir={(member) => {
            const completed = mentions.choose(latestText.current, member);
            if (!completed) return;
            latestText.current = completed.texto;
            setTexto(completed.texto);
            borradores.set(clave, completed.texto);
            setTimeout(() => input.current?.setSelection(completed.cursor, completed.cursor), 0);
          }}
        />
        <View className="border-t border-outline/10 bg-surface px-3 pt-2" style={{ paddingBottom: margenes.pie + 4 }}>
          {editing ? (
            <View testID="barra-edicion-hilo" className="mb-1.5 flex-row items-center gap-2 rounded-lg bg-primary/[0.08] px-3 py-1.5">
              <Text className="min-w-0 flex-1 text-[13px] font-semibold text-primary" numberOfLines={1}>Editando tu mensaje</Text>
              <Pressable testID="btn-cancelar-edicion-hilo" accessibilityLabel="Cancelar la edición" onPress={stopEditing} hitSlop={8}>
                <X size={18} color={colores['on-surface-variant']} />
              </Pressable>
            </View>
          ) : null}
          {notice ? <Text testID="aviso-hilo" className="mb-1 text-[12px] text-error">{notice}</Text> : null}
          <View className="flex-row items-end gap-2">
            <Pressable testID="btn-emojis-hilo" accessibilityLabel="Emojis y stickers" onPress={() => { Keyboard.dismiss(); setPicking(true); }} className="h-11 w-9 items-center justify-center">
              <Smile size={22} color={colores['on-surface-variant']} />
            </Pressable>
            <TextInput
              ref={input}
              testID="input-hilo"
              value={texto}
              onSelectionChange={(evento) => mentions.alCambiar(latestText.current, evento.nativeEvent.selection.end)}
              onChangeText={(nuevo) => {
                latestText.current = nuevo;
                setTexto(nuevo);
                // While editing, the draft of a new reply is kept as it was (it comes back after saving).
                if (!editing) borradores.set(clave, nuevo);
              }}
              placeholder="Responder en el hilo…"
              placeholderTextColor={colores['on-surface-variant']}
              multiline
              className="min-h-[44px] flex-1 rounded-3xl bg-background px-4 py-2.5 text-[15px] text-on-surface"
            />
            <Pressable testID="btn-enviar-hilo" accessibilityLabel={editing ? 'Guardar la edición' : 'Enviar al hilo'} onPress={() => void enviar()} className="h-11 w-11 items-center justify-center rounded-full bg-primary">
              {editing ? <Check size={20} color={colores['on-primary']} /> : <Send size={18} color={colores['on-primary']} />}
            </Pressable>
          </View>
          <Pressable testID="casilla-tambien-al-chat" accessibilityRole="checkbox" accessibilityState={{ checked: enElChat }} onPress={() => setEnElChat((antes) => !antes)} className="min-h-[40px] flex-row items-center gap-2 px-1">
            {enElChat ? <SquareCheck size={18} color={colores.primary} /> : <Square size={18} color={colores['on-surface-variant']} />}
            <Text className="text-[13px] text-on-surface-variant">También enviar al chat</Text>
          </Pressable>
        </View>
        </KeyboardStickyView>
      </View>
      {reacciones.hojas}
      {props.raiz ? (
        <CreateChecklistScreen visible={creatingChecklist} jwt={props.jwt} chat={{ id: props.chatId, name: props.chatName }} threadOf={props.raiz.seq} onClose={() => {
          setCreatingChecklist(false);
          setTimeout(() => lista.current?.scrollToEnd({ animated: true }), 300);
        }} />
      ) : null}
      {props.raiz ? (
        <ThreadPicker
          visible={picking}
          jwt={props.jwt}
          chatId={props.chatId}
          chatName={props.chatName}
          root={props.raiz.seq}
          alsoInChat={enElChat}
          onEmoji={(emoji) => {
            setTexto((before) => before + emoji);
            setPicking(false);
          }}
          onBackspace={() => setTexto((before) => deleteBeforeCursor(before, { start: before.length, end: before.length }).texto)}
          onStickerSent={() => {
            setPicking(false);
            // Like a text reply: «También enviar al chat» counts for one.
            setEnElChat(false);
            setTimeout(() => lista.current?.scrollToEnd({ animated: true }), 300);
          }}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </Modal>
  );
}

/**
 * The root of a thread in the Slack format (design `s-02-hilo-abierto`): the
 * message in a flat row with its role, and «N RESPUESTAS» with a line below.
 */
function FlatThreadRoot(props: { root: ChatMessage; name: string; photo?: string; badge: string | null; count: number; myUserId: string; names: ReadonlyMap<string, string> }) {
  const { root } = props;
  return (
    <View className="-mx-3 mb-1">
      <View testID="raiz-del-hilo" className="flex-row gap-3 border-b border-outline/15 bg-surface px-3 pb-3 pt-1">
        <Avatar nombre={props.name} foto={props.photo} tamano={40} />
        <View className="min-w-0 flex-1">
          <View className="flex-row flex-wrap items-center gap-x-2">
            <Text className="text-[15px] font-bold text-on-surface">{props.name}</Text>
            {props.badge ? (
              <View className="rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5">
                <Text className="text-[11px] font-bold uppercase tracking-wide text-primary">{props.badge}</Text>
              </View>
            ) : null}
            <Text className="ml-auto text-[12px] text-on-surface-variant">{formatClock(root.at)}</Text>
          </View>
          <Text className="mt-1 text-[15px] leading-[22px] text-on-surface">{root.deletedAt ? 'Se eliminó este mensaje' : root.body ? <TextoConEnlaces texto={root.body} /> : root.media ? 'Archivo' : ''}</Text>
        </View>
      </View>
      <View className="flex-row items-center gap-3 px-3 pt-3">
        <Text className="text-[12px] font-bold uppercase tracking-wider text-on-surface-variant">{props.count === 1 ? '1 respuesta' : `${props.count} respuestas`}</Text>
        <View className="h-px flex-1 bg-outline/15" />
      </View>
    </View>
  );
}

function CabeceraDelHilo(props: { raiz: ChatMessage; nombre: string; foto?: string; cuantas: number }) {
  return (
    <View className="mb-1 gap-2">
      <View testID="raiz-del-hilo" className="flex-row gap-3 rounded-xl border border-outline/10 bg-surface p-3">
        <Avatar nombre={props.nombre} foto={props.foto} tamano={36} />
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center justify-between">
            <Text className="text-[14px] font-semibold text-on-surface">{props.nombre}</Text>
            <Text className="text-[11px] text-on-surface-variant">{formatClock(props.raiz.at)}</Text>
          </View>
          <Text className="mt-0.5 text-[15px] text-on-surface">{props.raiz.deletedAt ? 'Se eliminó este mensaje' : props.raiz.body ? <TextoConEnlaces texto={props.raiz.body} /> : props.raiz.media ? 'Archivo' : ''}</Text>
        </View>
      </View>
      <View className="flex-row items-center gap-3">
        <View className="h-px flex-1 bg-outline/15" />
        <Text className="text-[12px] text-on-surface-variant">{props.cuantas === 1 ? '1 respuesta' : `${props.cuantas} respuestas`}</Text>
        <View className="h-px flex-1 bg-outline/15" />
      </View>
    </View>
  );
}

/**
 * Una respuesta del hilo con la MISMA burbuja del chat (20/10): sus colores
 * (en modo oscuro la propia era clara y la hora no se veía), la hora dentro de
 * la última línea (antes iba en un renglón aparte y dejaba un hueco bajo el
 * check), los links tocables con su tarjeta y las @menciones.
 */
function BurbujaDelHilo(props: { mensaje: Respuesta; mia: boolean; autor: string; conAutor: boolean; yo: string; jwt: string; nombres: ReadonlyMap<string, string>; entrega: DeliveryState; onLongPress?: () => void }) {
  const colores = useColores();
  const { mensaje, mia } = props;
  const pendiente = esPendiente(mensaje);
  const eliminado = !pendiente && Boolean(mensaje.deletedAt);
  const hora = formatClock(pendiente ? mensaje.queuedAt : mensaje.at);
  const colorAutor = !pendiente ? (colores[`autor-${colorDeAutor(String(mensaje.senderId))}` as keyof typeof colores] as string) : undefined;
  const enlace = !pendiente && !eliminado && mensaje.body ? primerEnlace(mensaje.body) : null;
  const meta = { hora, mia, entrega: pendiente ? ('pending' as const) : props.entrega, id: mensaje.clientKey, fallido: pendiente && Boolean(mensaje.fallo), editado: !pendiente && Boolean(mensaje.editedAt) && !eliminado };
  // A checklist made in the thread: its live card, as in the chat.
  if (!pendiente && !eliminado && mensaje.ref?.tipo === 'checklist') {
    return (
      <Pressable testID={`respuesta-${mensaje.clientKey}`} onLongPress={props.onLongPress} delayLongPress={350} className={`w-[92%] ${mia ? 'self-end' : 'self-start'}`}>
        {!mia && props.conAutor ? <Text className="pb-0.5 text-[13px] font-semibold" style={{ color: colorAutor }}>{props.autor}</Text> : null}
        <ChecklistEnElChat checklistId={mensaje.ref.id} jwt={props.jwt} yo={props.yo} nameOf={(userId) => props.nombres.get(userId) ?? 'Alguien'} members={checklistMembers(props.nombres, props.yo)} />
        <Text className={`pt-0.5 text-[11px] text-on-surface-variant ${mia ? 'self-end' : ''}`}>{hora}</Text>
      </Pressable>
    );
  }
  // A sticker reply (20/10): no bubble, like in the chat.
  if (!pendiente && !eliminado && mensaje.kind === 'sticker' && mensaje.media?.url) {
    return (
      <Pressable testID={`respuesta-${mensaje.clientKey}`} onLongPress={props.onLongPress} delayLongPress={350} className={mia ? 'items-end self-end' : 'items-start self-start'}>
        {!mia && props.conAutor ? <Text className="pb-0.5 text-[13px] font-semibold" style={{ color: colorAutor }}>{props.autor}</Text> : null}
        <Image source={{ uri: mensaje.media.url }} style={{ width: STICKER_IN_THREAD, height: STICKER_IN_THREAD }} contentFit="contain" recyclingKey={mensaje.clientKey} />
        <Text className="text-[11px] text-on-surface-variant">{hora}</Text>
      </Pressable>
    );
  }
  return (
    <Pressable testID={`respuesta-${mensaje.clientKey}`} onLongPress={props.onLongPress} delayLongPress={350} className={`max-w-[85%] overflow-hidden rounded-2xl ${mia ? 'self-end bg-burbuja-propia' : 'self-start bg-burbuja-ajena'}`}>
      {!mia && props.conAutor ? <Text className="px-3 pt-1.5 text-[13px] font-semibold" style={{ color: colorAutor }}>{props.autor}</Text> : null}
      {enlace ? <VistaPreviaDeEnlace url={enlace} jwt={props.jwt} mia={mia} /> : null}
      {eliminado ? (
        <Text className={`px-3 py-1.5 text-[15px] italic ${mia ? 'text-on-burbuja-propia-suave' : 'text-on-surface-variant'}`}>Se eliminó este mensaje</Text>
      ) : (
        <TextoConHora texto={mensaje.body ?? ''} menciones={pendiente ? undefined : mensaje.menciones} nombres={props.nombres} yo={props.yo} id={mensaje.clientKey} meta={meta} />
      )}
    </Pressable>
  );
}
