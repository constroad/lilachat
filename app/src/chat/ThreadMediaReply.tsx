import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatClock, type DeliveryState } from '@lilachat/shared';
import { useColores } from '../ui/tema';
import { colorDeAutor, dondeVaLaHora } from './burbuja';
import { MessageMedia } from './MessageMedia';
import { MetaDeMensaje } from './MetaDeMensaje';
import { TextoConHora } from './TextoConHora';
import { isVisiblePhoto } from './rowKinds';
import type { ChatMessage } from './useChat';

type HourMeta = Omit<ComponentProps<typeof MetaDeMensaje>, 'sobreFoto'>;

/** The hour in one place: on the photo when it has no caption, in its own line for a voice note or a file. */
function ReplyHour(props: { place: ReturnType<typeof dondeVaLaHora>; meta: HourMeta }) {
  if (props.place === 'sobre-la-foto') {
    return (
      <View className="absolute bottom-1.5 right-2 rounded-full bg-black/35 px-1.5 py-0.5">
        <MetaDeMensaje {...props.meta} sobreFoto />
      </View>
    );
  }
  if (props.place === 'renglon-propio') {
    return (
      <View className="flex-row justify-end px-2.5 pb-1.5">
        <MetaDeMensaje {...props.meta} />
      </View>
    );
  }
  return null;
}

/**
 * A photo, video, voice note or file sent as a reply in the thread (José 13/11: the APK drew it as
 * text). The same media as the chat bubble, with its caption, and a tap opens the thread's viewer.
 */
export function ThreadMediaReply(props: {
  message: ChatMessage;
  mine: boolean;
  author: string;
  withAuthor: boolean;
  me: string;
  names: ReadonlyMap<string, string>;
  delivery: DeliveryState;
  onLongPress?: () => void;
  onOpenPhoto?: (seq: number) => void;
}) {
  const colors = useColores();
  const { message, mine } = props;
  const authorColor = colors[`autor-${colorDeAutor(String(message.senderId))}` as keyof typeof colors] as string;
  const meta: HourMeta = { hora: formatClock(message.at), mia: mine, entrega: props.delivery, id: message.clientKey, editado: Boolean(message.editedAt) };
  const place = dondeVaLaHora({ conTexto: Boolean(message.body), eliminado: false, fotoVisible: isVisiblePhoto(message) });
  return (
    <Pressable testID={`respuesta-${message.clientKey}`} onLongPress={props.onLongPress} delayLongPress={350} className={`max-w-[85%] overflow-hidden rounded-2xl ${mine ? 'self-end bg-burbuja-propia' : 'self-start bg-burbuja-ajena'}`}>
      {!mine && props.withAuthor ? <Text className="px-3 pt-1.5 text-[13px] font-semibold" style={{ color: authorColor }}>{props.author}</Text> : null}
      <MessageMedia item={message} mine={mine} onOpen={props.onOpenPhoto} />
      {message.body ? <TextoConHora texto={message.body} menciones={message.menciones} nombres={props.names} yo={props.me} id={message.clientKey} meta={meta} /> : null}
      <ReplyHour place={place} meta={meta} />
    </Pressable>
  );
}
