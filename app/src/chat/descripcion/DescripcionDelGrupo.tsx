import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, Pressable, Text, TextInput, View } from 'react-native';
import { Modal } from '../../ui/Modal';
import { Pencil } from 'lucide-react-native';
import { MAX_DESCRIPCION_DE_GRUPO, normalizarDescripcion, partirEnEnlaces } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { useMargenes } from '../../ui/useMargenes';

/** Cuántas líneas se ven antes de «Leer más» (diseño `f1-app-info-fijados`). */
const LINEAS_CERRADA = 6;
/** Igual que el nombre: el foco va tras el fundido del modal (si no, Android no abre el teclado). */
const ESPERA_PARA_ENFOCAR_MS = 350;

/**
 * La descripción del grupo en su info (José, 20/10: «textos grandes como
 * Slack»): párrafos, links tocables, «Leer más» después de seis líneas y el
 * lápiz para quien puede editar. Sin descripción, quien puede ve «Agregar
 * descripción»; quien no, nada.
 */
export function TarjetaDeDescripcion(props: { descripcion?: string; editable: boolean; onEditar: () => void }) {
  const colores = useColores();
  const [abierta, setAbierta] = useState(false);
  const [larga, setLarga] = useState(false);
  if (!props.descripcion && !props.editable) return null;
  return (
    <View testID="tarjeta-descripcion" className="mx-4 mt-4 rounded-xl border border-outline/10 bg-surface px-4 py-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-[12px] font-semibold uppercase tracking-wide text-on-surface-variant">Descripción</Text>
        {props.editable ? (
          <Pressable testID="btn-editar-descripcion" accessibilityLabel="Editar la descripción" onPress={props.onEditar} className="h-9 w-9 items-center justify-center">
            <Pencil size={16} color={colores['on-surface-variant']} />
          </Pressable>
        ) : null}
      </View>
      {props.descripcion ? (
        <>
          <Text
            testID="texto-descripcion"
            numberOfLines={abierta ? undefined : LINEAS_CERRADA}
            onTextLayout={(evento) => !abierta && setLarga(evento.nativeEvent.lines.length >= LINEAS_CERRADA)}
            className="text-[15px] leading-[22px] text-on-surface"
          >
            {partirEnEnlaces(props.descripcion).map((parte, indice) =>
              parte.tipo === 'texto' ? (
                parte.texto
              ) : (
                <Text key={indice} className="text-primary underline" onPress={() => void Linking.openURL(parte.destino)}>
                  {parte.texto}
                </Text>
              )
            )}
          </Text>
          {larga ? (
            <Pressable testID="btn-leer-mas" onPress={() => setAbierta((antes) => !antes)} className="min-h-[36px] justify-center">
              <Text className="text-[14px] font-semibold text-primary">{abierta ? 'Leer menos' : 'Leer más'}</Text>
            </Pressable>
          ) : null}
        </>
      ) : (
        <Pressable testID="btn-agregar-descripcion" onPress={props.onEditar} className="min-h-[40px] justify-center">
          <Text className="text-[15px] text-primary">Agregar descripción</Text>
        </Pressable>
      )}
    </View>
  );
}

/** El editor: un campo largo con el contador, la MISMA validación que el server. */
export function EditarDescripcion(props: { visible: boolean; actual?: string; guardando: boolean; onGuardar: (descripcion: string) => void; onCerrar: () => void }) {
  const colores = useColores();
  const margenes = useMargenes();
  const campoRef = useRef<TextInput>(null);
  const [texto, setTexto] = useState(props.actual ?? '');
  const [error, setError] = useState('');
  useEffect(() => {
    if (props.visible) {
      setTexto(props.actual ?? '');
      setError('');
    }
  }, [props.visible, props.actual]);

  const guardar = () => {
    const validada = normalizarDescripcion(texto);
    if (!validada.ok) return setError(validada.motivo);
    if (validada.descripcion === (props.actual ?? '')) return props.onCerrar();
    props.onGuardar(validada.descripcion);
  };

  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onCerrar} onShow={() => setTimeout(() => campoRef.current?.focus(), ESPERA_PARA_ENFOCAR_MS)}>
      <Pressable className="flex-1 bg-black/40" onPress={props.onCerrar} accessibilityLabel="Cancelar" />
      <KeyboardAvoidingView behavior="padding" style={{ backgroundColor: colores.surface }}>
        <View testID="editar-descripcion" className="rounded-t-xl bg-surface px-5 pt-4" style={{ paddingBottom: margenes.pie + 8 }}>
          <Text className="mb-3 text-base font-bold text-on-surface">Descripción del grupo</Text>
          <TextInput
            testID="input-descripcion"
            ref={campoRef}
            value={texto}
            multiline
            textAlignVertical="top"
            onChangeText={(valor) => {
              setTexto(valor);
              setError('');
            }}
            placeholder="De qué trata el grupo, reglas, horarios, enlaces…"
            placeholderTextColor={colores['on-surface-variant']}
            className="max-h-[260px] min-h-[140px] rounded-xl bg-primary/[0.07] px-4 py-3 text-[15px] leading-[22px] text-on-surface"
          />
          <Text className={`mt-1 self-end text-[11px] ${[...texto].length > MAX_DESCRIPCION_DE_GRUPO ? 'text-error' : 'text-on-surface-variant'}`}>
            {[...texto].length}/{MAX_DESCRIPCION_DE_GRUPO}
          </Text>
          {error ? (
            <Text testID="error-descripcion" className="mt-1 text-[12px] text-error">
              {error}
            </Text>
          ) : null}
          <View className="mt-3 flex-row gap-3">
            <Pressable testID="btn-cancelar-descripcion" onPress={props.onCerrar} className="min-h-[48px] flex-1 items-center justify-center rounded-xl bg-primary/[0.07]">
              <Text className="text-sm font-semibold text-on-surface">Cancelar</Text>
            </Pressable>
            <Pressable testID="btn-guardar-descripcion" disabled={props.guardando} onPress={guardar} className={`min-h-[48px] flex-1 items-center justify-center rounded-xl bg-primary ${props.guardando ? 'opacity-60' : ''}`}>
              <Text className="text-sm font-semibold text-on-primary">{props.guardando ? 'Guardando…' : 'Guardar'}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
