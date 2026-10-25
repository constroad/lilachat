import { Pressable, Text, View } from 'react-native';
import { formatPhoneDisplay, membersHeading } from '@lilachat/shared';
import { MoreVertical, UserPlus } from 'lucide-react-native';
import { Avatar } from '../ui/Avatar';
import { Rotulo } from '../ui/Rotulo';
import { useColores } from '../ui/tema';

export type Miembro = {
  id: string;
  name: string | null;
  phone: string | null;
  /** Su foto de perfil (FL13d); los servers viejos no la mandan. */
  avatarUrl?: string;
  role: 'admin' | 'member';
  esYo: boolean;
  /** An installed app (pending 91): an admin only takes it out of the channel. */
  app?: boolean;
};

/** El avatar de cada participante (dp), el de las filas de contacto. */
const AVATAR_DE_MIEMBRO = 44;
/** 16 de margen + el avatar + 12 de aire: donde empieza el nombre. */
const SANGRIA_DE_MIEMBRO = 16 + AVATAR_DE_MIEMBRO + 12;

/** La línea fina entre filas: arranca donde arranca el nombre, como en Ajustes. */
function Separador() {
  return <View className="absolute right-0 top-0 h-px bg-outline/10" style={{ left: SANGRIA_DE_MIEMBRO }} />;
}

/**
 * Los participantes del grupo (salió de `ChatDetailScreen`, FL13d): UNA
 * tarjeta con líneas finas, como Ajustes (FL13), con la foto de cada uno y
 * «Añadir participante» como primera fila, como el diseño.
 */
export function ParticipantesDelGrupo(props: {
  miembros: readonly Miembro[];
  nombreDe: (miembro: Miembro) => string;
  /** ¿Hay algo que hacer con esa persona? Si no, la fila va sin «⋮». */
  conAcciones: (miembro: Miembro) => boolean;
  accionando: boolean;
  onMenu: (miembro: Miembro) => void;
  onAnadir?: () => void;
  /** Tapping someone else's photo or name opens their card (José, 25/10/2026). */
  onShowPerson?: (miembro: Miembro) => void;
}) {
  const colores = useColores();
  return (
    <>
      {/* Pending 69 (design `r151-detalle-grupo`): «Agregar miembros» first, on its own, then the list. */}
      {props.onAnadir ? (
        <View className="mx-4 mt-4 overflow-hidden rounded-2xl border border-outline/10 bg-surface">
          <Pressable
            testID="fila-anadir-participante"
            onPress={props.onAnadir}
            android_ripple={{ color: colores.outline }}
            className="min-h-[64px] flex-row items-center gap-3 px-4 py-2.5"
          >
            <View className="items-center justify-center rounded-full bg-primary/10" style={{ width: AVATAR_DE_MIEMBRO, height: AVATAR_DE_MIEMBRO }}>
              <UserPlus size={20} color={colores.primary} />
            </View>
            <Text className="text-[15px] font-semibold text-primary">Agregar miembros</Text>
          </Pressable>
        </View>
      ) : null}
      <Rotulo sangrado>{membersHeading(props.miembros.length)}</Rotulo>
      <View className="mx-4 overflow-hidden rounded-2xl border border-outline/10 bg-surface">
        {props.miembros.map((miembro, indice) => (
          <View key={miembro.id} testID={`miembro-${miembro.id}`} className="min-h-[64px] flex-row items-center gap-3 px-4 py-2.5">
            {indice > 0 ? <Separador /> : null}
            <Pressable
              testID={`perfil-${miembro.id}`}
              accessibilityLabel={`Ver a ${props.nombreDe(miembro)}`}
              disabled={!props.onShowPerson || miembro.esYo}
              onPress={() => props.onShowPerson?.(miembro)}
              className="min-w-0 flex-1 flex-row items-center gap-3"
            >
              {/* Tu avatar lleva TU nombre: «Tú» salía como iniciales «TÚ». */}
              <Avatar nombre={miembro.esYo ? (miembro.name ?? '') : props.nombreDe(miembro)} foto={miembro.avatarUrl} tamano={AVATAR_DE_MIEMBRO} bot={miembro.app} />
              <View className="min-w-0 flex-1">
                <Text className="text-[15px] font-semibold text-on-surface" numberOfLines={1}>{props.nombreDe(miembro)}</Text>
                {!miembro.esYo && miembro.phone ? <Text className="text-[13px] text-on-surface-variant" numberOfLines={1}>{formatPhoneDisplay(miembro.phone)}</Text> : null}
              </View>
            </Pressable>
            {miembro.role === 'admin' ? (
              <View className="shrink-0 rounded-full border border-primary/30 bg-primary/[0.08] px-2.5 py-1">
                <Text className="text-[11px] font-semibold text-primary">Admin del grupo</Text>
              </View>
            ) : null}
            {/* El menú aparece solo si hay algo que hacer con esa persona. Una
                fila con «⋮» que abre una hoja vacía enseña que los botones de
                esta app no responden. El server revalida: esconder un botón
                no es un permiso. */}
            {props.conAcciones(miembro) ? (
              <Pressable
                testID={`btn-menu-${miembro.id}`}
                accessibilityLabel={`Opciones de ${props.nombreDe(miembro)}`}
                disabled={props.accionando}
                onPress={() => props.onMenu(miembro)}
                className={`h-11 w-11 shrink-0 items-center justify-center ${props.accionando ? 'opacity-40' : ''}`}
              >
                <MoreVertical size={18} color={colores['on-surface-variant']} />
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>
    </>
  );
}
