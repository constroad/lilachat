import { photoRemovalLine, removablePhotoId, REMOVE_PHOTO_QUESTION, type FieldDocument, type FormSection, type PhotoRemoval } from '@lilachat/shared';
import type { ViewerRemoval } from '../PortalFileViewer';
import type { ConfirmRequest } from '../../../ui/useConfirm';

/** «Eliminar» of the viewer on a report's photo: the person confirms, and a refusal is said, since the row may be far down the page. */
export const photoRemovalOf = (report: FieldDocument | null, section: FormSection, removePhoto: (photoId: string) => Promise<PhotoRemoval>, ask: (request: ConfirmRequest) => Promise<boolean>): ViewerRemoval => {
  const idOf = (url: string): string | null => (report ? removablePhotoId(report, section, url) : null);
  return {
    canRemove: (url) => Boolean(idOf(url)),
    async remove(url) {
      const photoId = idOf(url);
      if (!photoId || !(await ask({ title: REMOVE_PHOTO_QUESTION, text: photoRemovalLine(section, url), confirmLabel: 'Quitar' }))) return false;
      void removePhoto(photoId).then((removal) => {
        if (!removal.ok) window.alert(removal.message);
      });
      return true;
    },
  };
};
