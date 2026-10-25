import { memo, useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react';
import { BackHandler, Keyboard, Pressable, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Camera, Keyboard as Teclado, Paperclip, Send, Smile, X } from 'lucide-react-native';
import { duracionDeVoz, insertarEnTexto, type MencionEnMensaje, type Seleccion } from '@lilachat/shared';
import type { MencionElegida } from '@lilachat/shared';
import { deleteBeforeCursor, formKeyOf } from '@lilachat/shared';
import { useColores } from '../ui/tema';
import { useChatFont } from '../ui/chatFont';
import { precalentarPermisoDeVoz, useGrabadorDeVoz, type NotaGrabada } from './useGrabadorDeVoz';
import { guardarBorrador, leerBorrador } from './borradores';
import { useClipboardImage } from './useClipboardImage';
import { PasteImageChip } from './PasteImageChip';
import type { FotoElegida } from './envioDeFotos';
import { BotonDeVoz } from './BotonDeVoz';
import { formaDelTexto, type FormaDelTexto } from './campoDeTexto';
import type { DecisionDeVoz, mientrasSostiene } from './gestoDeVoz';
import { useMenciones, type MentionableMember } from './useMenciones';
import { SugerenciasDeMencion } from './SugerenciasDeMencion';
import { closeEmojiPanel, openEmojiPanel, useEmojiPanelOpen } from './emojiPanel';
import { VistaPreviaAlEscribir } from './VistaPreviaAlEscribir';
import type { ChatCommands } from './commands/useChatCommands';
import { CommandPanel } from './commands/CommandPanel';
import { EphemeralAnswers } from './commands/EphemeralAnswers';
import { AppFormSheet } from './commands/AppFormSheet';

/** Cuánto se espera tras la última tecla para guardar el borrador. */
const ESPERA_PARA_GUARDAR_MS = 500;
/** «Responder» from the message menu: the field takes the focus once the menu has closed (a closing modal swallows the keyboard on Android). */
const REPLY_FOCUS_DELAY_MS = 250;
/** Solo un texto con algo así lleva tarjeta: sin esto, cada tecla redibujaría la barra. */
const PARECE_UN_LINK = /https?:\/\/|www\./i;

export type Respondiendo = { seq: number; texto: string; mio: boolean };

/** Lo que la pantalla le puede pedir al composer sin conocer su borrador. */
/** `insertEmoji` and `backspace` come from the emoji panel, which lives under the bar (`ChatBottom`). */
export type ComposerHandle = {
  limpiar: () => void;
  insertEmoji: (emoji: string) => void;
  backspace: () => void;
  /** The message being replied to, for a sticker from the panel (20/10). */
  replyingTo: () => number | undefined;
  /** A sticker answered it: the reply strip closes. */
  replyDone: () => void;
};

/**
 * La barra de escribir, APARTE de la pantalla (FL2, spec §45).
 *
 * El borrador vivía en `ChatScreen`: cada tecla re-renderizaba la pantalla
 * entera —la lista con todas sus burbujas incluida—, que es lo que se sentía
 * como un teclado que se arrastra. Acá el borrador y el contador de la nota de
 * voz son estado propio: tipear solo dibuja esta barra.
 *
 * La composición es la de WhatsApp (José, 19/10): UNA píldora con el emoji a
 * la izquierda y el clip y la cámara a la derecha, y afuera UN botón que es
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
  onEnviar: (texto: string, respondeA?: number, menciones?: (texto: string) => MencionEnMensaje[]) => Promise<boolean>;
  /** Para la tarjeta del link que se está escribiendo (18/10). */
  jwt?: string;
  /** Apagado en los chats secretos: el server no tiene que ver sus links. */
  conVistaPrevia?: boolean;
  /** Solo en grupos: a quiénes se puede mencionar con «@» (sin mí). */
  miembros?: MentionableMember[];
  /** Mentioned people who are not in the chat, once the message left: the screen offers to add them. */
  onOutsideMentions?: (people: MencionElegida[]) => void;
  /** A line over the field (the offer to add them). */
  notice?: ReactNode;
  /** The «/» of a space's chat (§c-bis): the apps' commands and what they answered only to me. */
  commands?: ChatCommands;
  /** On an app's form, who is registering (design e-28). */
  myName?: string;
  /** Long-press en enviar: programarlo para más tarde (F11). */
  onProgramar: (texto: string) => void;
  /** The copied image, pasted from the chip over the bar (21/10): it goes to the usual photo preview. */
  onPasteImage?: (photo: FotoElegida) => void;
  onNotaDeVoz: (nota: NotaGrabada) => Promise<void>;
  /**
   * Chat secreto (auditoría 17/10/2026). `bloqueado`: la clave todavía no está
   * y NADA se puede mandar — antes salía en claro. `solo-texto`: hay clave,
   * pero fotos, voz y programados no viajan cifrados, así que no se ofrecen.
   */
  modoSecreto?: 'bloqueado' | 'solo-texto';
}) {
  const colores = useColores();
  // The bar is one point above the bubble (16 at Mediana, as it was).
  const font = useChatFont();
  /**
   * El campo NO es controlado (FL12, §49 #15): con `value` cada tecla iba y
   * volvía entre JS y el nativo y redibujaba la barra, y con el hilo JS ocupado
   * se veían letras que tardaban. El texto vive en un ref; el estado solo
   * guarda su FORMA, que cambia al cruzar vacío ↔ con texto.
   */
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const clipboard = useClipboardImage(focused, !props.modoSecreto && Boolean(props.onPasteImage));
  const textoRef = useRef('');
  const [forma, setForma] = useState<FormaDelTexto>(() => formaDelTexto(''));
  /**
   * Poner un texto desde la app (borrador, edición, devolverlo, un emoji, una
   * mención) remonta el campo con ese valor. `enfocar` lo deja con el teclado
   * abierto si lo tenía; `cursor`, dónde queda el cursor.
   */
  const [inicial, setInicial] = useState<{ texto: string; version: number; enfocar?: boolean; cursor?: number }>({ texto: '', version: 0 });
  const reflejar = (texto: string) => {
    textoRef.current = texto;
    const nueva = formaDelTexto(texto);
    setForma((antes) => (antes.vacio === nueva.vacio && antes.conTexto === nueva.conTexto ? antes : nueva));
  };
  const ponerTexto = (texto: string) => {
    reflejar(texto);
    setInicial((antes) => ({ texto, version: antes.version + 1 }));
  };
  /**
   * Vaciar tras enviar. `clear()` solo no alcanza: si el campo nació de un
   * texto puesto por la app (un borrador restaurado), el nativo ignoraba el
   * `clear()` y el texto quedaba después de enviarlo (emulador, 19/10: pasaba
   * desde FL12). Se remonta vacío y, si tenía el teclado, lo conserva.
   */
  const limpiarCampo = () => {
    const enfocar = inputRef.current?.isFocused() ?? false;
    inputRef.current?.clear();
    reflejar('');
    setTextoConLink('');
    setInicial((antes) => ({ texto: '', version: antes.version + 1, enfocar }));
  };
  /**
   * Escribir DESDE la app (un emoji, completar una mención). Se probó dejar el
   * campo controlado un solo render (`value` + `selection`) y después de un
   * borrador restaurado el `clear()` de enviar quedaba ignorado por el nativo:
   * el texto seguía en el campo (emulador, 19/10). Remontar alinea los
   * contadores del nativo y del JS; con el panel de emojis abierto el campo no
   * tiene el foco, y con el teclado abierto el campo nuevo lo retoma.
   */
  const seleccion = useRef<Seleccion | null>(null);
  const escribir = (texto: string, cursor: number) => {
    reflejar(texto);
    programarBorrador();
    setTextoConLink(PARECE_UN_LINK.test(texto) ? texto : '');
    seleccion.current = { start: cursor, end: cursor };
    const enfocar = inputRef.current?.isFocused() ?? false;
    setInicial((antes) => ({ texto, version: antes.version + 1, enfocar, cursor }));
  };
  // El cursor va donde quedó lo insertado, apenas el campo nuevo existe.
  useEffect(() => {
    const { cursor } = inicial;
    if (cursor === undefined) return;
    const ubicar = setTimeout(() => inputRef.current?.setSelection(cursor, cursor), 0);
    return () => clearTimeout(ubicar);
  }, [inicial]);
  /** El texto, solo si parece tener un link: es lo único que mira la tarjeta. */
  const [textoConLink, setTextoConLink] = useState('');
  const menciones = useMenciones(props.miembros);
  const emojiPanelOpen = useEmojiPanelOpen();
  // Back with the panel open closes it, like the keyboard; it does not leave the chat.
  useEffect(() => {
    if (!emojiPanelOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeEmojiPanel(false);
      return true;
    });
    return () => sub.remove();
  }, [emojiPanelOpen]);
  const alternarEmojis = () => {
    // To the keyboard: it rises over the panel, which leaves once it is up (`ChatBottom`).
    if (emojiPanelOpen) return inputRef.current?.focus();
    // From the keyboard: the panel is already whole behind it while it goes down; nothing moves.
    const keyboardUp = Keyboard.isVisible();
    openEmojiPanel(keyboardUp);
    if (keyboardUp) Keyboard.dismiss();
  };
  /** What the emoji panel types, always with this render's text and cursor. */
  const typeFromPanel = useRef({ insert: (_emoji: string) => {}, back: () => {} });
  typeFromPanel.current = {
    insert: (emoji) => {
      const inserted = insertarEnTexto(textoRef.current, seleccion.current, emoji);
      escribir(inserted.texto, inserted.cursor);
    },
    back: () => {
      const remaining = deleteBeforeCursor(textoRef.current, seleccion.current);
      escribir(remaining.texto, remaining.cursor);
    },
  };
  const voz = useGrabadorDeVoz();
  // Sin diálogo: si el micrófono ya está permitido, la primera nota no espera.
  useEffect(() => {
    precalentarPermisoDeVoz();
  }, []);

  const latestReply = useRef({ seq: props.respondiendoA?.seq, cancel: props.onCancelarRespuesta });
  latestReply.current = { seq: props.respondiendoA?.seq, cancel: props.onCancelarRespuesta };
  // Like WhatsApp (José, 21/10): «Responder» opens the keyboard with the cursor in the field, ready to type.
  const replyingSeq = props.respondiendoA?.seq;
  useEffect(() => {
    if (replyingSeq === undefined) return;
    const focus = setTimeout(() => inputRef.current?.focus(), REPLY_FOCUS_DELAY_MS);
    return () => clearTimeout(focus);
  }, [replyingSeq]);
  useImperativeHandle(
    props.ref,
    () => ({
      limpiar: limpiarCampo,
      insertEmoji: (emoji: string) => typeFromPanel.current.insert(emoji),
      backspace: () => typeFromPanel.current.back(),
      replyingTo: () => latestReply.current.seq,
      replyDone: () => latestReply.current.cancel(),
    }),
    []
  );

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
    const rangos = menciones.rangos();
    const outside = menciones.outside(texto);
    menciones.limpiar();
    const respondiendoA = props.respondiendoA?.seq;
    const sendAsText = () =>
      void props.onEnviar(texto, respondiendoA, rangos).then((ok) => {
        // Not sent: the text goes back to the field; losing it would be worse than the notice.
        if (!ok) ponerTexto(texto);
        else if (outside.length > 0) props.onOutsideMentions?.(outside);
      });
    if (!props.commands) return sendAsText();
    // A «/» line waits for the space's commands before deciding (23/10: a fast «/clima» went to the channel as text).
    void props.commands.runIfCommand(texto).then((outcome) => {
      if (outcome === 'not-command') sendAsText();
      else if (!outcome) ponerTexto(texto);
    });
  };

  // La píldora de escribir: el emoji a la izquierda y clip y cámara a la
  // derecha, como el diseño y WhatsApp. Con texto escrito, clip y cámara se
  // esconden y el campo gana ancho.
  const campoDeTexto = (
    <View className="min-w-0 flex-1 flex-row items-end rounded-3xl border border-outline/15 bg-background pr-1">
      <Pressable
        testID="btn-emojis"
        accessibilityLabel={emojiPanelOpen ? 'Volver al teclado' : 'Emojis'}
        onPress={alternarEmojis}
        android_ripple={{ color: colores.outline, borderless: true, radius: 20 }}
        className="h-[46px] w-11 items-center justify-center"
      >
        {emojiPanelOpen ? <Teclado size={21} color={colores.outline} /> : <Smile size={21} color={colores.outline} />}
      </Pressable>
      <TextInput
        key={inicial.version}
        ref={inputRef}
        defaultValue={inicial.texto}
        onSelectionChange={(evento) => {
          seleccion.current = evento.nativeEvent.selection;
          menciones.alCambiar(textoRef.current, evento.nativeEvent.selection.end);
        }}
        // Al entrar a editar, o al completar una mención con el teclado abierto,
        // el campo se remonta con el texto: que siga con el foco.
        autoFocus={editandoAhora || inicial.enfocar === true}
        testID="input-mensaje"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        // 46 + el borde = 48: la misma altura que el micrófono (FL13). Con 44
        // el multilínea de Android crecía y quedaban desalineados.
        className="max-h-28 min-h-[46px] min-w-0 flex-1 py-3 pr-3 text-on-surface"
        style={{ fontSize: font.size + 1 }}
        // «Mensaje», como WhatsApp: con el emoji adentro, «Escribe un mensaje» se partía en dos líneas.
        placeholder="Mensaje"
        placeholderTextColor={colores.outline}
        multiline
        onChangeText={(texto) => {
          reflejar(texto);
          programarBorrador();
          setTextoConLink(PARECE_UN_LINK.test(texto) ? texto : '');
          props.commands?.onType(texto);
          // «Escribiendo» solo al agregar texto: vaciar el campo no lo es.
          if (texto.length > 0) props.onEscribiendo();
        }}
      />
      {/* Como WhatsApp (José, 19/10): el clip siempre adentro; la cámara, solo
          con el campo vacío. El «+» de afuera se fue: era la misma puerta. */}
      {soloTexto ? null : (
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
          {forma.vacio ? (
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
          ) : null}
        </>
      )}
    </View>
  );

  return (
    <>
      {clipboard.offer && props.onPasteImage ? (
        <PasteImageChip
          onDismiss={clipboard.dismiss}
          onPaste={() => {
            void clipboard.paste().then((photo) => photo && props.onPasteImage?.(photo));
          }}
        />
      ) : null}
      {props.commands ? <EphemeralAnswers answers={props.commands.answers} onDismiss={props.commands.dismiss} onShare={props.commands.share} onOpenForm={props.commands.appAnswers.showForm} chatId={props.chatId} jwt={props.jwt ?? ''} /> : null}
      {props.commands?.appAnswers.openForm ? (
        <AppFormSheet key={formKeyOf(props.commands.appAnswers.openForm)} answer={props.commands.appAnswers.openForm} personName={props.myName} onSubmit={(values) => props.commands!.appAnswers.submitForm(props.commands!.appAnswers.openForm!, values)} onUpload={(photo, stamp) => props.commands!.appAnswers.uploadPhoto(props.commands!.appAnswers.openForm!.commandId, photo, stamp)} onClose={() => props.commands!.appAnswers.dismiss(props.commands!.appAnswers.openForm!.commandId)} />
      ) : null}
      {props.commands ? (
        <CommandPanel
          groups={props.commands.suggestions}
          onPick={(command) => {
            const text = `/${command} `;
            escribir(text, text.length);
            props.commands?.onType(text);
          }}
        />
      ) : null}
      {props.notice}
      <SugerenciasDeMencion
        sugerencias={menciones.sugerencias}
        onElegir={(miembro) => {
          const completado = menciones.choose(textoRef.current, miembro);
          if (completado) escribir(completado.texto, completado.cursor);
        }}
      />
      {props.conVistaPrevia && textoConLink ? <VistaPreviaAlEscribir texto={textoConLink} jwt={props.jwt} /> : null}
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
              campoDeTexto
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
