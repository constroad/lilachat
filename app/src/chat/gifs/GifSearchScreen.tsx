import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ArrowLeft, X } from 'lucide-react-native';
import { Modal } from '../../ui/Modal';
import { useColores } from '../../ui/tema';
import { useMargenes } from '../../ui/useMargenes';
import { GifChips, GifGrid, useGifSearch, useGifSend } from './GifGrid';

/** Full screen there is room for three columns, like WhatsApp's search. */
const SEARCH_COLUMNS = 3;

/**
 * Searching GIFs full screen (pending 59, José 22/10, like WhatsApp): «← Buscar
 * GIF» with the keyboard up and the results under it. Picking one sends it and
 * comes back to the chat; «←» comes back to the panel.
 */
export function GifSearchScreen(props: { visible: boolean; jwt: string; chatId: string; onClose: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const [text, setText] = useState('');
  const search = useGifSearch(props.jwt, text.trim());
  const { send, error } = useGifSend(props.jwt, props.chatId);
  useEffect(() => {
    if (props.visible) setText('');
  }, [props.visible]);

  return (
    <Modal visible={props.visible} animationType="slide" onRequestClose={props.onClose}>
      <View testID="buscar-gif-pantalla" className="flex-1 bg-background" style={{ paddingTop: margins.cabecera, paddingBottom: margins.pie }}>
        <View className="mx-3 mt-2 h-12 flex-row items-center gap-1 rounded-full bg-surface pl-1 pr-2">
          <Pressable testID="btn-cerrar-buscar-gif" accessibilityLabel="Volver al panel" onPress={props.onClose} className="h-11 w-11 items-center justify-center">
            <ArrowLeft size={20} color={colors['on-surface']} />
          </Pressable>
          <TextInput testID="campo-buscar-gif" value={text} onChangeText={setText} autoFocus placeholder="Buscar GIF" placeholderTextColor={colors.outline} returnKeyType="search" className="min-w-0 flex-1 text-[16px] text-on-surface" />
          {text ? (
            <Pressable testID="btn-limpiar-buscar-gif" accessibilityLabel="Borrar la búsqueda" onPress={() => setText('')} className="h-10 w-10 items-center justify-center">
              <X size={18} color={colors['on-surface-variant']} />
            </Pressable>
          ) : null}
        </View>
        <GifChips query={text.trim()} onPick={setText} />
        {error ? <Text className="px-4 pb-1 text-[13px] text-error">{error}</Text> : null}
        <GifGrid
          search={search}
          columns={SEARCH_COLUMNS}
          onPick={(gif) =>
            void send(gif).then((sent) => {
              if (sent) props.onClose();
            })
          }
        />
        <Text className="py-1.5 text-center text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Powered by GIPHY</Text>
      </View>
    </Modal>
  );
}
