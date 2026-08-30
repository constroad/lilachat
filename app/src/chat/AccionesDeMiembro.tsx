import { Modal, Pressable, Text, View } from 'react-native';
import { ShieldCheck, ShieldOff, UserMinus } from 'lucide-react-native';
import type { AccionDeMiembro } from '@lilachat/shared';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';

/**
 * Qué hacer con un participante del grupo.
 *
 * Vive en una hoja y no en iconos dentro de la fila: los iconos no escalan —con
 * dos ya competían con el nombre y con el sello de admin— y sobre todo **no
 * dicen qué hacen**. «Nombrar admin» y «Sacar del grupo» no se adivinan de un
 * escudo y una silueta, y son acciones que le pasan algo a otra persona.
 *
 * La lista de acciones NO se decide acá: la arma `accionesDeMiembro`, que
 * pregunta a las mismas reglas que después aplica el server. Una fila sin
 * acciones ni siquiera abre la hoja.
 */
const TEXTOS: Record<AccionDeMiembro, { etiqueta: string; detalle: string }> = {
  'hacer-admin': {
    etiqueta: 'Nombrar admin',
    detalle: 'Va a poder sumar y sacar gente',
  },
  'dejar-admin': {
    etiqueta: 'Dejar de ser admin',
    detalle: 'Seguís en el grupo, sin administrarlo',
  },
  sacar: {
    etiqueta: 'Sacar del grupo',
    detalle: 'Deja de ver el grupo y los mensajes nuevos',
  },
};

export function AccionesDeMiembro({
  visible,
  nombre,
  acciones,
  onElegir,
  onCerrar,
}: {
  visible: boolean;
  nombre: string;
  acciones: AccionDeMiembro[];
  onElegir: (accion: AccionDeMiembro) => void;
  onCerrar: () => void;
}) {
  const colores = useColores();
  const margenes = useMargenes();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar}>
      <Pressable className="flex-1 bg-black/40" onPress={onCerrar} accessibilityLabel="Cerrar" />
      <View
        testID="acciones-miembro"
        className="rounded-t-xl bg-surface px-5 pt-3"
        style={{ paddingBottom: margenes.pie }}
      >
        <View className="mb-3 h-1.5 w-11 self-center rounded-full bg-outline/30" />
        {/* De quién se está hablando. Sin el nombre, una hoja que dice «Sacar
            del grupo» no aclara a quién, y en una lista de participantes eso es
            justo lo que hay que saber antes de tocar. */}
        <Text className="mb-2 text-base font-bold text-on-surface" numberOfLines={1}>
          {nombre}
        </Text>
        {acciones.map((accion) => {
          const esDestructiva = accion === 'sacar';
          const Icono =
            accion === 'hacer-admin' ? ShieldCheck : accion === 'dejar-admin' ? ShieldOff : UserMinus;
          return (
            <Pressable
              key={accion}
              testID={`accion-${accion}`}
              onPress={() => {
                onCerrar();
                onElegir(accion);
              }}
              className="min-h-[56px] flex-row items-center gap-4"
            >
              <View
                className={`h-11 w-11 items-center justify-center rounded-full ${
                  esDestructiva ? 'bg-error/10' : 'bg-primary/10'
                }`}
              >
                <Icono size={20} color={esDestructiva ? colores.error : colores.primary} />
              </View>
              <View className="min-w-0 flex-1">
                <Text
                  className="text-[15px] font-semibold"
                  style={{ color: esDestructiva ? colores.error : colores['on-surface'] }}
                >
                  {TEXTOS[accion].etiqueta}
                </Text>
                <Text className="text-[12px] text-on-surface-variant">
                  {TEXTOS[accion].detalle}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Modal>
  );
}
