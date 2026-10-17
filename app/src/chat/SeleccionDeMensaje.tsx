import { useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, Text, ToastAndroid, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Crypto from 'expo-crypto';
import { Copy, CornerUpLeft, Forward, Trash2, X } from 'lucide-react-native';
import { buildOutboxItem, nombreDeContacto } from '@lilachat/shared';
import { accionesDeMensaje } from './accionesDeMensaje';
import { chatsEnMemoria } from './chatsGuardados';
import { queueMessage } from './outboxStore';
import { agendaPorTelefono } from '../contacts/agendaEnMemoria';
import { useMargenes } from '../ui/useMargenes';
import { useColores } from '../ui/tema';
import type { ChatMessage } from './useChat';

const avisar = (texto: string) => ToastAndroid.show(texto, ToastAndroid.SHORT);

/**
 * La barra de un mensaje elegido con pulsación larga (FL9; auditoría §46.2:
 * solo había «Eliminar», sin confirmar, y aparecía en mensajes ajenos).
 *
 * Como WhatsApp: responder, copiar, reenviar y eliminar, que pregunta «para
 * todos» (solo lo propio) o «para mí» (se oculta en este teléfono). Reemplaza
 * a la cabecera mientras dura: las dos a la vez empujan la conversación.
 */
export function SeleccionDeMensaje(params: {
  mensaje: ChatMessage;
  yo: string;
  chatSecreto: boolean;
  onCancelar: () => void;
  onResponder: (seq: number) => void;
  onEliminarParaTodos: (seq: number) => Promise<{ ok: boolean; motivo?: string }>;
  onEliminarParaMi: (seq: number) => void;
  onError: (texto: string) => void;
}) {
  const colores = useColores();
  const margenes = useMargenes();
  const [reenviando, setReenviando] = useState(false);
  const { mensaje } = params;
  const texto = mensaje.body?.trim() ?? '';
  const acciones = accionesDeMensaje({
    mio: mensaje.senderId === params.yo,
    eliminado: Boolean(mensaje.deletedAt),
    conTexto: texto.length > 0,
    esMedia: Boolean(mensaje.media),
    chatSecreto: params.chatSecreto,
  });

  const eliminar = () => {
    const opciones: { text: string; style?: 'destructive' | 'cancel'; onPress?: () => void }[] = [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar para mí',
        onPress: () => {
          params.onEliminarParaMi(mensaje.seq);
          params.onCancelar();
        },
      },
    ];
    if (acciones.eliminarParaTodos) {
      opciones.push({
        text: 'Eliminar para todos',
        style: 'destructive',
        onPress: () => {
          params.onCancelar();
          void params.onEliminarParaTodos(mensaje.seq).then((resultado) => {
            if (!resultado.ok) params.onError(resultado.motivo ?? 'No se pudo eliminar.');
          });
        },
      });
    }
    Alert.alert('¿Eliminar el mensaje?', undefined, opciones);
  };

  return (
    <>
      <View
        testID="barra-seleccion"
        className="flex-row items-center gap-1 border-b border-outline/10 bg-surface px-3 pb-3"
        style={{ paddingTop: margenes.cabecera }}
      >
        <Accion testID="btn-cancelar-seleccion" etiqueta="Cancelar la selección" onPress={params.onCancelar}>
          <X size={22} color={colores['on-surface']} />
        </Accion>
        <Text className="flex-1 text-base font-semibold text-on-surface">1 seleccionado</Text>
        {acciones.responder ? (
          <Accion
            testID="btn-responder-mensaje"
            etiqueta="Responder"
            onPress={() => {
              params.onResponder(mensaje.seq);
              params.onCancelar();
            }}
          >
            <CornerUpLeft size={20} color={colores['on-surface']} />
          </Accion>
        ) : null}
        {acciones.copiar ? (
          <Accion
            testID="btn-copiar-mensaje"
            etiqueta="Copiar"
            onPress={() => {
              void Clipboard.setStringAsync(texto).then(() => avisar('Copiado'));
              params.onCancelar();
            }}
          >
            <Copy size={20} color={colores['on-surface']} />
          </Accion>
        ) : null}
        {acciones.reenviar ? (
          <Accion testID="btn-reenviar-mensaje" etiqueta="Reenviar" onPress={() => setReenviando(true)}>
            <Forward size={20} color={colores['on-surface']} />
          </Accion>
        ) : null}
        <Accion testID="btn-eliminar-mensaje" etiqueta="Eliminar el mensaje" onPress={eliminar}>
          <Trash2 size={20} color={colores.error} />
        </Accion>
      </View>
      <ReenviarA
        visible={reenviando}
        texto={texto}
        onCerrar={() => setReenviando(false)}
        onReenviado={(nombre) => {
          setReenviando(false);
          params.onCancelar();
          avisar(`Reenviado a ${nombre}`);
        }}
      />
    </>
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

/**
 * Elegir a qué chat reenviar el texto. Los chats secretos no aparecen: el
 * texto tendría que salir cifrado con la clave de ese chat, y encolarlo en
 * claro sería justo lo que el server rechaza.
 */
function ReenviarA(props: { visible: boolean; texto: string; onCerrar: () => void; onReenviado: (nombre: string) => void }) {
  const colores = useColores();
  const margenes = useMargenes();
  const destinos = useMemo(() => {
    if (!props.visible) return [];
    const agenda = agendaPorTelefono();
    return (chatsEnMemoria() ?? [])
      .filter((chat) => !chat.encrypted)
      .map((chat) => ({ id: chat.id, nombre: nombreDeContacto({ delServidor: chat.name, telefono: chat.phone, agenda }) || 'Chat' }));
  }, [props.visible]);

  const reenviar = async (destino: { id: string; nombre: string }) => {
    const item = buildOutboxItem({
      chatId: destino.id,
      clientKey: Crypto.randomUUID(),
      text: props.texto,
      queuedAt: new Date().toISOString(),
    });
    if (!item) return;
    await queueMessage(item);
    props.onReenviado(destino.nombre);
  };

  return (
    <Modal visible={props.visible} animationType="slide" onRequestClose={props.onCerrar}>
      <View className="flex-1 bg-background" testID="pantalla-reenviar">
        <View className="flex-row items-center gap-2 px-3 pb-3" style={{ paddingTop: margenes.cabecera }}>
          <Pressable testID="btn-cerrar-reenviar" accessibilityLabel="Cerrar" onPress={props.onCerrar} className="h-11 w-11 items-center justify-center">
            <X size={22} color={colores['on-surface']} />
          </Pressable>
          <Text className="text-lg font-bold text-on-surface">Reenviar a…</Text>
        </View>
        <FlatList
          data={destinos}
          keyExtractor={(destino) => destino.id}
          renderItem={({ item }) => (
            <Pressable
              testID={`reenviar-a-${item.id}`}
              onPress={() => void reenviar(item)}
              className="min-h-[56px] flex-row items-center gap-3 px-4"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/15">
                <Text className="font-bold text-primary">{item.nombre.slice(0, 1).toUpperCase()}</Text>
              </View>
              <Text className="flex-1 text-[15px] text-on-surface" numberOfLines={1}>
                {item.nombre}
              </Text>
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}
