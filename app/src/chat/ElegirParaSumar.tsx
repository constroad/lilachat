import { Modal, Pressable, Text, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { ContactPicker } from '../contacts/ContactPicker';
import type { Credential } from '../auth/credentialStore';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';

/**
 * Elegir a quién sumar al grupo.
 *
 * **Se usa el MISMO selector que el lápiz** (`ContactPicker`), no una lista
 * propia. La que había acá listaba solo a la gente con la que ya tenías
 * conversación abierta, así que a alguien de tu agenda que está en Lilachat y
 * con quien nunca hablaste no había forma de sumarlo: primero había que abrirle
 * un chat 1:1 que nadie quería. El selector del lápiz ya cruza la agenda del
 * teléfono contra el padrón (`POST /contacts/match`) y trae también «Invitar a
 * Lilachat» para quien todavía no entró.
 *
 * Los que ya están adentro se descuentan con `candidatosParaSumar`; se esconden
 * en vez de fallar al tocarlos, que sería hacerle descubrir la regla a los
 * golpes.
 */
export function ElegirParaSumar({
  visible,
  credential,
  yaEstan,
  onCerrar,
  onElegir,
}: {
  visible: boolean;
  credential: Credential;
  yaEstan: readonly string[];
  onCerrar: () => void;
  onElegir: (userId: string) => void;
}) {
  const colores = useColores();
  const margenes = useMargenes();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      <View className="flex-1 bg-background" testID="elegir-para-sumar">
        <View
          className="flex-row items-center gap-2 border-b border-outline/10 bg-surface px-3 pb-3"
          style={{ paddingTop: margenes.cabecera }}
        >
          <Pressable
            testID="btn-cerrar-sumar"
            accessibilityLabel="Cancelar"
            onPress={onCerrar}
            className="h-11 w-11 items-center justify-center"
          >
            <ArrowLeft size={22} color={colores['on-surface']} />
          </Pressable>
          <View className="min-w-0 flex-1">
            <Text className="text-lg font-bold text-on-surface">Sumar al grupo</Text>
            {/* Se DICE que al que no está se lo puede invitar: sin esta línea,
                buscar a alguien de la agenda y no encontrarlo se lee como que la
                app no lo tiene, no como que le falta instalarla. */}
            <Text className="text-[12px] text-on-surface-variant">
              De tus contactos. Al que no esté, invitalo y sumalo cuando entre.
            </Text>
          </View>
        </View>

        {/* Montado solo mientras está abierta: así cada vez que se abre lee los
            contactos de nuevo, y no muestra la lista de antes de sumar. */}
        {visible ? (
          <ContactPicker
            credential={credential}
            selected={[]}
            multiple={false}
            excluidos={yaEstan}
            vacio="Todos tus contactos de Lilachat ya están en este grupo."
            invitacion={{ miNombre: credential.name ?? null, enlaceApp: '' }}
            onToggle={(contacto) => onElegir(contacto.id)}
          />
        ) : null}
      </View>
    </Modal>
  );
}
