import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { MAX_NOMBRE_DE_GRUPO, normalizarNombreDeGrupo } from '@lilachat/shared';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';

/**
 * Cambiar el nombre del grupo.
 *
 * Es un modal propio y no un `Alert.prompt` porque **ese prompt no existe en
 * Android**: solo iOS lo tiene. Y con modal se puede mostrar el contador de
 * caracteres, que es el mismo de la pantalla de crear el grupo.
 *
 * El valor arranca con el nombre actual, no vacío: casi siempre se corrige una
 * palabra, y hacer reescribir todo es el tipo de detalle que hace abandonar la
 * pantalla.
 */
export function EditarNombreDeGrupo({
  visible,
  nombreActual,
  guardando,
  onGuardar,
  onCerrar,
}: {
  visible: boolean;
  nombreActual: string;
  guardando: boolean;
  onGuardar: (nombre: string) => void;
  onCerrar: () => void;
}) {
  const colores = useColores();
  const margenes = useMargenes();
  const [texto, setTexto] = useState(nombreActual);
  const [error, setError] = useState('');

  /**
   * El modal vive montado detrás de la pantalla: su estado nace ANTES de que
   * el nombre exista. Sin esto el campo abre vacío la primera vez y con lo
   * escrito la vez anterior las siguientes.
   */
  useEffect(() => {
    if (visible) {
      setTexto(nombreActual);
      setError('');
    }
  }, [visible, nombreActual]);

  const guardar = () => {
    // La MISMA función que valida el server: si acá pasara algo que allá se
    // rechaza, el error llegaría como un «no se pudo» sin explicación.
    const validado = normalizarNombreDeGrupo(texto);
    if (!validado.ok) return setError(validado.motivo);
    if (validado.nombre === nombreActual) return onCerrar();
    onGuardar(validado.nombre);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
      <Pressable className="flex-1 bg-black/40" onPress={onCerrar} accessibilityLabel="Cancelar" />
      <View
        testID="editar-nombre-grupo"
        className="rounded-t-xl bg-surface px-5 pt-4"
        style={{ paddingBottom: margenes.pie + 8 }}
      >
        <Text className="mb-3 text-base font-bold text-on-surface">Nombre del grupo</Text>
        <View className="flex-row items-center gap-2 rounded-xl bg-primary/[0.07] px-4">
          <TextInput
            testID="input-nombre-grupo-editar"
            value={texto}
            onChangeText={(valor) => {
              setTexto(valor.slice(0, MAX_NOMBRE_DE_GRUPO));
              setError('');
            }}
            placeholder="Cómo se llama el grupo"
            placeholderTextColor={colores['on-surface-variant']}
            autoFocus
            className="min-h-[52px] min-w-0 flex-1 text-base text-on-surface"
          />
          <Text className="text-[11px] text-on-surface-variant">
            {[...texto].length}/{MAX_NOMBRE_DE_GRUPO}
          </Text>
        </View>

        {error ? (
          <Text testID="error-nombre-grupo" className="mt-2 text-[12px] text-error">
            {error}
          </Text>
        ) : null}

        <View className="mt-4 flex-row gap-3">
          <Pressable
            testID="btn-cancelar-nombre"
            onPress={onCerrar}
            className="min-h-[48px] flex-1 items-center justify-center rounded-xl bg-primary/[0.07]"
          >
            <Text className="text-sm font-semibold text-on-surface">Cancelar</Text>
          </Pressable>
          <Pressable
            testID="btn-guardar-nombre"
            disabled={guardando}
            onPress={guardar}
            className={`min-h-[48px] flex-1 items-center justify-center rounded-xl bg-primary ${guardando ? 'opacity-50' : ''}`}
          >
            <Text className="text-sm font-bold text-on-primary">
              {guardando ? 'Guardando…' : 'Guardar'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
