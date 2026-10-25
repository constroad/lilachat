import { Alert, Linking } from 'react-native';
import { placeLinks } from '@lilachat/shared';

/**
 * Tapping the location of a reminder asks «¿Cómo quieres llegar?» (José 25/10): Google Maps or Waze.
 * Both are web links the phone hands to the installed app (or its browser), so no app needs to be
 * declared as visible to this one.
 */
export function askMapsOrWaze(location: string | undefined): void {
  const links = placeLinks(location);
  if (!links) return;
  const open = (url: string) => () =>
    void Linking.openURL(url).catch(() => Alert.alert('No se pudo abrir la ubicación', 'Prueba con la otra aplicación.'));
  Alert.alert('¿Cómo quieres llegar?', location!.trim(), [
    { text: 'Google Maps', onPress: open(links.maps) },
    { text: 'Waze', onPress: open(links.waze) },
    { text: 'Cancelar', style: 'cancel' },
  ]);
}
