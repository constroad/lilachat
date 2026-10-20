import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, ToastAndroid, View } from 'react-native';
import { Modal } from '../../ui/Modal';
import * as Crypto from 'expo-crypto';
import { ArrowLeft, Check, NotebookPen, Search, Send, Users } from 'lucide-react-native';
import { alternarDestino, buildOutboxItem, destinosDeReenvio, MAXIMO_DE_DESTINOS, nombreDeContacto, type ChatParaReenviar, type Frecuencias, type PasoDeReenvio } from '@lilachat/shared';
import { reenviarMensajeA } from '../../api/client';
import { createChat } from '../../contacts/contactsApi';
import { agendaPorTelefono } from '../../contacts/agendaEnMemoria';
import { Avatar } from '../../ui/Avatar';
import { useMargenes } from '../../ui/useMargenes';
import { useColores } from '../../ui/tema';
import { chatsEnMemoria } from '../chatsGuardados';
import { queueMessage } from '../outboxStore';
import { leerFrecuencias } from './frecuenciasDeEnvio';

/** El «Tú» que todavía no existe: se crea al mandar (`kind: 'yo'`). */
const TU_NUEVO = 'tu-nuevo';
const AVATAR = 48;

type Fila = { tipo: 'rotulo'; texto: string } | { tipo: 'chat'; chat: ChatParaReenviar };

function destinosPosibles(): ChatParaReenviar[] {
  const agenda = agendaPorTelefono();
  const chats = (chatsEnMemoria() ?? []).map((chat) => ({
    id: chat.id,
    nombre: chat.propio ? 'Tú' : nombreDeContacto({ delServidor: chat.name, telefono: chat.phone, agenda }) || 'Chat',
    subtitulo: chat.propio ? 'Envíate un mensaje' : chat.kind === 'notas' ? 'Solo tú lo ves' : chat.lastMessage?.body?.split('\n')[0],
    esGrupo: chat.kind === 'group',
    esBorrador: chat.kind === 'notas' && !chat.propio,
    propio: chat.propio,
    cifrado: chat.encrypted,
    ultimoEn: chat.lastMessage?.at,
    avatarUrl: chat.avatarUrl,
  }));
  return chats.some((chat) => chat.propio) ? chats : [...chats, { id: TU_NUEVO, nombre: 'Tú', subtitulo: 'Envíate un mensaje', propio: true }];
}

/**
 * Reenviar a… (José, 20/10; diseño `f1-app-reenviar`), como WhatsApp:
 * buscador, «Chats frecuentes», «Chats recientes», hasta 5 destinos con su
 * casilla, y abajo los elegidos con «Añadir un mensaje…» y enviar. Cada
 * mensaje sale por separado y en orden (el texto por la cola; la foto o el
 * archivo, por referencia).
 */
export function PantallaDeReenviar(props: { visible: boolean; pasos: PasoDeReenvio[]; token: string; onCerrar: () => void; onReenviado: (nombres: string[]) => void; onError: (texto: string) => void }) {
  const colores = useColores();
  const margenes = useMargenes();
  const [busqueda, setBusqueda] = useState('');
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [frecuencias, setFrecuencias] = useState<Frecuencias>({});
  useEffect(() => {
    if (!props.visible) return;
    setBusqueda('');
    setElegidos([]);
    setMensaje('');
    void leerFrecuencias().then(setFrecuencias);
  }, [props.visible]);

  const posibles = useMemo(() => (props.visible ? destinosPosibles() : []), [props.visible]);
  const filas = useMemo((): Fila[] => {
    const { frecuentes, recientes } = destinosDeReenvio({ chats: posibles, frecuencias, busqueda, ahora: Date.now() });
    return [
      ...(frecuentes.length ? [{ tipo: 'rotulo' as const, texto: 'Chats frecuentes' }, ...frecuentes.map((chat) => ({ tipo: 'chat' as const, chat }))] : []),
      ...(recientes.length ? [{ tipo: 'rotulo' as const, texto: busqueda ? 'Resultados' : 'Chats recientes' }, ...recientes.map((chat) => ({ tipo: 'chat' as const, chat }))] : []),
    ];
  }, [posibles, frecuencias, busqueda]);
  const nombres = elegidos.map((id) => posibles.find((chat) => chat.id === id)?.nombre ?? '');

  const alternar = (id: string) => {
    const r = alternarDestino(elegidos, id);
    if (r.lleno) ToastAndroid.show(`Puedes reenviar a ${MAXIMO_DE_DESTINOS} chats como máximo.`, ToastAndroid.SHORT);
    setElegidos(r.elegidos);
  };

  const enviarA = async (chatId: string): Promise<boolean> => {
    for (const paso of props.pasos) {
      if (paso.tipo === 'mensaje') {
        const r = await reenviarMensajeA(props.token, chatId, { desde: paso.chatId, seq: paso.seq, clientKey: Crypto.randomUUID() });
        if (!r.ok) return props.onError(r.message ?? 'No se pudo reenviar.'), false;
        continue;
      }
      const item = buildOutboxItem({ chatId, clientKey: Crypto.randomUUID(), text: paso.texto, queuedAt: new Date().toISOString() });
      if (item) await queueMessage(item);
    }
    const extra = mensaje.trim() ? buildOutboxItem({ chatId, clientKey: Crypto.randomUUID(), text: mensaje.trim(), queuedAt: new Date().toISOString() }) : null;
    if (extra) await queueMessage(extra);
    return true;
  };

  const enviar = async () => {
    if (enviando || elegidos.length === 0) return;
    setEnviando(true);
    for (const id of elegidos) {
      let destino = id;
      if (id === TU_NUEVO) {
        const creado = await createChat(props.token, { kind: 'yo', memberIds: [] });
        if (!creado.ok) {
          setEnviando(false);
          return props.onError(creado.message ?? 'No se pudo abrir tu chat.');
        }
        destino = creado.data.chatId;
      }
      if (!(await enviarA(destino))) return setEnviando(false);
    }
    setEnviando(false);
    props.onReenviado(nombres);
  };

  return (
    <Modal visible={props.visible} animationType="slide" onRequestClose={props.onCerrar}>
      <View className="flex-1 bg-background" testID="pantalla-reenviar">
        <View className="flex-row items-center gap-2 border-b border-outline/10 bg-surface px-2 pb-2" style={{ paddingTop: margenes.cabecera }}>
          <Pressable testID="btn-cerrar-reenviar" accessibilityLabel="Cerrar" onPress={props.onCerrar} className="h-11 w-11 items-center justify-center">
            <ArrowLeft size={22} color={colores['on-surface']} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-[18px] font-semibold text-on-surface">Reenviar a</Text>
            {elegidos.length ? <Text className="text-[13px] text-on-surface-variant">{elegidos.length === 1 ? '1 seleccionado' : `${elegidos.length} seleccionados`}</Text> : null}
          </View>
        </View>
        <View className="mx-4 my-3 flex-row items-center gap-2 rounded-full bg-surface-variant/60 px-4">
          <Search size={18} color={colores['on-surface-variant']} />
          <TextInput testID="input-buscar-reenviar" value={busqueda} onChangeText={setBusqueda} placeholder="Buscar chats o contactos" placeholderTextColor={colores['on-surface-variant']} className="min-h-[44px] flex-1 text-[15px] text-on-surface" />
        </View>
        <FlatList
          data={filas}
          keyExtractor={(fila, indice) => (fila.tipo === 'chat' ? fila.chat.id : `rotulo-${indice}`)}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) =>
            item.tipo === 'rotulo' ? (
              <Text className="px-5 pb-1 pt-4 text-[12px] font-semibold uppercase tracking-wide text-on-surface-variant">{item.texto}</Text>
            ) : (
              <FilaDeDestino chat={item.chat} elegido={elegidos.includes(item.chat.id)} onAlternar={() => alternar(item.chat.id)} />
            )
          }
          ListEmptyComponent={<Text className="px-5 py-8 text-center text-[14px] text-on-surface-variant">No hay chats con ese nombre.</Text>}
        />
        {elegidos.length ? (
          <View className="flex-row items-center gap-3 border-t border-outline/10 bg-surface px-4 pt-2" style={{ paddingBottom: margenes.pie + 8 }}>
            <View className="min-w-0 flex-1">
              <Text testID="elegidos-reenviar" numberOfLines={1} className="text-[14px] font-semibold text-on-surface">
                {nombres.join(', ')}
              </Text>
              <TextInput testID="input-mensaje-reenviar" value={mensaje} onChangeText={setMensaje} placeholder="Añadir un mensaje…" placeholderTextColor={colores['on-surface-variant']} className="min-h-[40px] text-[14px] text-on-surface" />
            </View>
            <Pressable testID="btn-enviar-reenviar" accessibilityLabel="Enviar" disabled={enviando} onPress={() => void enviar()} className={`h-14 w-14 items-center justify-center rounded-full bg-primary ${enviando ? 'opacity-60' : ''}`}>
              <Send size={22} color={colores['on-primary']} />
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function FilaDeDestino(props: { chat: ChatParaReenviar; elegido: boolean; onAlternar: () => void }) {
  const colores = useColores();
  const { chat } = props;
  const icono = chat.esGrupo ? <Users size={22} color={colores.primary} /> : chat.esBorrador ? <NotebookPen size={22} color={colores.primary} /> : undefined;
  return (
    <Pressable testID={`reenviar-a-${chat.id}`} accessibilityRole="checkbox" accessibilityState={{ checked: props.elegido }} onPress={props.onAlternar} className="min-h-[64px] flex-row items-center gap-3 px-5">
      <Avatar nombre={chat.nombre} foto={chat.avatarUrl} tamano={AVATAR} icono={icono} />
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="text-[16px] text-on-surface">{chat.nombre}</Text>
        {chat.subtitulo ? <Text numberOfLines={1} className="text-[13px] text-on-surface-variant">{chat.subtitulo}</Text> : null}
      </View>
      <View className={`h-6 w-6 items-center justify-center rounded-full border-2 ${props.elegido ? 'border-primary bg-primary' : 'border-outline/40'}`}>
        {props.elegido ? <Check size={14} color={colores['on-primary']} /> : null}
      </View>
    </Pressable>
  );
}
