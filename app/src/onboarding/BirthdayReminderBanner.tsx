import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Cake, X } from 'lucide-react-native';
import type { MyProfile } from '@lilachat/shared';
import type { Credential } from '../auth/credentialStore';
import { Modal } from '../ui/Modal';
import { useColores } from '../ui/tema';
import { CompleteProfileScreen } from './CompleteProfileScreen';
import { useBirthdayReminder } from './useBirthdayReminder';

/**
 * «Agrega tu cumpleaños» on top of the chat list (José, 14/11), shaped like
 * the update band: it shows, covers nothing and can be put away. «Agregar»
 * opens the profile with its birthday boxes; «Ahora no» hides it on this phone
 * for a few days. It goes away for good once the birthday is saved.
 */
export function BirthdayReminderBanner({ credential }: { credential: Credential }) {
  const colors = useColores();
  const reminder = useBirthdayReminder(credential.jwt, credential.userId);
  const [editing, setEditing] = useState(false);
  if (!reminder.profile) return null;
  const saved = (profile: MyProfile) => {
    setEditing(false);
    reminder.done(profile);
  };
  return (
    <View testID="banda-cumpleanos" className="mx-4 mb-2 mt-1 rounded-xl bg-primary/[0.08] p-3">
      <View className="flex-row items-center gap-3">
        <Cake size={18} color={colors.primary} />
        <View className="min-w-0 flex-1">
          <Text className="text-[13px] font-semibold text-on-surface">Agrega tu cumpleaños</Text>
          <Text className="text-[11px] leading-4 text-on-surface-variant">Así tus grupos sabrán cuándo saludarte.</Text>
        </View>
        <Pressable testID="btn-cumpleanos-agregar" accessibilityRole="button" onPress={() => setEditing(true)} className="min-h-[44px] items-center justify-center rounded-full bg-primary px-4">
          <Text className="text-[13px] font-bold text-on-primary">Agregar</Text>
        </Pressable>
        <Pressable testID="btn-cumpleanos-ahora-no" accessibilityRole="button" accessibilityLabel="Ahora no" onPress={reminder.dismiss} className="h-11 w-11 items-center justify-center">
          <X size={16} color={colors['on-surface-variant']} />
        </Pressable>
      </View>
      <Modal visible={editing} animationType="slide" onRequestClose={() => setEditing(false)} statusBarTranslucent fullWindow>
        {editing ? <CompleteProfileScreen credential={credential} profile={reminder.profile} onDone={saved} onCancel={() => setEditing(false)} /> : null}
      </Modal>
    </View>
  );
}
