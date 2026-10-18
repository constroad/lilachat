import { Pressable, Text, View } from 'react-native';
import { extractoDeCoincidencia } from '@lilachat/shared';
import type { ChatSummary, ResultadoBusqueda } from '../api/client';

/**
 * Lo encontrado DENTRO de las conversaciones, debajo de los chats que
 * coinciden por nombre: dos secciones, como WhatsApp (salió de
 * `ChatListScreen`). Lo cifrado no aparece: el server no tiene el texto.
 */
export function ResultadosDeMensajes(props: {
  resultados: ResultadoBusqueda[];
  chats: ChatSummary[];
  busqueda: string;
  tituloDe: (chat: ChatSummary) => string;
  /** Con el `seq`: el chat se abre en ese mensaje (FL9d). */
  onAbrir: (chat: ChatSummary, seq: number) => void;
}) {
  return (
    <View className="mt-3 border-t border-outline/10 pt-3" testID="resultados-mensajes">
      <Text className="mb-1 px-4 text-[11px] font-semibold uppercase text-on-surface-variant">
        Mensajes
      </Text>
      {props.resultados.map((resultado) => {
        const chat = props.chats.find((uno) => uno.id === resultado.chatId);
        if (!chat) return null;
        const extracto = extractoDeCoincidencia(resultado.body, props.busqueda.trim());
        return (
          <Pressable
            key={resultado.messageId}
            testID={`resultado-${resultado.messageId}`}
            onPress={() => props.onAbrir(chat, resultado.seq)}
            className="min-h-[56px] justify-center px-4 py-2"
          >
            <Text className="text-[13px] font-semibold text-on-surface" numberOfLines={1}>
              {props.tituloDe(chat)}
            </Text>
            <Text className="text-[12px] text-on-surface-variant" numberOfLines={1}>
              {extracto.desde < 0 ? (
                extracto.texto
              ) : (
                <>
                  {extracto.texto.slice(0, extracto.desde)}
                  <Text className="font-bold text-on-surface">
                    {extracto.texto.slice(extracto.desde, extracto.desde + extracto.largo)}
                  </Text>
                  {extracto.texto.slice(extracto.desde + extracto.largo)}
                </>
              )}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
