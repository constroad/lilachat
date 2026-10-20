import { useEffect, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { KeyboardAvoidingView, useKeyboardState } from 'react-native-keyboard-controller';
import { ArrowLeft, Send, Square, SquareCheck } from 'lucide-react-native';
import { formatClock, miReaccion, primerEnlace, puedeReaccionar, resolveDeliveryState, type DeliveryState } from '@lilachat/shared';
import { Avatar } from '../ui/Avatar';
import { useMargenes } from '../ui/useMargenes';
import { useColores } from '../ui/tema';
import { colorDeAutor } from './burbuja';
import { TextoConHora } from './TextoConHora';
import { TextoConEnlaces } from './TextoConEnlaces';
import { VistaPreviaDeEnlace } from './VistaPreviaDeEnlace';
import type { ChatMessage, PendingMessage } from './useChat';
import type { RespuestaDeReaccion } from './useCambiosDeMensajes';
import { BarraDeReacciones } from './reacciones/BarraDeReacciones';
import { PastillaDeReacciones } from './reacciones/PastillaDeReacciones';
import { useReaccionesEnPantalla } from './reacciones/useReaccionesEnPantalla';

/** Lo escrito y no mandado en cada hilo, mientras la app está abierta. */
const borradores = new Map<string, string>();

type Respuesta = ChatMessage | PendingMessage;
const esPendiente = (mensaje: Respuesta): mensaje is PendingMessage => mensaje.pending === true;

/**
 * Un hilo (E3, 20/10; diseño `e3-app-hilo`): la raíz arriba, sus respuestas
 * como un chat y un campo para responder, con «También enviar al chat». Es un
 * modal dentro de la conversación: funciona igual en el teléfono y en el panel
 * de la tablet. Atrás lo cierra; lo escrito queda como borrador.
 */
export function HiloScreen(props: {
  raiz: ChatMessage | null;
  chatId: string;
  chatName: string;
  yo: string;
  /** Para la tarjeta de los enlaces (20/10: en el hilo un link quedaba como texto). */
  jwt: string;
  esGrupo: boolean;
  nombres: ReadonlyMap<string, string>;
  fotos: ReadonlyMap<string, string>;
  respuestas: readonly ChatMessage[];
  pendientes: readonly PendingMessage[];
  leidoHasta: number;
  entregadoHasta: number;
  onEnviar: (texto: string, enElChat: boolean) => Promise<{ ok: boolean }>;
  /** Reacciones (20/10): mantener presionada una respuesta muestra la barra. */
  reaccionar: (seq: number, emoji: string | null) => Promise<RespuestaDeReaccion>;
  onCerrar: () => void;
}) {
  const colores = useColores();
  const margenes = useMargenes();
  // Teclado abierto = sin barra de navegación: su margen dejaba una franja vacía bajo «También enviar al chat» (20/10).
  const tecladoAbierto = useKeyboardState((estado) => estado.isVisible);
  const clave = `${props.chatId}:${props.raiz?.seq ?? ''}`;
  const [texto, setTexto] = useState('');
  const [enElChat, setEnElChat] = useState(false);
  const lista = useRef<FlatList<Respuesta>>(null);
  const [barraEn, setBarraEn] = useState<number | null>(null);
  useEffect(() => {
    setTexto(borradores.get(clave) ?? '');
    setEnElChat(false);
    setBarraEn(null);
  }, [clave]);
  // Al abrir el teclado la lista se achica: que la última respuesta siga a la vista.
  useEffect(() => {
    if (tecladoAbierto) lista.current?.scrollToEnd({ animated: true });
  }, [tecladoAbierto]);
  // Las hojas viven DENTRO del modal del hilo: las del chat quedarían detrás.
  const reacciones = useReaccionesEnPantalla({ mensajes: props.respuestas, reaccionar: props.reaccionar, yo: props.yo, nombres: props.nombres, fotos: props.fotos, alReaccionar: () => setBarraEn(null) });
  const filas: Respuesta[] = [...props.respuestas, ...props.pendientes];
  const nombreDe = (id: string) => (id === props.yo ? 'Tú' : (props.nombres.get(id) ?? 'Alguien'));

  const enviar = async () => {
    const limpio = texto.trim();
    if (!limpio) return;
    setTexto('');
    borradores.delete(clave);
    // Como en Slack: «También enviar al chat» vale para una respuesta, no para las que siguen.
    setEnElChat(false);
    const r = await props.onEnviar(limpio, enElChat);
    if (!r.ok) {
      setTexto(limpio);
      setEnElChat(enElChat);
    }
    setTimeout(() => lista.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <Modal visible={props.raiz !== null} animationType="slide" onRequestClose={props.onCerrar}>
      <KeyboardAvoidingView behavior="padding" className="flex-1 bg-background" testID="pantalla-hilo">
        <View className="flex-row items-center gap-2 border-b border-outline/10 bg-surface px-2 pb-2" style={{ paddingTop: margenes.cabecera }}>
          <Pressable testID="btn-cerrar-hilo" accessibilityLabel="Volver al chat" onPress={props.onCerrar} className="h-11 w-11 items-center justify-center">
            <ArrowLeft size={22} color={colores['on-surface']} />
          </Pressable>
          <View className="min-w-0 flex-1">
            <Text className="text-[17px] font-semibold text-on-surface">Hilo</Text>
            <Text className="text-[12px] text-on-surface-variant" numberOfLines={1}>
              {props.chatName}
            </Text>
          </View>
        </View>
        {props.raiz ? (
          <FlatList
            ref={lista}
            data={filas}
            keyExtractor={(fila) => fila.clientKey}
            contentContainerStyle={{ padding: 12, gap: 8 }}
            onContentSizeChange={() => lista.current?.scrollToEnd({ animated: false })}
            ListHeaderComponent={<CabeceraDelHilo raiz={props.raiz} nombre={nombreDe(String(props.raiz.senderId))} foto={props.fotos.get(String(props.raiz.senderId))} cuantas={props.respuestas.length} />}
            renderItem={({ item }) => {
              const mia = esPendiente(item) || String(item.senderId) === props.yo;
              const confirmada = esPendiente(item) ? null : item;
              return (
                <View>
                  {confirmada && barraEn === confirmada.seq ? (
                    <BarraDeReacciones seq={confirmada.seq} mia={mia} conAvatar={false} miEmoji={miReaccion(confirmada.reacciones, props.yo)} onElegir={reacciones.elegir} onMas={reacciones.masEmojis} />
                  ) : null}
                  <BurbujaDelHilo
                    mensaje={item}
                    mia={mia}
                    autor={esPendiente(item) ? 'Tú' : nombreDe(String(item.senderId))}
                    conAutor={props.esGrupo}
                    yo={props.yo}
                    jwt={props.jwt}
                    nombres={props.nombres}
                    entrega={resolveDeliveryState({ seq: confirmada ? confirmada.seq : null, otherReadSeq: props.leidoHasta, otherDeliveredSeq: props.entregadoHasta })}
                    onLongPress={confirmada && puedeReaccionar({ seq: confirmada.seq, deletedAt: confirmada.deletedAt, kind: confirmada.kind }) ? () => setBarraEn((antes) => (antes === confirmada.seq ? null : confirmada.seq)) : undefined}
                  />
                  {confirmada?.reacciones?.length && !confirmada.deletedAt ? (
                    <PastillaDeReacciones id={`hilo-${confirmada.seq}`} reacciones={confirmada.reacciones} yo={props.yo} mia={mia} conAvatar={false} onTocar={() => reacciones.verReacciones(confirmada.seq)} />
                  ) : null}
                </View>
              );
            }}
          />
        ) : null}
        <View className="border-t border-outline/10 bg-surface px-3 pt-2" style={{ paddingBottom: (tecladoAbierto ? 0 : margenes.pie) + 4 }}>
          <View className="flex-row items-end gap-2">
            <TextInput
              testID="input-hilo"
              value={texto}
              onChangeText={(nuevo) => {
                setTexto(nuevo);
                borradores.set(clave, nuevo);
              }}
              placeholder="Responder en el hilo…"
              placeholderTextColor={colores['on-surface-variant']}
              multiline
              className="min-h-[44px] flex-1 rounded-3xl bg-background px-4 py-2.5 text-[15px] text-on-surface"
            />
            <Pressable testID="btn-enviar-hilo" accessibilityLabel="Enviar al hilo" onPress={() => void enviar()} className="h-11 w-11 items-center justify-center rounded-full bg-primary">
              <Send size={18} color={colores['on-primary']} />
            </Pressable>
          </View>
          <Pressable testID="casilla-tambien-al-chat" accessibilityRole="checkbox" accessibilityState={{ checked: enElChat }} onPress={() => setEnElChat((antes) => !antes)} className="min-h-[40px] flex-row items-center gap-2 px-1">
            {enElChat ? <SquareCheck size={18} color={colores.primary} /> : <Square size={18} color={colores['on-surface-variant']} />}
            <Text className="text-[13px] text-on-surface-variant">También enviar al chat</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      {reacciones.hojas}
    </Modal>
  );
}

function CabeceraDelHilo(props: { raiz: ChatMessage; nombre: string; foto?: string; cuantas: number }) {
  return (
    <View className="mb-1 gap-2">
      <View testID="raiz-del-hilo" className="flex-row gap-3 rounded-xl border border-outline/10 bg-surface p-3">
        <Avatar nombre={props.nombre} foto={props.foto} tamano={36} />
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center justify-between">
            <Text className="text-[14px] font-semibold text-on-surface">{props.nombre}</Text>
            <Text className="text-[11px] text-on-surface-variant">{formatClock(props.raiz.at)}</Text>
          </View>
          <Text className="mt-0.5 text-[15px] text-on-surface">{props.raiz.deletedAt ? 'Se eliminó este mensaje' : props.raiz.body ? <TextoConEnlaces texto={props.raiz.body} /> : props.raiz.media ? 'Archivo' : ''}</Text>
        </View>
      </View>
      <View className="flex-row items-center gap-3">
        <View className="h-px flex-1 bg-outline/15" />
        <Text className="text-[12px] text-on-surface-variant">{props.cuantas === 1 ? '1 respuesta' : `${props.cuantas} respuestas`}</Text>
        <View className="h-px flex-1 bg-outline/15" />
      </View>
    </View>
  );
}

/**
 * Una respuesta del hilo con la MISMA burbuja del chat (20/10): sus colores
 * (en modo oscuro la propia era clara y la hora no se veía), la hora dentro de
 * la última línea (antes iba en un renglón aparte y dejaba un hueco bajo el
 * check), los links tocables con su tarjeta y las @menciones.
 */
function BurbujaDelHilo(props: { mensaje: Respuesta; mia: boolean; autor: string; conAutor: boolean; yo: string; jwt: string; nombres: ReadonlyMap<string, string>; entrega: DeliveryState; onLongPress?: () => void }) {
  const colores = useColores();
  const { mensaje, mia } = props;
  const pendiente = esPendiente(mensaje);
  const eliminado = !pendiente && Boolean(mensaje.deletedAt);
  const hora = formatClock(pendiente ? mensaje.queuedAt : mensaje.at);
  const colorAutor = !pendiente ? (colores[`autor-${colorDeAutor(String(mensaje.senderId))}` as keyof typeof colores] as string) : undefined;
  const enlace = !pendiente && !eliminado && mensaje.body ? primerEnlace(mensaje.body) : null;
  const meta = { hora, mia, entrega: pendiente ? ('pending' as const) : props.entrega, id: mensaje.clientKey, fallido: pendiente && Boolean(mensaje.fallo), editado: !pendiente && Boolean(mensaje.editedAt) && !eliminado };
  return (
    <Pressable testID={`respuesta-${mensaje.clientKey}`} onLongPress={props.onLongPress} delayLongPress={350} className={`max-w-[85%] overflow-hidden rounded-2xl ${mia ? 'self-end bg-burbuja-propia' : 'self-start bg-burbuja-ajena'}`}>
      {!mia && props.conAutor ? <Text className="px-3 pt-1.5 text-[13px] font-semibold" style={{ color: colorAutor }}>{props.autor}</Text> : null}
      {enlace ? <VistaPreviaDeEnlace url={enlace} jwt={props.jwt} mia={mia} /> : null}
      {eliminado ? (
        <Text className={`px-3 py-1.5 text-[15px] italic ${mia ? 'text-on-burbuja-propia-suave' : 'text-on-surface-variant'}`}>Se eliminó este mensaje</Text>
      ) : (
        <TextoConHora texto={mensaje.body ?? ''} menciones={pendiente ? undefined : mensaje.menciones} nombres={props.nombres} yo={props.yo} id={mensaje.clientKey} meta={meta} />
      )}
    </Pressable>
  );
}
