import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { ArrowDownToLine, X } from 'lucide-react-native';
import type { AvisoDeActualizacion } from './avisoDeActualizacion';
import type { EstadoActualizacion } from './useActualizador';
import { useColores } from '../ui/tema';

/**
 * La banda de «hay una versión nueva», arriba de la lista.
 *
 * **Se actualiza DENTRO de Lilachat** (José, 14/09/2026): baja el APK con
 * progreso, verifica el `sha256` y se lo pasa al instalador de Android, sin abrir
 * LilaStore. El precio, decidido a sabiendas: `REQUEST_INSTALL_PACKAGES` en un
 * chat es una combinación que Play Protect mira con lupa. Se acepta porque la app
 * ya se reparte fuera de Play (la familia ya hace «instalar de todas formas»), y
 * abrir otra app para actualizar era el estorbo que se quería sacar. Si la
 * descarga o la verificación fallan, la banda ofrece LilaStore como salida.
 *
 * **Por qué una banda y no una burbuja.** Un push por una actualización es la vía
 * más rápida a que alguien silencie las notificaciones —y con ellas los mensajes,
 * que es lo único que importa—. Un modal al abrir interrumpe. Una banda se ve, no
 * tapa nada, y se puede sacar.
 */
export function BandaDeActualizacion({
  aviso,
  estado,
  onActualizar,
  onAbrirTienda,
  onDescartar,
}: {
  aviso: AvisoDeActualizacion;
  estado: EstadoActualizacion;
  /** Baja, verifica e instala dentro de la app. */
  onActualizar: () => void;
  /** Salida a LilaStore, si la descarga in-app falló. */
  onAbrirTienda: () => void;
  onDescartar: () => void;
}) {
  const colores = useColores();
  if (aviso.tipo === 'ninguno') return null;

  const obligatoria = aviso.tipo === 'obligatoria';
  const ocupado = estado.fase === 'descargando' || estado.fase === 'instalando';
  const pct = estado.fase === 'descargando' ? Math.round(estado.progreso * 100) : 0;

  const subtitulo =
    estado.fase === 'descargando'
      ? `Descargando… ${pct}%`
      : estado.fase === 'instalando'
        ? 'Abriendo el instalador…'
        : estado.fase === 'error'
          ? estado.mensaje
          : obligatoria
            ? 'Esta versión ya no se puede usar.'
            : 'Hay una versión nueva.';

  return (
    <View
      testID="banda-actualizacion"
      className={`mx-4 mb-2 mt-1 rounded-xl p-3 ${obligatoria ? 'bg-error/10' : 'bg-primary/[0.08]'}`}
    >
      <View className="flex-row items-center gap-3">
        <ArrowDownToLine size={18} color={obligatoria ? colores.error : colores.primary} />
        <View className="min-w-0 flex-1">
          <Text className="text-[13px] font-semibold text-on-surface">
            {obligatoria ? 'Tenés que actualizar' : `Lilachat ${aviso.version}`}
          </Text>
          <Text
            className={`text-[11px] leading-4 ${estado.fase === 'error' ? 'text-error' : 'text-on-surface-variant'}`}
          >
            {subtitulo}
          </Text>
        </View>

        {ocupado ? (
          <ActivityIndicator color={colores.primary} testID="actualizacion-en-curso" />
        ) : (
          <Pressable
            testID="btn-actualizar-ahora"
            onPress={estado.fase === 'error' ? onAbrirTienda : onActualizar}
            className="min-h-[44px] items-center justify-center rounded-full bg-primary px-4"
          >
            <Text className="text-[13px] font-bold text-on-primary">
              {estado.fase === 'error' ? 'LilaStore' : 'Actualizar'}
            </Text>
          </Pressable>
        )}

        {/* La obligatoria NO se descarta; tampoco a mitad de una descarga. */}
        {obligatoria || ocupado ? null : (
          <Pressable
            testID="btn-descartar-actualizacion"
            accessibilityLabel="Ahora no"
            onPress={onDescartar}
            className="h-11 w-8 items-center justify-center"
          >
            <X size={16} color={colores['on-surface-variant']} />
          </Pressable>
        )}
      </View>

      {/* Barra de progreso: sale solo mientras baja, debajo de todo. */}
      {estado.fase === 'descargando' ? (
        <View className="mt-2 h-1 overflow-hidden rounded-full bg-on-surface/10">
          <View className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </View>
      ) : null}
    </View>
  );
}
