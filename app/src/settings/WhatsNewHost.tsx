import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Sparkles } from 'lucide-react-native';
import { notesToShow, RELEASE_NOTES, type ReleaseNote } from '@lilachat/shared';
import { Modal } from '../ui/Modal';
import { useColores } from '../ui/tema';
import { versionActual } from './versionApi';

const SEEN_KEY = 'lilachat.novedades.vista';

/**
 * «Novedades» after updating (pending 66, José 23/10), like WhatsApp Web's:
 * what the version brings, once, then «Entendido». The notes come from the
 * shared catalog, the same one published to LilaStore.
 */
export function WhatsNewHost() {
  const colors = useColores();
  const [notes, setNotes] = useState<ReleaseNote[]>([]);
  const current = versionActual();
  useEffect(() => {
    if (!current) return;
    void AsyncStorage.getItem(SEEN_KEY)
      .then((seen) => setNotes(notesToShow(RELEASE_NOTES, seen, current)))
      .catch(() => setNotes([]));
  }, [current]);
  const close = () => {
    setNotes([]);
    void AsyncStorage.setItem(SEEN_KEY, current).catch(() => undefined);
  };
  if (notes.length === 0) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <View testID="novedades-de-la-version" className="max-h-[80%] w-full max-w-[420px] overflow-hidden rounded-3xl bg-surface">
          <View className="items-center px-6 pt-6">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-primary/10"><Sparkles size={26} color={colors.primary} /></View>
            <Text className="mt-3 text-[11px] font-bold uppercase tracking-[1.5px] text-primary">Novedades</Text>
            <Text className="mt-1 text-[20px] font-bold text-on-surface">Lilachat {notes[0]?.version}</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 16, gap: 16 }}>
            {notes.map((note) => (
              <View key={note.version} className="gap-2">
                {notes.length > 1 ? <Text className="text-[12px] font-semibold uppercase tracking-wide text-on-surface-variant">Versión {note.version}</Text> : null}
                {note.items.map((item) => (
                  <View key={item} className="flex-row gap-2.5">
                    <Text className="text-[15px] leading-[22px] text-primary">•</Text>
                    <Text className="min-w-0 flex-1 text-[15px] leading-[22px] text-on-surface">{item}</Text>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
          <View className="px-6 pb-6">
            <Pressable testID="btn-novedades-entendido" onPress={close} className="h-12 items-center justify-center rounded-full bg-primary">
              <Text className="text-[15px] font-semibold text-on-primary">Entendido</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
