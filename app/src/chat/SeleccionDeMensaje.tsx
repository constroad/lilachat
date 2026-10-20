import { useState, type ReactNode } from 'react';
import { Alert, Modal, Pressable, Text, ToastAndroid, useWindowDimensions, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Copy, CornerUpLeft, EllipsisVertical, Forward, Info, MessagesSquare, Pencil, Pin, PinOff, Trash2, X } from 'lucide-react-native';
import { puedeEditar } from '@lilachat/shared';
import { accionesDeMensaje, accionesDeVarios, planDeReenvio, textoParaCopiar } from '@lilachat/shared';
import { PantallaDeReenviar } from './reenviar/PantallaDeReenviar';
import { useMargenes } from '../ui/useMargenes';
import { useColores } from '../ui/tema';
import type { ChatMessage } from './useChat';
import { InfoDelMensaje } from './InfoDelMensaje';
import { repartirAcciones, type AccionDeBarra } from './barraDeSeleccion';

const avisar = (texto: string) => ToastAndroid.show(texto, ToastAndroid.SHORT);

/**
 * La barra de los mensajes elegidos con pulsación larga (FL9; auditoría §46.2:
 * solo había «Eliminar», de a uno, sin confirmar, y aparecía en mensajes
 * ajenos).
 *
 * Como WhatsApp: responder y editar (con uno), copiar, reenviar y eliminar,
 * que pregunta «para todos» (solo si todo es propio) o «para mí» (se oculta en
 * este teléfono). Reemplaza a la cabecera mientras dura.
 */
export function SeleccionDeMensaje(params: {
  /** Los elegidos, uno o más. */
  mensajes: ChatMessage[];
  yo: string;
  chatSecreto: boolean;
  /** Para pedir la «Info» de un mensaje propio (FL9). */
  chatId: string;
  jwt: string;
  onCancelar: () => void;
  onResponder: (seq: number) => void;
  onEliminarParaTodos: (seq: number) => Promise<{ ok: boolean; motivo?: string }>;
  onEliminarParaMi: (seq: number) => void;
  /** Editar (José, 17/10/2026): el texto vuelve al campo de escribir. */
  onEditar: (seq: number, texto: string) => void;
  onError: (texto: string) => void;
  /** Fijar arriba del chat (19/10): en un grupo, solo los admins. */
  puedeFijar: boolean;
  fijados: ReadonlySet<number>;
  onFijar: (seq: number) => void;
  onDesfijar: (seq: number) => void;
  /** E3: abrir el hilo de este mensaje. */
  onAbrirHilo?: (seq: number) => void;
}) {
  const colores = useColores();
  const margenes = useMargenes();
  const { width } = useWindowDimensions();
  const [reenviando, setReenviando] = useState(false);
  const [viendoInfo, setViendoInfo] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const { mensajes } = params;
  const mensaje = mensajes[0];
  const texto = mensaje?.body?.trim() ?? '';
  const acciones = accionesDeVarios(
    mensajes.map((uno) =>
      accionesDeMensaje({
        mio: uno.senderId === params.yo,
        eliminado: Boolean(uno.deletedAt),
        conTexto: Boolean(uno.body?.trim()),
        esMedia: Boolean(uno.media),
        chatSecreto: params.chatSecreto,
        esRespuestaDeHilo: uno.hiloDe !== undefined,
        editable: puedeEditar({
          yo: params.yo,
          autor: uno.senderId,
          kind: uno.kind,
          eliminado: Boolean(uno.deletedAt),
          secreto: params.chatSecreto,
          enviadoEn: uno.at,
          ahora: Date.now(),
        }).permitido,
        puedeFijar: params.puedeFijar,
        fijado: params.fijados.has(uno.seq),
      })
    )
  );
  const seqs = mensajes.map((uno) => uno.seq);
  if (!mensaje) return null;

  const eliminar = () => {
    const opciones: { text: string; style?: 'destructive' | 'cancel'; onPress?: () => void }[] = [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar para mí',
        onPress: () => {
          seqs.forEach(params.onEliminarParaMi);
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
          void Promise.all(seqs.map((seq) => params.onEliminarParaTodos(seq))).then((resultados) => {
            const fallo = resultados.find((resultado) => !resultado.ok);
            if (fallo) params.onError(fallo.motivo ?? 'No se pudo eliminar.');
          });
        },
      });
    }
    Alert.alert(seqs.length === 1 ? '¿Eliminar el mensaje?' : `¿Eliminar ${seqs.length} mensajes?`, undefined, opciones);
  };

  const disponibles = [
    acciones.responder ? 'responder' : null,
    acciones.hilo && params.onAbrirHilo ? 'hilo' : null,
    acciones.fijar ? 'fijar' : null,
    acciones.reenviar ? 'reenviar' : null,
    'eliminar',
    acciones.copiar ? 'copiar' : null,
    acciones.editar ? 'editar' : null,
    acciones.info ? 'info' : null,
  ].filter((accion): accion is AccionDeBarra => accion !== null);
  // Todo en UNA línea (José, 19/10): lo que no entra va a «⋮», y eliminar nunca.
  const { visibles, enMenu } = repartirAcciones(disponibles, width);
  const icono = colores['on-surface'];
  const botones: Record<AccionDeBarra, { testID: string; etiqueta: string; icono: ReactNode; onPress: () => void }> = {
    responder: {
      testID: 'btn-responder-mensaje',
      etiqueta: 'Responder',
      icono: <CornerUpLeft size={20} color={icono} />,
      onPress: () => {
        params.onResponder(mensaje.seq);
        params.onCancelar();
      },
    },
    hilo: {
      testID: 'btn-hilo-mensaje',
      etiqueta: 'Responder en hilo',
      icono: <MessagesSquare size={20} color={icono} />,
      onPress: () => {
        params.onAbrirHilo?.(mensaje.seq);
        params.onCancelar();
      },
    },
    fijar: {
      testID: acciones.fijar === 'desfijar' ? 'btn-desfijar-mensaje' : 'btn-fijar-mensaje',
      etiqueta: acciones.fijar === 'desfijar' ? 'Desfijar' : 'Fijar',
      icono: acciones.fijar === 'desfijar' ? <PinOff size={20} color={icono} /> : <Pin size={20} color={icono} />,
      onPress: () => {
        if (acciones.fijar === 'desfijar') params.onDesfijar(mensaje.seq);
        else params.onFijar(mensaje.seq);
        params.onCancelar();
      },
    },
    reenviar: { testID: 'btn-reenviar-mensaje', etiqueta: 'Reenviar', icono: <Forward size={20} color={icono} />, onPress: () => setReenviando(true) },
    eliminar: { testID: 'btn-eliminar-mensaje', etiqueta: 'Eliminar', icono: <Trash2 size={20} color={colores.error} />, onPress: eliminar },
    copiar: {
      testID: 'btn-copiar-mensaje',
      etiqueta: 'Copiar',
      icono: <Copy size={20} color={icono} />,
      onPress: () => {
        void Clipboard.setStringAsync(textoParaCopiar(mensajes)).then(() => avisar('Copiado'));
        params.onCancelar();
      },
    },
    editar: {
      testID: 'btn-editar-mensaje',
      etiqueta: 'Editar',
      icono: <Pencil size={19} color={icono} />,
      onPress: () => {
        params.onEditar(mensaje.seq, texto);
        params.onCancelar();
      },
    },
    info: { testID: 'btn-info-mensaje', etiqueta: 'Info', icono: <Info size={20} color={icono} />, onPress: () => setViendoInfo(true) },
  };

  return (
    <>
      <View
        testID="barra-seleccion"
        className="flex-row items-center border-b border-outline/10 bg-surface px-2 pb-3"
        style={{ paddingTop: margenes.cabecera }}
      >
        <Accion testID="btn-cancelar-seleccion" etiqueta="Cancelar la selección" onPress={params.onCancelar}>
          <X size={22} color={colores['on-surface']} />
        </Accion>
        {/* Solo el número: con todas las acciones, «1 seleccionado» se partía en dos líneas. */}
        <Text
          testID="conteo-mensajes"
          accessibilityLabel={seqs.length === 1 ? '1 seleccionado' : `${seqs.length} seleccionados`}
          className="flex-1 pl-1 text-lg font-semibold text-on-surface"
          numberOfLines={1}
        >
          {seqs.length}
        </Text>
        {visibles.map((accion) => (
          <Accion key={accion} testID={botones[accion].testID} etiqueta={botones[accion].etiqueta} onPress={botones[accion].onPress}>
            {botones[accion].icono}
          </Accion>
        ))}
        {enMenu.length ? (
          <Accion testID="btn-mas-acciones" etiqueta="Más acciones" onPress={() => setMenuAbierto(true)}>
            <EllipsisVertical size={20} color={colores['on-surface']} />
          </Accion>
        ) : null}
      </View>
      <Modal visible={menuAbierto} transparent animationType="fade" onRequestClose={() => setMenuAbierto(false)} statusBarTranslucent>
        <Pressable className="flex-1" onPress={() => setMenuAbierto(false)} accessibilityLabel="Cerrar el menú">
          <View testID="menu-mas-acciones" className="absolute right-2 min-w-[180px] rounded-xl border border-outline/10 bg-surface py-1" style={{ top: margenes.cabecera + 48, elevation: 6 }}>
            {enMenu.map((accion) => (
              <Pressable
                key={accion}
                testID={botones[accion].testID}
                onPress={() => {
                  setMenuAbierto(false);
                  botones[accion].onPress();
                }}
                className="min-h-[48px] flex-row items-center gap-3 px-4"
              >
                {botones[accion].icono}
                <Text className="text-base text-on-surface">{botones[accion].etiqueta}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
      <InfoDelMensaje
        visible={viendoInfo}
        chatId={params.chatId}
        seq={mensaje.seq}
        jwt={params.jwt}
        onCerrar={() => setViendoInfo(false)}
      />
      <PantallaDeReenviar
        visible={reenviando}
        pasos={planDeReenvio(mensajes.map((uno) => ({ ...uno, chatId: params.chatId })))}
        token={params.jwt}
        onError={params.onError}
        onCerrar={() => setReenviando(false)}
        onReenviado={(nombres) => {
          setReenviando(false);
          params.onCancelar();
          avisar(`Reenviado a ${nombres.join(', ')}`);
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
