import { useCallback, useEffect } from 'react';
import { DRIVE_PASTE_EMPTY, pastedDriveName } from '@lilachat/shared';

/** A file pasted from the clipboard, named as the Drive names it (a screenshot by its time). */
export const asPastedFile = (file: Blob & { name?: string }, now = new Date()): File => new File([file], pastedDriveName(file.name ?? '', file.type, now), { type: file.type });

/** Where Ctrl+V types text instead of uploading. */
const typesText = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/**
 * «Pegar» in the service's Drive (José 19/11, design cc-05): Ctrl+V anywhere on the Drive uploads
 * the copied image or file; the button reads the clipboard, which only gives images. `onEmpty`
 * says there was nothing to paste.
 */
export function useDrivePaste(onFile: (file: File) => void, onEmpty: (text: string) => void) {
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (typesText(event.target)) return;
      const file = event.clipboardData?.files[0];
      if (!file) return;
      event.preventDefault();
      onFile(asPastedFile(file));
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [onFile]);
  return useCallback(async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((one) => one.startsWith('image/'));
        if (type) return onFile(asPastedFile(await item.getType(type)));
      }
      onEmpty(DRIVE_PASTE_EMPTY);
    } catch (error) {
      console.warn('drive: clipboard read refused', (error as Error).name);
      onEmpty(DRIVE_PASTE_EMPTY);
    }
  }, [onFile, onEmpty]);
}
