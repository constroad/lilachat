import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BellRing, X } from 'lucide-react-native';
import type { ContactNote } from '@lilachat/shared';
import { useColores } from '../ui/tema';
import { saveRoutines } from './routinesApi';

/**
 * «Recordar la próxima vez que hables» (pending 17): opening the 1:1 shows my
 * note on top. «Listo» clears it for good; the X only hides it until next time.
 */
export function ContactNoteBanner(props: { chatId: string; jwt: string; note?: ContactNote }) {
  const colors = useColores();
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    setHidden(false);
  }, [props.note?.text]);
  if (!props.note || hidden) return null;
  const done = async () => {
    setHidden(true);
    if (await saveRoutines(props.jwt, props.chatId, { contactNote: null })) setHidden(false);
  };
  return (
    <View testID="aviso-nota-contacto" className="mx-3 mt-2 flex-row items-center gap-3 rounded-xl border border-primary/25 bg-primary/[0.06] px-3 py-2">
      <BellRing size={18} color={colors.primary} />
      <Text className="min-w-0 flex-1 text-[14px] text-on-surface" numberOfLines={3}>{props.note.text}</Text>
      <Pressable testID="btn-nota-lista" onPress={() => void done()} className="h-9 justify-center rounded-full px-3">
        <Text className="text-[13px] font-semibold text-primary">Listo</Text>
      </Pressable>
      <Pressable testID="btn-ocultar-nota" accessibilityLabel="Ocultar" onPress={() => setHidden(true)} className="h-9 w-9 items-center justify-center">
        <X size={16} color={colors['on-surface-variant']} />
      </Pressable>
    </View>
  );
}
