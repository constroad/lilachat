import { ActivityIndicator, Linking, Modal, Pressable, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ArrowLeft, Info, Monitor } from 'lucide-react-native';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';
import { useEscanerDeVinculacion, type FaseDelEscaner } from './useEscanerDeVinculacion';

/**
 * Leer el QR de Lilachat Web con la cámara y confirmar (W5, diseño
 * `w5-app-escaner.png`): cámara a pantalla completa con el recuadro, y la
 * hoja de abajo que pregunta «¿Vincular Chrome en macOS?».
 */
const LADO_DEL_RECUADRO = 260;
const ESQUINA = 36;

export function EscanerDeVinculacion(props: { visible: boolean; jwt: string; onCerrar: () => void; onVinculado: (nombre: string) => void }) {
  return (
    <Modal visible={props.visible} animationType="slide" onRequestClose={props.onCerrar} statusBarTranslucent>
      {props.visible ? <Escaner {...props} /> : null}
    </Modal>
  );
}

function Escaner(props: { jwt: string; onCerrar: () => void; onVinculado: (nombre: string) => void }) {
  const margenes = useMargenes();
  const [permiso, pedirPermiso] = useCameraPermissions();
  const { estado, alLeer, vincular, cancelar } = useEscanerDeVinculacion(props.jwt, props.onVinculado);
  const leyendo = estado.fase === 'buscando';
  return (
    <View testID="escaner-vinculacion" className="flex-1 bg-black">
      {permiso?.granted ? (
        <CameraView
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={leyendo ? (lectura) => void alLeer(lectura.data) : undefined}
        />
      ) : null}
      {/* Franja oscura: sobre una pared clara (o una pantalla) el título blanco no se leía. */}
      <View className="flex-row items-center gap-2 bg-black/50 px-2 pb-2" style={{ paddingTop: margenes.cabecera }}>
        <Pressable testID="btn-cerrar-escaner" accessibilityLabel="Volver" onPress={props.onCerrar} className="h-12 w-12 items-center justify-center rounded-full">
          <ArrowLeft size={22} color="white" />
        </Pressable>
        <Text className="flex-1 text-base font-medium text-white">Apunta al código de lilachat.constroad.com</Text>
      </View>
      {permiso && !permiso.granted ? (
        <SinPermiso puedePreguntar={permiso.canAskAgain} onPedir={() => void pedirPermiso()} />
      ) : (
        <Recuadro />
      )}
      {estado.fase === 'aviso' ? (
        <View testID="aviso-escaner" className="absolute left-6 right-6 items-center" style={{ bottom: margenes.pie + 40 }}>
          <Text className="rounded-full bg-black/70 px-4 py-2 text-center text-sm text-white">{estado.texto}</Text>
        </View>
      ) : null}
      {estado.fase === 'consultando' ? (
        <View className="absolute left-0 right-0 items-center" style={{ bottom: margenes.pie + 40 }}>
          <ActivityIndicator color="white" />
        </View>
      ) : null}
      {estado.fase === 'confirmando' || estado.fase === 'vinculando' ? (
        <HojaDeConfirmacion estado={estado} pie={margenes.pie} onVincular={() => void vincular()} onCancelar={cancelar} />
      ) : null}
    </View>
  );
}

function Recuadro() {
  const colores = useColores();
  const borde = { position: 'absolute' as const, width: ESQUINA, height: ESQUINA, borderColor: colores.primary };
  return (
    <View className="flex-1 items-center justify-center">
      <View style={{ width: LADO_DEL_RECUADRO, height: LADO_DEL_RECUADRO }}>
        <View style={[borde, { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 20 }]} />
        <View style={[borde, { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 20 }]} />
        <View style={[borde, { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 20 }]} />
        <View style={[borde, { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 20 }]} />
      </View>
    </View>
  );
}

function SinPermiso({ puedePreguntar, onPedir }: { puedePreguntar: boolean; onPedir: () => void }) {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <Text className="text-center text-base text-white">Para leer el código, Lilachat necesita usar la cámara.</Text>
      <Pressable
        testID="btn-permiso-camara"
        onPress={puedePreguntar ? onPedir : () => void Linking.openSettings()}
        className="mt-6 h-12 items-center justify-center rounded-xl bg-primary px-6"
      >
        <Text className="text-base font-semibold text-on-primary">{puedePreguntar ? 'Permitir la cámara' : 'Abrir los ajustes'}</Text>
      </Pressable>
    </View>
  );
}

function HojaDeConfirmacion(props: {
  estado: Extract<FaseDelEscaner, { fase: 'confirmando' | 'vinculando' }>;
  pie: number;
  onVincular: () => void;
  onCancelar: () => void;
}) {
  const colores = useColores();
  const vinculando = props.estado.fase === 'vinculando';
  return (
    <View testID="hoja-vincular" className="absolute bottom-0 left-0 right-0 items-center rounded-t-3xl bg-surface px-6 pt-3" style={{ paddingBottom: props.pie + 16 }}>
      <View className="h-1.5 w-10 rounded-full bg-outline/30" />
      <View className="mt-6 h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <Monitor size={26} color={colores.primary} />
      </View>
      <Text testID="titulo-vincular" className="mt-4 text-center text-xl font-bold text-on-surface">
        ¿Vincular {props.estado.nombre}?
      </Text>
      <Text className="mt-2 text-center text-[15px] leading-6 text-on-surface-variant">
        Ese navegador podrá leer y enviar mensajes en tu nombre hasta que cierres su sesión.
      </Text>
      <View className="mt-5 w-full flex-row gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
        <Info size={18} color={colores.advertencia} />
        <Text className="flex-1 text-sm leading-5 text-on-surface">Solo vincula una computadora que estés usando tú. Nadie de Lilachat te pedirá este código.</Text>
      </View>
      <Pressable
        testID="btn-confirmar-vincular"
        disabled={vinculando}
        onPress={props.onVincular}
        className="mt-6 h-12 w-full items-center justify-center rounded-xl bg-primary"
      >
        {vinculando ? <ActivityIndicator color="white" /> : <Text className="text-base font-semibold text-on-primary">Vincular</Text>}
      </Pressable>
      <Pressable testID="btn-cancelar-vincular" disabled={vinculando} onPress={props.onCancelar} className="mt-2 h-12 w-full items-center justify-center">
        <Text className="text-base font-medium text-on-surface-variant">Cancelar</Text>
      </Pressable>
    </View>
  );
}
