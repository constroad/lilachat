import { Pressable, Text, View } from 'react-native';
import { Archive, ArchiveRestore, Bell, BellOff, CheckCheck, LogOut, MessageSquareDot, Pin, PinOff, X } from 'lucide-react-native';
import type { AccionesDeSeleccion } from '@lilachat/shared';
import { useColores } from '../ui/tema';

/**
 * La barra de la selección múltiple de chats: reemplaza al buscador mientras
 * hay algo marcado, como el app bar de WhatsApp (salió de `ChatListScreen`).
 * Las acciones vienen del motor `accionesDeSeleccion`: una sola por lote.
 */
export function BarraDeSeleccionDeChats(props: {
  cantidad: number;
  acciones: AccionesDeSeleccion;
  onCancelar: () => void;
  onLectura: (lectura: 'leido' | 'no-leido') => void;
  onFijar: (fijar: boolean) => void;
  onSilenciar: (silenciar: boolean) => void;
  onArchivar: (archivar: boolean) => void;
  onSalir: () => void;
}) {
  const colores = useColores();
  const { acciones } = props;
  const icono = colores['on-surface'];
  return (
    <View testID="barra-seleccion" className="flex-row items-center gap-1 px-2 pb-2 pt-1">
      <Accion testID="cancelar-seleccion" etiqueta="Cancelar la selección" onPress={props.onCancelar}>
        <X size={22} color={icono} />
      </Accion>
      <Text className="min-w-0 flex-1 text-lg font-semibold text-on-surface" testID="conteo-seleccion">
        {props.cantidad}
      </Text>
      {acciones.lectura ? (
        <Accion
          testID={acciones.lectura === 'leido' ? 'accion-marcar-leido' : 'accion-marcar-no-leido'}
          etiqueta={acciones.lectura === 'leido' ? 'Marcar como leído' : 'Marcar como no leído'}
          onPress={() => acciones.lectura && props.onLectura(acciones.lectura)}
        >
          {acciones.lectura === 'leido' ? <CheckCheck size={22} color={icono} /> : <MessageSquareDot size={22} color={icono} />}
        </Accion>
      ) : null}
      {acciones.fijar ? (
        <Accion
          testID="accion-fijar"
          etiqueta={acciones.fijar === 'fijar' ? 'Fijar' : 'Desfijar'}
          onPress={() => props.onFijar(acciones.fijar === 'fijar')}
        >
          {acciones.fijar === 'fijar' ? <Pin size={22} color={icono} /> : <PinOff size={22} color={icono} />}
        </Accion>
      ) : null}
      {acciones.silenciar ? (
        <Accion
          testID="accion-silenciar"
          etiqueta={acciones.silenciar === 'silenciar' ? 'Silenciar' : 'Reactivar'}
          onPress={() => props.onSilenciar(acciones.silenciar === 'silenciar')}
        >
          {acciones.silenciar === 'silenciar' ? <BellOff size={22} color={icono} /> : <Bell size={22} color={icono} />}
        </Accion>
      ) : null}
      {acciones.archivar ? (
        <Accion
          testID="accion-archivar"
          etiqueta={acciones.archivar === 'archivar' ? 'Archivar' : 'Desarchivar'}
          onPress={() => props.onArchivar(acciones.archivar === 'archivar')}
        >
          {acciones.archivar === 'archivar' ? <Archive size={22} color={icono} /> : <ArchiveRestore size={22} color={icono} />}
        </Accion>
      ) : null}
      {acciones.salir ? (
        <Accion testID="accion-salir" etiqueta="Salir del grupo" onPress={props.onSalir}>
          <LogOut size={22} color={colores.error} />
        </Accion>
      ) : null}
    </View>
  );
}

function Accion(props: { testID: string; etiqueta: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable
      testID={props.testID}
      accessibilityLabel={props.etiqueta}
      onPress={props.onPress}
      className="h-11 w-11 items-center justify-center"
    >
      {props.children}
    </Pressable>
  );
}
