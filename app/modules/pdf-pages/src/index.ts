import { requireOptionalNativeModule } from 'expo';
export type OpenedPdf = { id: string; pages: { width: number; height: number }[] };
export type DrawnPage = { uri: string; width: number; height: number };

type PdfPages = {
  /** Opens a local PDF (`file://…`). Rejects with `ERR_PDF_PROTECTED` when it has a password. */
  open(uri: string): Promise<OpenedPdf>;
  /** One page as a JPEG `width` pixels wide, drawn on demand and kept until `close`. */
  renderPage(id: string, index: number, width: number): Promise<DrawnPage>;
  /** Frees the PDF and deletes its drawn pages. */
  close(id: string): Promise<void>;
};

/**
 * PDFs inside the app (pending 7) with Android's PdfRenderer. Optional: in a
 * build without the module it is `null` and a PDF opens with another app, as
 * before.
 */
export const pdfPages = requireOptionalNativeModule<PdfPages>('PdfPages');
