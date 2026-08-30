import { Linking, Pressable, Text, View } from 'react-native';
import { ArrowDownToLine, X } from 'lucide-react-native';
import type { AvisoDeActualizacion } from './avisoDeActualizacion';
import { useColores } from '../ui/tema';

/**
 * La banda de «hay una versión nueva», arriba de la lista.
 *
 * **Por qué una banda y no una burbuja.** Una notificación push por una
 * actualización es la vía más rápida a que alguien silencie las notificaciones
 * de la app — y con ellas los mensajes, que es lo único que importa de verdad.
 * Un modal al abrir interrumpe justo cuando la persona venía a leer algo. Una
 * banda se ve, no tapa nada, y se puede sacar.
 *
 * **Y por qué NO se instala sola.** Instalar un APK exige el permiso
 * `REQUEST_INSTALL_PACKAGES`, que es exactamente la forma que tiene el malware
 * — a LilaStore ya la bloqueó Play Protect por su combinación de permisos, y esa
 * app SÍ es una tienda, que es su motivo legítimo para pedirlo. Una app de chat
 * que sabe instalar aplicaciones es una señal de alarma justificada. Así que
 * acá se avisa y se DERIVA a LilaStore, que además verifica el `sha256` antes de
 * entregarle nada al instalador de Android.
 */
const LILASTORE = 'lilastore://';

export function BandaDeActualizacion({
  aviso,
  downloadUrl,
  onDescartar,
}: {
  aviso: AvisoDeActualizacion;
  /** La descarga directa, para quien no tiene la tienda instalada. */
  downloadUrl: string;
  onDescartar: () => void;
}) {
  const colores = useColores();
  if (aviso.tipo === 'ninguno') return null;

  const obligatoria = aviso.tipo === 'obligatoria';

  /**
   * Primero la tienda, que verifica el archivo; si no está instalada, el
   * navegador. **No se pregunta con `canOpenURL`**: en Android 11+ eso exige
   * declarar la app en `<queries>` del manifiesto, y contesta `false` sin
   * decirlo — se leería como «no tenés la tienda» a quien sí la tiene.
   */
  const abrir = async () => {
    try {
      await Linking.openURL(LILASTORE);
    } catch {
      if (downloadUrl) void Linking.openURL(downloadUrl);
    }
  };

  return (
    <View
      testID="banda-actualizacion"
      className={`mx-4 mb-2 mt-1 flex-row items-center gap-3 rounded-xl p-3 ${
        obligatoria ? 'bg-error/10' : 'bg-primary/[0.08]'
      }`}
    >
      <ArrowDownToLine size={18} color={obligatoria ? colores.error : colores.primary} />
      <View className="min-w-0 flex-1">
        <Text className="text-[13px] font-semibold text-on-surface">
          {obligatoria ? 'Tenés que actualizar' : `Lilachat ${aviso.version}`}
        </Text>
        <Text className="text-[11px] leading-4 text-on-surface-variant">
          {obligatoria
            ? 'Esta versión ya no se puede usar. Actualizá desde LilaStore.'
            : 'Hay una versión nueva. Se actualiza desde LilaStore.'}
        </Text>
      </View>
      <Pressable
        testID="btn-actualizar-ahora"
        onPress={() => void abrir()}
        className="min-h-[44px] items-center justify-center rounded-full bg-primary px-4"
      >
        <Text className="text-[13px] font-bold text-on-primary">Actualizar</Text>
      </Pressable>
      {/* La obligatoria NO se descarta: por debajo del mínimo la app no
          funciona, y esconder el aviso deja a alguien mirando algo roto sin
          saber por qué. */}
      {obligatoria ? null : (
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
  );
}
