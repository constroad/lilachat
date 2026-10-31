import { describe, expect, it } from 'vitest';
import { exportChatText, exportFileName, fileNameFromDisposition, exportLine, exportStamp, isTimeZone, type ExportRow } from './chatExport.js';

const NOW = Date.parse('2026-10-31T20:00:00Z');
const names: Record<string, string> = { a: 'Ana', b: 'Beto' };
const nameOf = (id: string) => names[id] ?? 'Alguien';
const row = (extra: Partial<ExportRow>): ExportRow => ({ senderId: 'a', kind: 'text', body: 'hola', at: '2026-10-31T19:05:00Z', ...extra });

describe('«Exportar chat» (R31/10-B7)', () => {
  it('writes each message as WhatsApp does, in the reader zone', () => {
    // Act / Assert
    expect(exportLine(row({}), nameOf, 'America/Lima', NOW)).toBe('31/10/2026, 14:05 - Ana: hola');
    expect(exportStamp('2026-10-31T19:05:00Z', 'Europe/Madrid')).toBe('31/10/2026, 20:05');
  });

  it('names the media, keeps the caption, says what was deleted and marks thread replies', () => {
    expect(exportLine(row({ kind: 'image', body: 'la losa' }), nameOf, 'America/Lima', NOW)).toBe('31/10/2026, 14:05 - Ana: <Foto omitida> la losa');
    expect(exportLine(row({ kind: 'file', body: '', media: { name: 'informe.pdf' } }), nameOf, 'America/Lima', NOW)).toBe('31/10/2026, 14:05 - Ana: <Archivo: informe.pdf>');
    expect(exportLine(row({ deletedAt: '2026-10-31T19:06:00Z', body: undefined }), nameOf, 'America/Lima', NOW)).toBe('31/10/2026, 14:05 - Ana: Se eliminó este mensaje');
    expect(exportLine(row({ senderId: 'b', hiloDe: 4, body: 'listo' }), nameOf, 'America/Lima', NOW)).toBe('31/10/2026, 14:05 - Beto: (en un hilo) listo');
  });

  it('writes a notice in third person, and leaves out what disappeared', () => {
    expect(exportLine(row({ kind: 'system', body: 'x', system: { evento: 'nombre', valor: 'Obra Norte', quien: { name: 'Ana' } } }), nameOf, 'America/Lima', NOW)).toBe('31/10/2026, 14:05 - Ana cambió el nombre del grupo a «Obra Norte»');
    expect(exportLine(row({ disappearsAt: '2026-10-31T19:30:00Z' }), nameOf, 'America/Lima', NOW)).toBeNull();
  });

  it('joins the lines oldest first; an empty chat is an empty file', () => {
    expect(exportChatText([row({}), row({ senderId: 'b', body: 'chau' })], nameOf, 'America/Lima', NOW)).toBe('31/10/2026, 14:05 - Ana: hola\n31/10/2026, 14:05 - Beto: chau\n');
    expect(exportChatText([], nameOf)).toBe('');
  });

  it('an unknown zone falls back to Lima; the file name has no forbidden characters', () => {
    expect(isTimeZone('America/Lima')).toBe(true);
    expect(isTimeZone('Marte/Base')).toBe(false);
    expect(isTimeZone('../etc')).toBe(false);
    expect(exportStamp('2026-10-31T19:05:00Z', 'Marte/Base')).toBe('31/10/2026, 14:05');
    expect(exportFileName('Obra: Norte/Sur')).toBe('Chat de Lilachat con Obra Norte Sur.txt');
    expect(exportFileName('  ')).toBe('Chat de Lilachat con el chat.txt');
  });

  it('a client reads the name back from Content-Disposition, or keeps its fallback', () => {
    expect(fileNameFromDisposition(`attachment; filename="chat.txt"; filename*=UTF-8''${encodeURIComponent('Chat de Lilachat con Beto.txt')}`, 'x.txt')).toBe('Chat de Lilachat con Beto.txt');
    expect(fileNameFromDisposition(null, 'x.txt')).toBe('x.txt');
    expect(fileNameFromDisposition("attachment; filename*=UTF-8''%E0%A4%A", 'x.txt')).toBe('x.txt');
  });
});
