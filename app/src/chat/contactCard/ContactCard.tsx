import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, ToastAndroid, View } from 'react-native';
import { MessageCircle, UserPlus } from 'lucide-react-native';
import * as Contacts from 'expo-contacts/legacy';
import { formatPhoneDisplay, toInternationalPhone, type SharedContact } from '@lilachat/shared';
import { createChat } from '../../contacts/contactsApi';
import { requestOpenChat } from '../../ui/openChatRequest';
import { Avatar } from '../../ui/Avatar';
import { useColores } from '../../ui/tema';

/**
 * A contact shared in the chat (pending 9, José 20/10), like WhatsApp: the
 * name and phone, «Enviar mensaje» when that number is on Lilachat (it opens or
 * creates the chat) and «Agregar» to the phone book with the phone's own form.
 */
export function ContactCard(props: { contact: SharedContact; mine: boolean; jwt: string; myUserId: string }) {
  const colors = useColores();
  const { contact } = props;
  const [opening, setOpening] = useState(false);
  const canWrite = Boolean(contact.userId) && contact.userId !== props.myUserId;
  const tone = props.mine ? 'text-on-burbuja-propia' : 'text-on-surface';
  const soft = props.mine ? 'text-on-burbuja-propia-suave' : 'text-on-surface-variant';
  const iconColor = props.mine ? colors['on-burbuja-propia'] : colors.primary;

  const write = async () => {
    if (!contact.userId || opening) return;
    setOpening(true);
    const chat = await createChat(props.jwt, { kind: 'direct', memberIds: [contact.userId] });
    setOpening(false);
    if (chat.ok) requestOpenChat(chat.data.chatId);
    else ToastAndroid.show(chat.message ?? 'No se pudo abrir el chat.', ToastAndroid.SHORT);
  };
  // A Peruvian number goes with +51: without it the phone book read it as a US one.
  const number = toInternationalPhone(contact.phone) ? `+${toInternationalPhone(contact.phone)}` : contact.phone;
  const add = () => {
    void Contacts.presentFormAsync(null, { contactType: Contacts.ContactTypes.Person, name: contact.name, firstName: contact.name, phoneNumbers: [{ number, label: 'mobile' }] }).catch(() => ToastAndroid.show('No se pudo abrir la agenda.', ToastAndroid.SHORT));
  };

  return (
    <View testID="tarjeta-contacto" className="min-w-[230px] px-3 pt-2.5">
      <View className="flex-row items-center gap-3">
        <Avatar nombre={contact.name} tamano={44} />
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className={`text-[15px] font-semibold ${tone}`}>{contact.name}</Text>
          <Text numberOfLines={1} className={`text-[13px] ${soft}`}>{formatPhoneDisplay(contact.phone) || contact.phone}</Text>
        </View>
      </View>
      <View className={`mt-2.5 flex-row border-t ${props.mine ? 'border-white/20' : 'border-outline/15'}`}>
        {canWrite ? (
          <Pressable testID="contacto-enviar-mensaje" onPress={() => void write()} className="min-h-[44px] flex-1 flex-row items-center justify-center gap-1.5">
            {opening ? <ActivityIndicator color={iconColor} /> : <MessageCircle size={16} color={iconColor} />}
            <Text className={`text-[13px] font-semibold ${props.mine ? tone : 'text-primary'}`}>Enviar mensaje</Text>
          </Pressable>
        ) : null}
        <Pressable testID="contacto-agregar" onPress={add} className="min-h-[44px] flex-1 flex-row items-center justify-center gap-1.5">
          <UserPlus size={16} color={iconColor} />
          <Text className={`text-[13px] font-semibold ${props.mine ? tone : 'text-primary'}`}>Agregar</Text>
        </Pressable>
      </View>
    </View>
  );
}
