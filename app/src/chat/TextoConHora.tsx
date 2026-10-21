import { Text, View } from 'react-native';
import type { ComponentProps } from 'react';
import type { MencionEnMensaje } from '@lilachat/shared';
import { TextoDelMensaje } from './TextoDelMensaje';
import { ETIQUETA_EDITADO, MetaDeMensaje } from './MetaDeMensaje';
import { useColores } from '../ui/tema';
import { useChatFont } from '../ui/chatFont';

/** El relleno invisible al final del texto: reserva el lugar de la hora. */
const NBSP = '\u00A0';
/** El lugar de los checks (14 dp) a 11 sp. */
const RELLENO_CHECKS = NBSP.repeat(6);
/** El lugar de la estrella de destacado (11 dp + el espacio) a 11 sp. */
const RELLENO_ESTRELLA = NBSP.repeat(4);

/**
 * El texto de una burbuja con la hora y los checks DENTRO, alineados a la
 * última línea, como WhatsApp: el texto lleva al final un relleno invisible
 * del ancho de la hora y la hora va encima, abajo a la derecha. Cero renglón
 * extra. Lo usan el chat y el hilo (20/10: en el hilo la hora iba en su propio
 * renglón, dejaba un hueco bajo el check y en modo oscuro no se veía).
 */
export function TextoConHora(props: {
  texto: string;
  menciones?: MencionEnMensaje[];
  nombres?: ReadonlyMap<string, string>;
  yo: string;
  /** Para recordar si un mensaje largo se abrió. */
  id: string;
  meta: ComponentProps<typeof MetaDeMensaje>;
}) {
  const colores = useColores();
  const font = useChatFont();
  const { meta } = props;
  const mia = meta.mia;
  return (
    <View className="px-3 pb-1.5 pt-1.5">
      <Text className={mia ? 'text-on-burbuja-propia' : 'text-on-burbuja-ajena'} style={{ fontSize: font.size, lineHeight: font.line }}>
        <TextoDelMensaje texto={props.texto} menciones={props.menciones} nombres={props.nombres} yo={props.yo} enBurbujaPropia={mia} id={props.id} />
        {/* El relleno es la MISMA hora, al mismo tamaño e invisible: reserva
            exactamente su ancho. Del color de la burbuja y no `transparent`: en
            Android un span anidado transparente se pinta gris. */}
        <Text className="text-[11px]" style={{ color: mia ? colores['burbuja-propia'] : colores['burbuja-ajena'] }}>
          {`${NBSP}${NBSP}${meta.destacado ? RELLENO_ESTRELLA : ''}${meta.editado ? `${ETIQUETA_EDITADO}${NBSP}` : ''}${meta.hora}${mia ? RELLENO_CHECKS : NBSP}`}
        </Text>
      </Text>
      <View className="absolute bottom-1 right-2.5">
        <MetaDeMensaje {...meta} />
      </View>
    </View>
  );
}
