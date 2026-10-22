import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ArrowLeft, CalendarClock, ChevronDown, Link, Lock, MoreVertical, NotebookPen, Phone, Video } from 'lucide-react-native';
import { CALL_MENU } from './chatHeaderMenu';
import { HeaderDropdown } from './HeaderDropdown';
import type { ChatHeaderMenu } from './useChatHeaderMenu';
import { useMargenes } from '../ui/useMargenes';
import { Avatar } from '../ui/Avatar';
import { useColores } from '../ui/tema';

/** El avatar de la cabecera (dp): 40, como WhatsApp (antes 36). */
const AVATAR_DE_CABECERA = 40;
/** The call menu hangs under the camera, the ⋮ one under the ⋮ (dp from the right edge). */
const CALL_MENU_RIGHT = 52;
const CHAT_MENU_RIGHT = 8;
const CALL_ICONS = { voice: Phone, video: Video, schedule: CalendarClock, link: Link } as const;
const CALL_OPTIONS = CALL_MENU.map((option) => ({ ...option, Icon: CALL_ICONS[option.id] }));

/**
 * La cabecera del chat (salió de `ChatScreen`, que pasaba de 900 líneas): la
 * flecha, el avatar y el nombre que abren el detalle, el estado de conexión o
 * presencia, las llamadas en un 1:1 y el ⋮.
 */
export function EncabezadoDelChat(props: {
  nombre: string;
  foto?: string;
  secreto: boolean;
  /** Un borrador (chat contigo mismo): la libreta, como en la lista. */
  borrador?: boolean;
  conectado: boolean;
  subtitulo: string;
  otroEscribe: boolean;
  /** Solo en un 1:1: una llamada grupal es otra cosa. */
  puedeLlamar: boolean;
  onVolver: () => void;
  onAbrirDetalle: () => void;
  onLlamar: (conVideo: boolean) => void;
  /** Pending 42: a scheduled call and a call link, from the same menu. */
  onProgramarLlamada?: () => void;
  onEnlaceDeLlamada?: () => void;
  /** The ⋮'s options (José, 21/10: it opened the same as the avatar). */
  menu: ChatHeaderMenu;
}) {
  const colores = useColores();
  const margenes = useMargenes();
  const [openMenu, setOpenMenu] = useState<'calls' | 'chat' | null>(null);
  const { nombre: nombreVisible, foto: fotoVisible } = props;
  // Como el diseño: FLECHA (no la palabra «Atrás»), avatar del chat junto al
  // nombre, y el menú al final.
  return (
    <View className="flex-row items-center gap-2 border-b border-outline/10 bg-surface px-3 pb-3" style={{ paddingTop: margenes.cabecera }}>
      <Pressable onPress={props.onVolver} testID="btn-volver" className="h-11 w-11 items-center justify-center">
        <ArrowLeft size={22} color={colores["on-surface"]} />
      </Pressable>
      {/* Tocar el avatar Y el nombre abre el detalle, como en WhatsApp: es
          donde la gente lo busca, mucho antes que en el menú de tres puntos.
          Los dos van dentro del MISMO Pressable — que solo responda el avatar
          deja un área táctil chiquita al lado de un nombre que parece tocable. */}
      <Pressable
        testID="btn-abrir-detalle"
        accessibilityLabel="Ver el detalle del chat"
        onPress={props.onAbrirDetalle}
        className="min-w-0 flex-1 flex-row items-center gap-2"
      >
      <Avatar
        nombre={nombreVisible}
        foto={fotoVisible}
        tamano={AVATAR_DE_CABECERA}
        icono={props.borrador ? <NotebookPen size={20} color={colores.primary} /> : undefined}
      />
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-1.5">
          {/* El candado va PEGADO al nombre y no en una banda aparte: es una
              propiedad de con quién se está hablando, y tiene que verse en la
              misma mirada que el nombre. */}
          {props.secreto ? <Lock size={13} color={colores.primary} /> : null}
          <Text className="min-w-0 flex-1 text-base font-bold text-on-surface" numberOfLines={1}>
            {nombreVisible}
          </Text>
        </View>
        {/* El estado de conexión se DICE: un mensaje que no sale sin
            explicación es lo que hace desconfiar de una app de mensajería. */}
        {!props.conectado ? (
          // One line, like WhatsApp (José, 21/10): what does not go out yet keeps its clock in the bubble.
          <Text className="text-xs text-on-surface-variant" testID="estado-conexion" numberOfLines={1}>
            Conectando…
          </Text>
        ) : props.subtitulo ? (
          <Text
            testID="estado-presencia"
            className={`text-xs ${props.otroEscribe ? 'text-primary' : 'text-on-surface-variant'}`}
            numberOfLines={1}
            // Con video, llamada y menú el espacio es poco: antes de cortar la
            // «últ. vez» achica la letra un poco (FL13d).
            adjustsFontSizeToFit
            minimumFontScale={0.85}
          >
            {props.subtitulo}
          </Text>
        ) : null}
      </View>
      </Pressable>
      {/* Calls like WhatsApp (José, 21/10): the camera with its arrow opens voice or video. Only in a 1:1 (F10): a group call is another thing. */}
      {props.puedeLlamar ? (
        <Pressable testID="btn-llamadas" accessibilityLabel="Llamar" onPress={() => setOpenMenu('calls')} className="h-11 flex-row items-center justify-center gap-0.5 px-1.5">
          <Video size={21} color={colores["on-surface-variant"]} />
          <ChevronDown size={14} color={colores["on-surface-variant"]} />
        </Pressable>
      ) : null}
      <Pressable
        testID="btn-menu-chat"
        accessibilityLabel="Más opciones"
        onPress={() => {
          props.menu.refresh();
          setOpenMenu('chat');
        }}
        android_ripple={{ color: colores.outline, borderless: true, radius: 22 }}
        className="h-11 w-11 items-center justify-center"
      >
        <MoreVertical size={20} color={colores["on-surface-variant"]} />
      </Pressable>
      <HeaderDropdown testID="menu-llamadas" visible={openMenu === 'calls'} options={CALL_OPTIONS} right={CALL_MENU_RIGHT} onSelect={(id) => (id === 'schedule' ? props.onProgramarLlamada?.() : id === 'link' ? props.onEnlaceDeLlamada?.() : props.onLlamar(id === 'video'))} onClose={() => setOpenMenu(null)} />
      <HeaderDropdown testID="menu-del-chat" visible={openMenu === 'chat'} options={props.menu.options} right={CHAT_MENU_RIGHT} onSelect={props.menu.select} onClose={() => setOpenMenu(null)} />
    </View>
  );
}
