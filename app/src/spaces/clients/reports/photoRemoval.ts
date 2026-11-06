import { Alert } from 'react-native';
import { photoRemovalLine, removablePhotoId, REMOVE_PHOTO_LABEL, REMOVE_PHOTO_QUESTION, type FieldDocument, type FormSection, type PhotoRemoval } from '@lilachat/shared';
import type { ViewerRemoval } from '../useFileViewer';

const REMOVAL_REFUSED = 'No se quitó la foto';

/** «Eliminar» of the viewer on a report's photo: the person confirms, and a refusal is said, since the row may be far down the screen. */
export const photoRemovalOf = (report: FieldDocument | null, section: FormSection, removePhoto: (photoId: string) => Promise<PhotoRemoval>): ViewerRemoval => {
  const idOf = (url: string): string | null => (report ? removablePhotoId(report, section, url) : null);
  const removeNow = (photoId: string) => {
    void removePhoto(photoId).then((removal) => {
      if (!removal.ok) Alert.alert(REMOVAL_REFUSED, removal.message);
    });
  };
  return {
    canRemove: (url) => Boolean(idOf(url)),
    remove(url) {
      const photoId = idOf(url);
      if (!photoId) return;
      Alert.alert(REMOVE_PHOTO_QUESTION, photoRemovalLine(section, url), [{ text: 'Cancelar', style: 'cancel' }, { text: REMOVE_PHOTO_LABEL, style: 'destructive', onPress: () => removeNow(photoId) }]);
    },
  };
};
