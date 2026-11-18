import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pdfThumbnail } from './pdfThumbnail.js';

/** A real, minimal PDF of `pages` A4 pages with a filled box on each, built by hand (xref offsets included). */
function tinyPdf(pages: number): Buffer {
  const objects: string[] = [];
  const kids = Array.from({ length: pages }, (_, index) => `${3 + index * 2} 0 R`).join(' ');
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pages} >>`);
  for (let index = 0; index < pages; index += 1) {
    const content = '0.2 0.3 0.8 rg 72 600 300 150 re f';
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${4 + index * 2} 0 R >>`);
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  }
  let body = '%PDF-1.4\n';
  const offsets = objects.map((object, index) => {
    const at = body.length;
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return at;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((at) => `${String(at).padStart(10, '0')} 00000 n \n`).join('')}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

const JPEG_MAGIC = [0xff, 0xd8, 0xff];

describe('pdfThumbnail (José 17/11: a PDF in the chat shows its first page, like WhatsApp)', () => {
  it('draws the first page as a JPEG and counts the pages', async () => {
    const folder = await mkdtemp(path.join(tmpdir(), 'pdf-thumb-'));
    await writeFile(path.join(folder, 'cot.pdf'), tinyPdf(3));
    const made = await pdfThumbnail(path.join(folder, 'cot.pdf'), path.join(folder, 'cot.jpg'));
    expect(made).toEqual({ made: true, pages: 3 });
    expect([...(await readFile(path.join(folder, 'cot.jpg'))).subarray(0, 3)]).toEqual(JPEG_MAGIC);
  });

  it('says no for a file that is not a PDF, without throwing', async () => {
    const folder = await mkdtemp(path.join(tmpdir(), 'pdf-thumb-'));
    await writeFile(path.join(folder, 'roto.pdf'), Buffer.from('no soy un pdf'));
    expect(await pdfThumbnail(path.join(folder, 'roto.pdf'), path.join(folder, 'roto.jpg'))).toEqual({ made: false });
  });
});
