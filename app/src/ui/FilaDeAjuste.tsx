import { Children, Fragment, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { useColores } from './tema';

/** El círculo del ícono (dp) y el aire a su derecha. */
const LADO_DEL_ICONO = 36;
const AIRE_DEL_ICONO = 14;
const MARGEN_LATERAL = 16;
/** Desde el borde de la fila hasta el texto: lo que se despliega debajo se alinea acá. */
export const SANGRIA_DEL_TEXTO = LADO_DEL_ICONO + AIRE_DEL_ICONO;
/** La línea entre filas arranca donde arranca el texto, como Android y WhatsApp. */
const SANGRIA_DEL_DIVISOR = MARGEN_LATERAL + SANGRIA_DEL_TEXTO;

/**
 * Un bloque de ajustes: UNA tarjeta con las filas separadas por una línea fina
 * (auditoría §48). Antes cada fila era su propia tarjeta con borde, y la
 * pantalla se leía como una pila de cajas sueltas.
 *
 * Las filas tienen que ser elementos que SIEMPRE dibujan algo: un hijo que
 * devuelve `null` deja una línea de más. Lo condicional se decide acá afuera.
 */
export function GrupoDeAjustes({ children, testID }: { children: ReactNode; testID?: string }) {
  const filas = Children.toArray(children);
  return (
    <View testID={testID} className="overflow-hidden rounded-2xl border border-outline/10 bg-surface">
      {filas.map((fila, indice) => (
        <Fragment key={indice}>
          {indice > 0 ? <View className="h-px bg-outline/10" style={{ marginLeft: SANGRIA_DEL_DIVISOR }} /> : null}
          {fila}
        </Fragment>
      ))}
    </View>
  );
}

type PropsDeFila = {
  testID?: string;
  icono: LucideIcon;
  titulo: string;
  detalle?: string;
  detalleTestID?: string;
  /** `peligro`: cerrar sesión, lo que no se deshace. `alerta`: algo pide atención. */
  tono?: 'normal' | 'alerta' | 'peligro';
  onPress?: () => void;
  deshabilitada?: boolean;
  /** Un interruptor, un spinner. Sin esto y con `onPress`, va la flecha. */
  derecha?: ReactNode;
  /** Lo que se despliega dentro de la misma fila (el texto de la auto-respuesta). */
  children?: ReactNode;
};

/** Una fila de ajuste: ícono en su círculo, título, detalle y lo de la derecha. */
export function FilaDeAjuste(props: PropsDeFila) {
  const colores = useColores();
  const conTono = props.tono === 'peligro' || props.tono === 'alerta';
  const contenido = (
    <>
      <View className="min-h-[40px] flex-row items-center" style={{ gap: AIRE_DEL_ICONO }}>
        <View
          style={{ width: LADO_DEL_ICONO, height: LADO_DEL_ICONO }}
          className={`items-center justify-center rounded-full ${conTono ? 'bg-error/10' : 'bg-primary/10'}`}
        >
          <props.icono size={18} color={conTono ? colores.error : colores.primary} />
        </View>
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className={`text-[15px] font-semibold ${props.tono === 'peligro' ? 'text-error' : 'text-on-surface'}`}>
            {props.titulo}
          </Text>
          {props.detalle ? (
            <Text testID={props.detalleTestID} className="text-[13px] leading-[18px] text-on-surface-variant">
              {props.detalle}
            </Text>
          ) : null}
        </View>
        {props.derecha ?? (props.onPress ? <ChevronRight size={18} color={colores.outline} /> : null)}
      </View>
      {props.children}
    </>
  );
  const marco = 'min-h-[64px] justify-center px-4 py-3';
  if (!props.onPress) {
    return (
      <View testID={props.testID} className={marco}>
        {contenido}
      </View>
    );
  }
  return (
    <Pressable
      testID={props.testID}
      onPress={props.onPress}
      disabled={props.deshabilitada}
      android_ripple={{ color: colores.outline }}
      className={`${marco} ${props.deshabilitada ? 'opacity-50' : ''}`}
    >
      {contenido}
    </Pressable>
  );
}
