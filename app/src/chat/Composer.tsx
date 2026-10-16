import { memo, useImperativeHandle, useState, type Ref } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Mic, Plus, Send, Smile, X } from 'lucide-react-native';
import { duracionDeVoz } from '@lilachat/shared';
import { useColores } from '../ui/tema';
import { useGrabadorDeVoz, type NotaGrabada } from './useGrabadorDeVoz';

export type Respondiendo = { seq: number; texto: string; mio: boolean };

/** Lo que la pantalla le puede pedir al composer sin conocer su borrador. */
export type ComposerHandle = { limpiar: () => void };

/**
 * La barra de escribir, APARTE de la pantalla (FL2, spec §45).
 *
 * El borrador vivía en `ChatScreen`: cada tecla re-renderizaba la pantalla
 * entera —la lista con todas sus burbujas incluida—, que es lo que se sentía
 * como un teclado que se arrastra. Acá el borrador y el contador de la nota de
 * voz son estado propio: tipear solo dibuja esta barra.
 *
 * La composición es la del diseño, y no «los mismos íconos en una fila»: el
 * «+» plano, UNA píldora con el emoji adentro, y a la derecha UN botón que es
 * micrófono con el campo vacío y enviar apenas hay texto.
 */
export const Composer = memo(function Composer(props: {
  ref?: Ref<ComposerHandle>;
  respondiendoA: Respondiendo | null;
  onCancelarRespuesta: () => void;
  subiendo: boolean;
  margenPie: number;
  onAdjuntar: () => void;
  onEscribiendo: () => void;
  /** Manda el texto; `false` si no salió (p. ej. no se pudo cifrar). */
  onEnviar: (texto: string, respondeA?: number) => Promise<boolean>;
  /** Long-press en enviar: programarlo para más tarde (F11). */
  onProgramar: (texto: string) => void;
  onNotaDeVoz: (nota: NotaGrabada) => Promise<void>;
}) {
  const colores = useColores();
  const [borrador, setBorrador] = useState('');
  const voz = useGrabadorDeVoz();

  useImperativeHandle(props.ref, () => ({ limpiar: () => setBorrador('') }), []);

  const mandarVoz = async (cancelar = false) => {
    const nota = await voz.terminar({ cancelar });
    if (nota) await props.onNotaDeVoz(nota);
  };

  const enviar = () => {
    const texto = borrador;
    setBorrador('');
    void props.onEnviar(texto, props.respondiendoA?.seq).then((ok) => {
      // Si no salió, el texto vuelve al campo: perderlo sería peor que el aviso.
      if (!ok) setBorrador(texto);
    });
  };

  return (
    <>
      {props.respondiendoA ? (
        <View testID="barra-respuesta" className="flex-row items-center gap-2 border-t border-outline/10 bg-surface px-3 pt-2">
          <View className="w-1 self-stretch rounded-full bg-primary" />
          <View className="min-w-0 flex-1 py-1">
            <Text className="text-[11px] font-semibold text-primary">
              {props.respondiendoA.mio ? 'Respondiendo a vos' : 'Respondiendo'}
            </Text>
            <Text className="text-[12px] text-on-surface-variant" numberOfLines={1}>
              {props.respondiendoA.texto || 'Mensaje'}
            </Text>
          </View>
          <Pressable
            testID="btn-cancelar-respuesta"
            accessibilityLabel="Cancelar la respuesta"
            onPress={props.onCancelarRespuesta}
            className="h-9 w-9 items-center justify-center"
          >
            <X size={18} color={colores['on-surface-variant']} />
          </Pressable>
        </View>
      ) : null}

      <View className="flex-row items-end gap-1.5 border-t border-outline/10 bg-surface px-3 pt-3" style={{ paddingBottom: props.margenPie }}>
        {voz.estado.fase === 'grabando' ? (
          // Mientras se graba, la barra ES la grabación: cancelar, el tiempo y
          // mandar. Un campo al lado invita a escribir mientras se habla.
          <>
            <Pressable
              testID="btn-cancelar-voz"
              accessibilityLabel="Cancelar la nota de voz"
              onPress={() => void mandarVoz(true)}
              className="h-11 w-11 items-center justify-center"
            >
              <X size={22} color={colores.error} />
            </Pressable>
            <View className="min-w-0 flex-1 flex-row items-center gap-2 rounded-xl border border-outline/15 bg-background px-4 py-2.5">
              <View className="h-2.5 w-2.5 rounded-full bg-error" />
              <Text testID="tiempo-voz" className="text-base font-semibold text-on-surface">
                {duracionDeVoz(voz.estado.ms)}
              </Text>
              <Text className="text-[12px] text-on-surface-variant">Grabando…</Text>
            </View>
            <Pressable
              testID="btn-enviar-voz"
              accessibilityLabel="Enviar la nota de voz"
              onPress={() => void mandarVoz()}
              className="h-11 w-11 items-center justify-center rounded-full bg-primary"
            >
              <Send size={18} color={colores['on-primary']} />
            </Pressable>
          </>
        ) : (
          <>
            {/* El «+» sigue siendo un «+» mientras sube: el progreso ya se ve
                en la burbuja. Queda atenuado porque no se suben dos a la vez. */}
            <Pressable
              testID="btn-adjuntar"
              onPress={props.onAdjuntar}
              disabled={props.subiendo}
              className={`h-11 w-11 items-center justify-center ${props.subiendo ? 'opacity-40' : ''}`}
            >
              <Plus size={24} color={colores['on-surface-variant']} />
            </Pressable>

            <View className="min-w-0 flex-1 flex-row items-end rounded-xl border border-outline/15 bg-background pr-1">
              <TextInput
                testID="input-mensaje"
                className="max-h-28 min-h-[44px] min-w-0 flex-1 px-4 py-2.5 text-base text-on-surface"
                placeholder="Escribe un mensaje"
                placeholderTextColor={colores.outline}
                multiline
                value={borrador}
                onChangeText={(texto) => {
                  setBorrador(texto);
                  // «Escribiendo» solo al agregar texto: vaciar el campo no lo es.
                  if (texto.length > 0) props.onEscribiendo();
                }}
              />
              <Pressable testID="btn-emoji" className="h-11 w-9 items-center justify-center">
                <Smile size={20} color={colores.outline} />
              </Pressable>
            </View>

            {borrador.trim() ? (
              <Pressable
                testID="btn-enviar"
                onLongPress={() => props.onProgramar(borrador.trim())}
                onPress={enviar}
                className="h-11 w-11 items-center justify-center rounded-full bg-primary"
              >
                <Send size={18} color={colores['on-primary']} />
              </Pressable>
            ) : (
              <Pressable
                testID="btn-voz"
                accessibilityLabel="Grabar una nota de voz"
                disabled={props.subiendo}
                onPress={() => void voz.empezar()}
                className={`h-11 w-11 items-center justify-center rounded-full bg-primary ${props.subiendo ? 'opacity-40' : ''}`}
              >
                <Mic size={18} color={colores['on-primary']} />
              </Pressable>
            )}
          </>
        )}
      </View>

      {voz.estado.fase === 'sin-permiso' || voz.estado.fase === 'error' ? (
        <Pressable onPress={voz.limpiarAviso} className="px-4 pb-2">
          <Text testID="aviso-voz" className="text-sm text-error">
            {voz.estado.fase === 'sin-permiso' ? 'Permití el micrófono para mandar notas de voz.' : voz.estado.motivo}
          </Text>
        </Pressable>
      ) : null}
    </>
  );
});
