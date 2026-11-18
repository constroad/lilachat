import { readFile } from 'node:fs/promises';

/**
 * The first page of a PDF as a JPEG (José 17/11: «no se muestra el preview o thumbnail en pdf»), like WhatsApp's
 * card. pdf.js reads it and @napi-rs/canvas draws it, both from npm: the mini needs no poppler. A PDF that does not
 * open (damaged, with a password) only goes without its picture.
 */
const THUMB_WIDTH = 480;
const THUMB_QUALITY = 72;
const RENDER_TIMEOUT_MS = 15_000;
/** Beyond this a PDF is a book: the card says its pages, and drawing page 1 still costs the same. */
const MAX_PDF_BYTES = 40 * 1024 * 1024;

export type PdfThumbnail = { made: true; pages: number } | { made: false };

async function render(pdfPath: string, thumbPath: string): Promise<PdfThumbnail> {
  const bytes = await readFile(pdfPath);
  if (bytes.length > MAX_PDF_BYTES) return { made: false };
  const [{ getDocument }, { createCanvas }, { default: sharp }] = await Promise.all([import('pdfjs-dist/legacy/build/pdf.mjs'), import('@napi-rs/canvas'), import('sharp')]);
  const document = await getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, disableFontFace: true, useSystemFonts: false, verbosity: 0 }).promise;
  try {
    const page = await document.getPage(1);
    const unscaled = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: THUMB_WIDTH / unscaled.width });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext('2d');
    // A page draws on white paper; a transparent canvas would turn into black in the JPEG.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context as unknown as CanvasRenderingContext2D, viewport }).promise;
    await sharp(await canvas.encode('png')).jpeg({ quality: THUMB_QUALITY, mozjpeg: true }).toFile(thumbPath);
    return { made: true, pages: document.numPages };
  } finally {
    await document.destroy();
  }
}

export async function pdfThumbnail(pdfPath: string, thumbPath: string): Promise<PdfThumbnail> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<PdfThumbnail>((resolve) => {
    timer = setTimeout(() => resolve({ made: false }), RENDER_TIMEOUT_MS);
  });
  try {
    return await Promise.race([render(pdfPath, thumbPath), timeout]);
  } catch (error) {
    console.warn(`[pdf] sin miniatura: ${(error as Error).message}`);
    return { made: false };
  } finally {
    clearTimeout(timer);
  }
}
