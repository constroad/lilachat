import { memo, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Camera, Mic, Paperclip, Plus, Send, X } from 'lucide-react-native';
import { duracionDeVoz } from '@lilachat/shared';
import { useColores } from '../ui/tema';
import { useGrabadorDeVoz, type NotaGrabada } from './useGrabadorDeVoz';
import { guardarBorrador, leerBorrador } from './borradores';

/** Cuánto se espera tras la última tecla para guardar el borrador. */
const ESPERA_PARA_GUARDAR_MS = 500;

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
  /** De qué chat es el borrador que se guarda y se restaura (FL9). */
  chatId: string;
  respondiendoA: Respondiendo | null;
  onCancelarRespuesta: () => void;
  /** Editando un mensaje propio (José, 17/10/2026): el campo trae su texto. */
  editando: { seq: number; texto: string } | null;
  onCancelarEdicion: () => void;
  /** Guarda la edición; `false` si el server no la aceptó (el texto vuelve). */
  onEditar: (seq: number, texto: string) => Promise<boolean>;
  subiendo: boolean;
  margenPie: number;
  onAdjuntar: () => void;
  /** La cámara, directo desde la píldora (diseño «Conversación 1:1»). */
  onCamara: () => void;
  onEscribiendo: () => void;
  /** Manda el texto; `false` si no salió (p. ej. no se pudo cifrar). */
  onEnviar: (texto: string, respondeA?: number) => Promise<boolean>;
  /** Long-press en enviar: programarlo para más tarde (F11). */
  onProgramar: (texto: string) => void;
  onNotaDeVoz: (nota: NotaGrabada) => Promise<void>;
  /**
   * Chat secreto (auditoría 17/10/2026). `bloqueado`: la clave todavía no está
   * y NADA se puede mandar — antes salía en claro. `solo-texto`: hay clave,
   * pero fotos, voz y programados no viajan cifrados, así que no se ofrecen.
   */
  modoSecreto?: 'bloqueado' | 'solo-texto';
}) {
  const colores = useColores();
  const [borrador, setBorrador] = useState('');
  const voz = useGrabadorDeVoz();

  useImperativeHandle(props.ref, () => ({ limpiar: () => setBorrador('') }), []);

  // Al empezar a editar, el texto del mensaje va al campo; al terminar o
  // cancelar vuelve el borrador del chat, como WhatsApp. Lo mismo al abrir.
  const editandoSeq = props.editando?.seq ?? null;
  const textoAEditar = props.editando?.texto ?? '';
  const { chatId } = props;
  const restaurado = useRef(false);
  useEffect(() => {
    if (editandoSeq !== null) {
      restaurado.current = false;
      return setBorrador(textoAEditar);
    }
    let vigente = true;
    void leerBorrador(chatId).then((guardado) => {
      if (!vigente) return;
      setBorrador(guardado);
      restaurado.current = true;
    });
    return () => {
      vigente = false;
    };
  }, [editandoSeq, textoAEditar, chatId]);

  // El borrador se guarda al dejar de tipear, y al salir del chat sin esperar.
  // Nunca antes de restaurarlo (pisaría el guardado con el campo vacío) ni lo
  // que se está editando, que es otro mensaje.
  const editandoAhora = editandoSeq !== null;
  const pendiente = useRef({ texto: '', guardable: false });
  pendiente.current = { texto: borrador, guardable: restaurado.current && !editandoAhora };
  useEffect(() => {
    if (!pendiente.current.guardable) return;
    const espera = setTimeout(() => guardarBorrador(chatId, borrador), ESPERA_PARA_GUARDAR_MS);
    return () => clearTimeout(espera);
  }, [borrador, editandoAhora, chatId]);
  useEffect(
    () => () => {
      if (pendiente.current.guardable) guardarBorrador(chatId, pendiente.current.texto);
    },
    [chatId],
  );

  const mandarVoz = async (cancelar = false) => {
    const nota = await voz.terminar({ cancelar });
    if (nota) await props.onNotaDeVoz(nota);
  };

  const soloTexto = props.modoSecreto === 'solo-texto';

  const enviar = () => {
    const texto = borrador;
    setBorrador('');
    if (props.editando) {
      const { seq } = props.editando;
      void props.onEditar(seq, texto).then((ok) => {
        if (!ok) setBorrador(texto);
      });
      return;
    }
    void props.onEnviar(texto, props.respondiendoA?.seq).then((ok) => {
      // Si no salió, el texto vuelve al campo: perderlo sería peor que el aviso.
      if (!ok) setBorrador(texto);
    });
  };

  return (
    <>
      {props.editando ? (
        <View testID="barra-edicion" className="flex-row items-center gap-2 border-t border-outline/10 bg-surface px-3 pt-2">
          <View className="w-1 self-stretch rounded-full bg-primary" />
          <View className="min-w-0 flex-1 py-1">
            <Text className="text-[11px] font-semibold text-primary">Editando mensaje</Text>
            <Text className="text-[12px] text-on-surface-variant" numberOfLines={1}>
              {props.editando.texto}
            </Text>
          </View>
          <Pressable
            testID="btn-cancelar-edicion"
            accessibilityLabel="Cancelar la edición"
            onPress={props.onCancelarEdicion}
            className="h-11 w-11 items-center justify-center"
          >
            <X size={18} color={colores['on-surface-variant']} />
          </Pressable>
        </View>
      ) : null}
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
        {props.modoSecreto === 'bloqueado' ? (
          <View testID="composer-bloqueado" className="min-h-[44px] flex-1 items-center justify-center rounded-xl bg-background px-4">
            <Text className="text-center text-[13px] text-on-surface-variant">Esperando la clave del chat secreto…</Text>
          </View>
        ) : voz.estado.fase === 'grabando' ? (
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
            {soloTexto ? null : (
              <Pressable
                testID="btn-adjuntar"
                accessibilityLabel="Adjuntar"
                onPress={props.onAdjuntar}
                disabled={props.subiendo}
                className={`h-11 w-11 items-center justify-center ${props.subiendo ? 'opacity-40' : ''}`}
              >
                <Plus size={24} color={colores['on-surface-variant']} />
              </Pressable>
            )}

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
              {/* Clip y cámara DENTRO de la píldora, como el diseño y WhatsApp.
                  El emoji que había acá no hacía nada: el teclado ya trae los
                  suyos. Con texto escrito se esconden y el campo gana ancho. */}
              {borrador.length === 0 && !soloTexto ? (
                <>
                  <Pressable
                    testID="btn-clip"
                    accessibilityLabel="Adjuntar"
                    onPress={props.onAdjuntar}
                    disabled={props.subiendo}
                    android_ripple={{ color: colores.outline, borderless: true, radius: 20 }}
                    className="h-11 w-9 items-center justify-center"
                  >
                    <Paperclip size={20} color={colores.outline} />
                  </Pressable>
                  <Pressable
                    testID="btn-camara"
                    accessibilityLabel="Tomar una foto"
                    onPress={props.onCamara}
                    disabled={props.subiendo}
                    android_ripple={{ color: colores.outline, borderless: true, radius: 20 }}
                    className="h-11 w-9 items-center justify-center"
                  >
                    <Camera size={20} color={colores.outline} />
                  </Pressable>
                </>
              ) : null}
            </View>

            {borrador.trim() || soloTexto ? (
              <Pressable
                testID="btn-enviar"
                accessibilityLabel="Enviar"
                disabled={!borrador.trim()}
                onLongPress={soloTexto ? undefined : () => props.onProgramar(borrador.trim())}
                onPress={enviar}
                className={`h-11 w-11 items-center justify-center rounded-full bg-primary ${borrador.trim() ? '' : 'opacity-40'}`}
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
