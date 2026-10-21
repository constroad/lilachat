import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { BarChart3, Bell, BellOff, CalendarDays, Camera, Check, CheckCheck, ClipboardCheck, FileText, Lock, Mic, NotebookPen, Pin, Sticker, Video, type LucideIcon } from 'lucide-react-native';
import {
  formatChatTimestamp,
  nombreDeContacto,
  resolveChatPreview,
  resolveDeliveryState,
  textoDeAviso,
  type ChatPreview,
  type MediaDePreview,
} from '@lilachat/shared';
import type { ChatSummary } from '../api/client';
import { agendaPorTelefono } from '../contacts/agendaEnMemoria';
import { precargarChat } from './mensajesGuardados';
import { useFunInRow } from './nudge';
import { Avatar } from '../ui/Avatar';
import { useColores } from '../ui/tema';

/** El avatar de la lista (dp): 52, como WhatsApp (antes 48). */
const AVATAR_DE_LISTA = 52;

/** El ícono de la vista previa de una media (FL3): vectorial, no emoji. */
const ICONO_DE_MEDIA: Record<MediaDePreview, LucideIcon> = {
  foto: Camera,
  video: Video,
  voz: Mic,
  archivo: FileText,
  encuesta: BarChart3,
  evento: CalendarDays,
  recordatorio: Bell,
  sticker: Sticker,
  checklist: ClipboardCheck,
};

/**
 * Una fila de la lista de chats (salió de `ChatListScreen`, que pasaba de 900
 * líneas). `memo`: escribir en el buscador o que alguien escriba en OTRO chat
 * no redibuja todas las filas.
 */
export const FilaDeChat = memo(function FilaDeChat(props: {
  chat: ChatSummary;
  /** El nombre ya resuelto contra la agenda. */
  titulo: string;
  miUserId: string;
  /** Mi foto: el chat contigo («Tú») la lleva, como WhatsApp. */
  miFoto?: string | null;
  marcado: boolean;
  enLinea: boolean;
  escribiendo: boolean;
  borrador?: string;
  /** Estables (useCallback en la lista): si no, el `memo` no sirve de nada. */
  onTocar: (chat: ChatSummary) => void;
  onMantener: (chatId: string) => void;
  /** This chat is open on screen: it plays its own nudges, the row does not. */
  open?: boolean;
}) {
  const colores = useColores();
  const { chat } = props;
  const funStyle = useFunInRow(chat, props.miUserId, props.open === true);
  return (
    <Animated.View style={funStyle}>
    <Pressable
      testID={`chat-${chat.id}`}
      // En modo selección el toque marca/desmarca; fuera de él, abre.
      // Mantener presionado SIEMPRE entra al modo y marca esta fila.
      onPress={() => props.onTocar(chat)}
      // Al apoyar el dedo, ~100 ms antes del toque: el chat abre ya pintado (FL12).
      onPressIn={() => precargarChat(chat.id)}
      onLongPress={() => props.onMantener(chat.id)}
      delayLongPress={250}
      // El ripple de Material al tocar (FL3): sin respuesta visual, la
      // fila parecía no haber recibido el toque.
      android_ripple={{ color: colores.outline }}
      // Sin línea entre filas, como WhatsApp: el aire las separa.
      className={`min-h-[76px] flex-row items-center gap-3 px-4 py-2.5 ${props.marcado ? 'bg-primary/10' : ''}`}
    >
      <View style={{ width: AVATAR_DE_LISTA, height: AVATAR_DE_LISTA }} className="shrink-0">
        <Avatar
          nombre={props.titulo}
          foto={chat.propio ? (props.miFoto ?? undefined) : chat.avatarUrl}
          tamano={AVATAR_DE_LISTA}
          // Un borrador se distingue de una persona y de un grupo; el chat contigo lleva tu foto.
          icono={chat.kind === 'notas' && !chat.propio ? <NotebookPen size={22} color={colores.primary} /> : undefined}
        />
        {/* El tilde de selección tapa el avatar cuando la fila está
            marcada: es el feedback de «este entra en la acción». */}
        {props.marcado ? (
          <View
            testID={`marcado-${chat.id}`}
            className="absolute inset-0 items-center justify-center rounded-full bg-primary"
          >
            <CheckCheck size={22} color={colores['on-primary']} />
          </View>
        ) : null}
        {/* Punto de «en línea» como el diseño: abajo a la derecha del
            avatar y con anillo del color del fondo, que es lo que lo
            recorta en vez de dejarlo pegado. */}
        {props.enLinea ? (
          <View
            testID={`en-linea-${chat.id}`}
            className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-background bg-en-linea"
          />
        ) : null}
      </View>
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-2">
          {/* Candado pegado al nombre: quién es y cómo se le habla se
              leen de una sola mirada. */}
          {chat.encrypted ? <Lock size={13} color={colores.primary} /> : null}
          <Text className="min-w-0 flex-1 text-base font-semibold text-on-surface" numberOfLines={1}>
            {props.titulo}
          </Text>
          {/* Hora RELATIVA como el diseño (reloj hoy, «Ayer», el día,
              la fecha), y en ACENTO cuando hay sin leer: en el diseño la
              de Sofía —3 sin leer— es violeta y la de Carlos, gris. */}
          {/* Fijado y silenciado: iconos chicos antes de la hora, como
              WhatsApp. El silenciado además atenúa el badge (abajo). */}
          {chat.pinned ? (
            <Pin size={13} color={colores['on-surface-variant']} testID={`fijado-${chat.id}`} />
          ) : null}
          {chat.muted ? (
            <BellOff size={13} color={colores['on-surface-variant']} testID={`silenciado-${chat.id}`} />
          ) : null}
          {chat.lastMessage ? (
            <Text
              className={`shrink-0 text-[11px] ${
                (chat.unread > 0 || chat.markedUnread) && !chat.muted
                  ? 'font-semibold text-primary'
                  : 'text-on-surface-variant'
              }`}
              testID={`hora-${chat.id}`}
            >
              {formatChatTimestamp(chat.lastMessage.at)}
            </Text>
          ) : null}
        </View>
        {/* El badge va en ESTA línea, junto al preview — no centrado en
            la fila, que es donde lo había puesto la primera versión. */}
        <View className="mt-0.5 flex-row items-center gap-2">
          {(() => {
            // EN UN CHAT SECRETO LA LISTA NO MUESTRA EL ÚLTIMO MENSAJE.
            //
            // No es una decisión de estilo: el server manda el sobre, no
            // el texto, así que acá no HAY nada que mostrar. Y aunque lo
            // hubiera, la vista previa se ve en la pantalla bloqueada y
            // en la notificación — el lugar donde menos sentido tiene
            // filtrar lo que se acaba de cifrar.
            // El borrador de un secreto tampoco se muestra: solo que lo hay.
            const { borrador } = props;
            const preview: ChatPreview = chat.encrypted
              ? borrador?.trim()
                ? { etiqueta: 'Borrador', text: '', style: 'borrador' }
                : { text: 'Mensaje cifrado', style: 'normal' }
              : resolveChatPreview({
                  typing: props.escribiendo,
                  borrador,
                  // El aviso de grupo se rearma con los nombres de TU
                  // agenda, igual que adentro de la conversación; si no
                  // se puede, queda el texto del server.
                  lastBody: avisoDelUltimo(chat, props.miUserId) ?? chat.lastMessage?.body,
                  lastKind: chat.lastMessage?.kind,
                  eliminado: Boolean(chat.lastMessage?.deletedAt),
                  enHilo: chat.lastMessage?.hiloDe !== undefined,
                });
            // Lo último es MÍO: los checks van antes del texto, como
            // WhatsApp (gris enviado/entregado, azul leído).
            const ultimoMio =
              preview.style === 'normal' &&
              !!chat.lastMessage &&
              String(chat.lastMessage.senderId) === props.miUserId &&
              chat.lastMessage.kind !== 'system';
            const entrega = ultimoMio
              ? resolveDeliveryState({
                  seq: chat.lastMessage?.seq ?? null,
                  otherReadSeq: chat.othersReadSeq,
                  otherDeliveredSeq: chat.othersDeliveredSeq,
                })
              : null;
            const IconoDeMedia = preview.media ? ICONO_DE_MEDIA[preview.media] : null;
            return (
              <View className="min-w-0 flex-1 flex-row items-center gap-1">
                {entrega ? (
                  entrega === 'sent' ? (
                    <Check size={16} color={colores['on-surface-variant']} testID={`check-lista-${chat.id}`} />
                  ) : (
                    <CheckCheck
                      size={16}
                      color={entrega === 'read' ? colores['check-leido'] : colores['on-surface-variant']}
                      testID={`check-lista-${chat.id}`}
                    />
                  )
                ) : null}
                {IconoDeMedia ? <IconoDeMedia size={15} color={colores['on-surface-variant']} /> : null}
                <Text
                  className={`min-w-0 flex-1 text-sm ${
                    preview.style === 'typing' ? 'italic text-primary' : preview.style === 'eliminado' ? 'italic text-on-surface-variant' : 'text-on-surface-variant'
                  }`}
                  numberOfLines={1}
                  testID={`preview-${chat.id}`}
                >
                  {preview.etiqueta ? (
                    <Text className="font-semibold text-primary">{`${preview.etiqueta}${preview.text ? ' ' : ''}`}</Text>
                  ) : null}
                  {preview.text}
                </Text>
              </View>
            );
          })()}
          {chat.unread === 0 && chat.markedUnread ? (
            // Marcado a mano como no leído (FL9): el punto sin número de WhatsApp.
            <View
              testID={`marcado-no-leido-${chat.id}`}
              className={`h-3 w-3 shrink-0 rounded-full ${chat.muted ? 'bg-on-surface-variant/40' : 'bg-primary'}`}
            />
          ) : null}
          {chat.unread > 0 ? (
            <View
              className={`h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full px-1.5 ${
                chat.muted ? 'bg-on-surface-variant/40' : 'bg-primary'
              }`}
              testID={`no-leidos-${chat.id}`}
            >
              <Text
                className={`text-[11px] font-bold ${
                  chat.muted ? 'text-on-surface' : 'text-on-primary'
                }`}
              >
                {chat.unread}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
    </Animated.View>
  );
});

/**
 * El texto del aviso de grupo para la vista previa, con los nombres de la
 * agenda. `null` si el último mensaje no es un aviso o si no alcanza para
 * armarlo — ahí manda el texto que compuso el server.
 */
function avisoDelUltimo(chat: ChatSummary, miUserId: string): string | null {
  const aviso = chat.lastMessage?.system;
  if (!aviso) return null;

  const agenda = agendaPorTelefono();
  const nombreDe = (persona?: { phone?: string; name?: string }) =>
    persona
      ? nombreDeContacto({
          delServidor: persona.name ?? null,
          telefono: persona.phone ?? null,
          agenda,
        })
      : '';

  return (
    textoDeAviso({
      quien: nombreDe(aviso.quien) || 'Alguien',
      esMio: chat.lastMessage?.senderId === miUserId,
      evento: aviso.evento,
      aQuien: nombreDe(aviso.aQuien) || undefined,
      aMi: aviso.targetId === miUserId,
      valor: aviso.valor,
    }) || null
  );
}
