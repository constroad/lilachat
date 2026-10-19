import { memo, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Camera, Paperclip, Plus, Send, X } from 'lucide-react-native';
import { duracionDeVoz } from '@lilachat/shared';
import { useColores } from '../ui/tema';
import { precalentarPermisoDeVoz, useGrabadorDeVoz, type NotaGrabada } from './useGrabadorDeVoz';
import { guardarBorrador, leerBorrador } from './borradores';
import { BotonDeVoz } from './BotonDeVoz';
import { formaDelTexto, type FormaDelTexto } from './campoDeTexto';
import type { DecisionDeVoz, mientrasSostiene } from './gestoDeVoz';

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
  /**
   * El campo NO es controlado (FL12, §49 #15): con `value` cada tecla iba y
   * volvía entre JS y el nativo y redibujaba la barra, y con el hilo JS ocupado
   * se veían letras que tardaban. El texto vive en un ref; el estado solo
   * guarda su FORMA, que cambia al cruzar vacío ↔ con texto.
   */
  const inputRef = useRef<TextInput>(null);
  const textoRef = useRef('');
  const [forma, setForma] = useState<FormaDelTexto>(() => formaDelTexto(''));
  /** Poner un texto desde afuera (borrador, edición, devolverlo) remonta el campo con ese valor. */
  const [inicial, setInicial] = useState({ texto: '', version: 0 });
  const reflejar = (texto: string) => {
    textoRef.current = texto;
    const nueva = formaDelTexto(texto);
    setForma((antes) => (antes.vacio === nueva.vacio && antes.conTexto === nueva.conTexto ? antes : nueva));
  };
  const ponerTexto = (texto: string) => {
    reflejar(texto);
    setInicial((antes) => ({ texto, version: antes.version + 1 }));
  };
  // `clear()` y no remontar: enviar no puede cerrar el teclado.
  const limpiarCampo = () => {
    inputRef.current?.clear();
    reflejar('');
  };
  const voz = useGrabadorDeVoz();
  // Sin diálogo: si el micrófono ya está permitido, la primera nota no espera.
  useEffect(() => precalentarPermisoDeVoz(), []);

  useImperativeHandle(props.ref, () => ({ limpiar: limpiarCampo }), []);

  // Al empezar a editar, el texto del mensaje va al campo; al terminar o
  // cancelar vuelve el borrador del chat, como WhatsApp. Lo mismo al abrir.
  const editandoSeq = props.editando?.seq ?? null;
  const textoAEditar = props.editando?.texto ?? '';
  const { chatId } = props;
  const restaurado = useRef(false);
  useEffect(() => {
    if (editandoSeq !== null) {
      restaurado.current = false;
      return ponerTexto(textoAEditar);
    }
    let vigente = true;
    void leerBorrador(chatId).then((guardado) => {
      if (!vigente) return;
      ponerTexto(guardado);
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
  const guardable = useRef(false);
  guardable.current = restaurado.current && !editandoAhora;
  const esperaDelBorrador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const programarBorrador = () => {
    if (esperaDelBorrador.current) clearTimeout(esperaDelBorrador.current);
    if (!guardable.current) return;
    esperaDelBorrador.current = setTimeout(() => guardarBorrador(chatId, textoRef.current), ESPERA_PARA_GUARDAR_MS);
  };
  useEffect(
    () => () => {
      if (esperaDelBorrador.current) clearTimeout(esperaDelBorrador.current);
      if (guardable.current) guardarBorrador(chatId, textoRef.current);
    },
    [chatId],
  );

  const mandarVoz = async (cancelar = false) => {
    const nota = await voz.terminar({ cancelar });
    if (nota) await props.onNotaDeVoz(nota);
  };

  // El micrófono sostenido (FL9, `gestoDeVoz`): mientras el dedo está apoyado,
  // la barra avisa qué pasaría al soltar; al soltar se manda, se cancela o
  // queda grabando sin el dedo («bloqueada»), que es lo que hacía el toque.
  const [sosteniendo, setSosteniendo] = useState<ReturnType<typeof mientrasSostiene> | null>(null);
  const inicioDeVoz = useRef<Promise<void> | null>(null);
  const modoVoz = sosteniendo !== null ? 'sosteniendo' : voz.estado.fase === 'grabando' ? 'bloqueada' : 'normal';
  const alEmpezarVoz = () => {
    setSosteniendo('normal');
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    inicioDeVoz.current = voz.empezar();
  };
  const alSoltarVoz = async (decision: DecisionDeVoz) => {
    setSosteniendo(null);
    await inicioDeVoz.current;
    if (decision === 'cancelar') await mandarVoz(true);
    else if (decision === 'enviar') await mandarVoz();
  };

  const soloTexto = props.modoSecreto === 'solo-texto';

  const enviar = () => {
    const texto = textoRef.current;
    limpiarCampo();
    programarBorrador();
    if (props.editando) {
      const { seq } = props.editando;
      void props.onEditar(seq, texto).then((ok) => {
        if (!ok) ponerTexto(texto);
      });
      return;
    }
    void props.onEnviar(texto, props.respondiendoA?.seq).then((ok) => {
      // Si no salió, el texto vuelve al campo: perderlo sería peor que el aviso.
      if (!ok) ponerTexto(texto);
    });
  };

  // La píldora de escribir: clip y cámara DENTRO, como el diseño y WhatsApp.
  // El emoji que había acá no hacía nada: el teclado ya trae los suyos. Con
  // texto escrito se esconden y el campo gana ancho.
  const campoDeTexto = (
    <View className="min-w-0 flex-1 flex-row items-end rounded-3xl border border-outline/15 bg-background pr-1">
      <TextInput
        key={inicial.version}
        ref={inputRef}
        defaultValue={inicial.texto}
        // Al entrar a editar el campo se remonta con el texto: que siga con el foco.
        autoFocus={editandoAhora}
        testID="input-mensaje"
        // 46 + el borde = 48: la misma altura que el micrófono (FL13). Con 44
        // el multilínea de Android crecía y quedaban desalineados.
        className="max-h-28 min-h-[46px] min-w-0 flex-1 px-4 py-3 text-base text-on-surface"
        placeholder="Escribe un mensaje"
        placeholderTextColor={colores.outline}
        multiline
        onChangeText={(texto) => {
          reflejar(texto);
          programarBorrador();
          // «Escribiendo» solo al agregar texto: vaciar el campo no lo es.
          if (texto.length > 0) props.onEscribiendo();
        }}
      />
      {forma.vacio && !soloTexto ? (
        <>
          <Pressable
            testID="btn-clip"
            accessibilityLabel="Adjuntar"
            onPress={props.onAdjuntar}
            disabled={props.subiendo}
            android_ripple={{ color: colores.outline, borderless: true, radius: 20 }}
            className="h-11 w-11 items-center justify-center"
          >
            <Paperclip size={20} color={colores.outline} />
          </Pressable>
          <Pressable
            testID="btn-camara"
            accessibilityLabel="Tomar una foto"
            onPress={props.onCamara}
            disabled={props.subiendo}
            android_ripple={{ color: colores.outline, borderless: true, radius: 20 }}
            className="h-11 w-11 items-center justify-center"
          >
            <Camera size={20} color={colores.outline} />
          </Pressable>
        </>
      ) : null}
    </View>
  );

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
              {props.respondiendoA.mio ? 'Respondiendo a tu mensaje' : 'Respondiendo'}
            </Text>
            <Text className="text-[12px] text-on-surface-variant" numberOfLines={1}>
              {props.respondiendoA.texto || 'Mensaje'}
            </Text>
          </View>
          <Pressable
            testID="btn-cancelar-respuesta"
            accessibilityLabel="Cancelar la respuesta"
            onPress={props.onCancelarRespuesta}
            className="h-11 w-11 items-center justify-center"
          >
            <X size={18} color={colores['on-surface-variant']} />
          </Pressable>
        </View>
      ) : null}

      <View className="flex-row items-end gap-1.5 border-t border-outline/10 bg-surface px-2 pt-2" style={{ paddingBottom: props.margenPie }}>
        {props.modoSecreto === 'bloqueado' ? (
          <View testID="composer-bloqueado" className="min-h-[48px] flex-1 items-center justify-center rounded-3xl bg-background px-4">
            <Text className="text-center text-[13px] text-on-surface-variant">Esperando la clave del chat secreto…</Text>
          </View>
        ) : (
          <>
            {modoVoz === 'bloqueada' ? (
              // Grabando sin el dedo: la barra ES la grabación —cancelar, el
              // tiempo y mandar—. Un campo al lado invita a escribir mientras se habla.
              <>
                <Pressable
                  testID="btn-cancelar-voz"
                  accessibilityLabel="Cancelar la nota de voz"
                  onPress={() => void mandarVoz(true)}
                  className="h-12 w-12 items-center justify-center"
                >
                  <X size={22} color={colores.error} />
                </Pressable>
                <View className="min-h-[48px] min-w-0 flex-1 flex-row items-center gap-2 rounded-3xl border border-outline/15 bg-background px-4">
                  <View className="h-2.5 w-2.5 rounded-full bg-error" />
                  <Text testID="tiempo-voz" className="text-base font-semibold text-on-surface">
                    {duracionDeVoz(voz.estado.fase === 'grabando' ? voz.estado.ms : 0)}
                  </Text>
                  <Text className="text-[12px] text-on-surface-variant">Grabando…</Text>
                </View>
              </>
            ) : modoVoz === 'sosteniendo' ? (
              <View
                testID="barra-sosteniendo-voz"
                className="min-h-[48px] min-w-0 flex-1 flex-row items-center gap-2 rounded-3xl border border-outline/15 bg-background px-4"
              >
                <View className="h-2.5 w-2.5 rounded-full bg-error" />
                <Text testID="tiempo-voz" className="text-base font-semibold text-on-surface">
                  {duracionDeVoz(voz.estado.fase === 'grabando' ? voz.estado.ms : 0)}
                </Text>
                <Text
                  testID="aviso-deslizar-voz"
                  className={`min-w-0 flex-1 text-right text-[12px] ${sosteniendo === 'cancelaria' ? 'font-semibold text-error' : 'text-on-surface-variant'}`}
                  numberOfLines={1}
                >
                  {sosteniendo === 'cancelaria'
                    ? 'Suelta para cancelar'
                    : sosteniendo === 'bloquearia'
                      ? 'Suelta para seguir sin el dedo'
                      : '‹ Desliza para cancelar · ↑ sin el dedo'}
                </Text>
              </View>
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
                    className={`h-12 w-10 items-center justify-center ${props.subiendo ? 'opacity-40' : ''}`}
                  >
                    <Plus size={24} color={colores['on-surface-variant']} />
                  </Pressable>
                )}
                {campoDeTexto}
              </>
            )}
            {/* A la derecha, UN botón. El micrófono queda en el mismo lugar del
                árbol mientras se sostiene: si se reemplazara, el gesto se cortaría. */}
            {modoVoz === 'bloqueada' ? (
              <Pressable
                testID="btn-enviar-voz"
                accessibilityLabel="Enviar la nota de voz"
                onPress={() => void mandarVoz()}
                className="h-12 w-12 items-center justify-center rounded-full bg-primary"
              >
                <Send size={20} color={colores['on-primary']} />
              </Pressable>
            ) : modoVoz === 'normal' && (forma.conTexto || soloTexto) ? (
              <Pressable
                testID="btn-enviar"
                accessibilityLabel="Enviar"
                disabled={!forma.conTexto}
                onLongPress={soloTexto ? undefined : () => props.onProgramar(textoRef.current.trim())}
                onPress={enviar}
                className={`h-12 w-12 items-center justify-center rounded-full bg-primary ${forma.conTexto ? '' : 'opacity-40'}`}
              >
                <Send size={20} color={colores['on-primary']} />
              </Pressable>
            ) : (
              <BotonDeVoz
                deshabilitado={props.subiendo}
                onEmpezar={alEmpezarVoz}
                onMover={setSosteniendo}
                onSoltar={(decision) => void alSoltarVoz(decision)}
              />
            )}
          </>
        )}
      </View>

      {voz.estado.fase === 'sin-permiso' || voz.estado.fase === 'error' ? (
        <Pressable onPress={voz.limpiarAviso} className="px-4 pb-2">
          <Text testID="aviso-voz" className="text-sm text-error">
            {voz.estado.fase === 'sin-permiso' ? 'Permite el micrófono para mandar notas de voz.' : voz.estado.motivo}
          </Text>
        </Pressable>
      ) : null}
    </>
  );
});
