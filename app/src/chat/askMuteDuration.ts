import { Alert } from 'react-native';
import { MUTE_OPTIONS, type MuteFor } from '@lilachat/shared';

/**
 * «Silenciar notificaciones: 8 horas · 1 semana · Siempre», the WhatsApp
 * dialog (R31/10). Tapping outside cancels: nothing is muted.
 */
export function askMuteDuration(onPick: (muteFor: MuteFor) => void): void {
  Alert.alert(
    'Silenciar notificaciones',
    'Los demás no sabrán que silenciaste este chat.',
    MUTE_OPTIONS.map((option) => ({ text: option.label, onPress: () => onPick(option.key) })),
    { cancelable: true }
  );
}
