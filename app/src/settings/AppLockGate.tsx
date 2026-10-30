import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Fingerprint } from 'lucide-react-native';
import { Logo } from '../ui/Logo';
import { useColores } from '../ui/tema';
import { useAppLock } from './appLock';

/** Covers the chats while the app lock asks (pending 9); calls stay above it, like WhatsApp. */
export function AppLockGate() {
  const colores = useColores();
  const { locked, unlock } = useAppLock();
  useEffect(() => {
    if (locked) void unlock();
  }, [locked, unlock]);
  if (!locked) return null;
  return (
    <View testID="bloqueo-de-la-app" style={[StyleSheet.absoluteFill, { backgroundColor: colores.background }]} className="items-center justify-center gap-4 px-8">
      <Logo tamano={56} />
      <Text className="text-[18px] font-bold text-on-surface">Lilachat está bloqueado</Text>
      <Text className="text-center text-[14px] text-on-surface-variant">Usa tu huella, tu rostro o el bloqueo del teléfono para entrar.</Text>
      <Pressable testID="btn-desbloquear-app" accessibilityRole="button" onPress={() => void unlock()} className="mt-2 min-h-[48px] flex-row items-center gap-2 rounded-full bg-primary px-6">
        <Fingerprint size={20} color={colores['on-primary']} />
        <Text className="text-[15px] font-semibold text-on-primary">Desbloquear</Text>
      </Pressable>
    </View>
  );
}
