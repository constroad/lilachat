import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detailSheet, draftToContinue, EDITOR_REPORT_TYPE_OPTIONS, REPORT_TYPE_OPTIONS, serviceDetailOf, type ServiceDetail } from '@lilachat/shared';

/**
 * José 16/11: the APK creates only the types of Portal's public services page; only the web opens Portal's editor
 * 2.0. The APK has no WebView for it: its picker (`CreateReportSheet`) lists the public page's types, and a report
 * row continues a form (`draftToContinue`) or opens its sheet (`detailSheet`), whatever Portal marks.
 */
const SOURCE = join(__dirname, '..', '..', '..');
const APP_ROOT = join(SOURCE, '..');
/** What opens or creates a report in Portal's editor: the web's doors, never the APK's. */
const EDITOR_DOORS = /\b(opensEmbed|createsInEmbed|EMBED_CREATE_TYPES|EDITOR_REPORT_TYPE_OPTIONS|pickerReportTypes|reportEmbedPath|reportEmbedCreatePath|embedCreateRequest)\b/;
const PORTAL_URL = 'https://www.constroad.com/admin/service-management/srv-318';
const PDF_URL = 'https://lila.constroad.com/f/panel.pdf';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/** A service whose reports come as Portal's list sends them to an admin: marked for the editor. */
function serviceWith(reports: Record<string, unknown>[]): ServiceDetail {
  const detail = serviceDetailOf({ service: { id: 'srv-318', name: 'Pavimentación', url: PORTAL_URL }, orders: [], dispatches: [], reports });
  if (!detail) throw new Error('the service detail did not parse');
  return detail;
}

describe('the APK creates only the public page\'s types (José 16/11)', () => {
  it('its picker lists none of Portal\'s block sheets', () => {
    // Arrange
    const blockSheets = EDITOR_REPORT_TYPE_OPTIONS.map((option) => option.code);
    // Act
    const offered = REPORT_TYPE_OPTIONS.map((option) => option.code);
    // Assert
    expect(blockSheets).toHaveLength(9);
    expect(offered.filter((code) => blockSheets.includes(code))).toEqual([]);
    expect(offered).toEqual(['CTL-IMP', 'IAA', 'CTL-PIS', 'CON-CAP', 'RCP-CAM', 'REG-OBS', 'LEV-OBS', 'FRE-PAV', 'SOL-IMP']);
  });

  it('a block sheet marked editor v2, draft or published, opens its sheet with the PDF and «Abrir en el Portal», never a form', () => {
    // Arrange
    const detail = serviceWith([
      { id: 'r-met', title: 'Cuadro Resumen de Metrado · 16 de noviembre', type_label: 'Cuadro Resumen de Metrado', status_label: 'Borrador', tone: 'warn', url: PORTAL_URL, editor: 'v2' },
      { id: 'r-pnl', title: 'Panel fotográfico de obra · 16 de noviembre', type_label: 'Panel fotográfico de obra', status_label: 'Publicado', tone: 'ok', url: PORTAL_URL, pdf_url: PDF_URL, editor: 'v2' },
    ]);
    // Act
    const forms = detail.reports.map((report) => draftToContinue(detail, report.id));
    const draft = detailSheet(detail, 'reports', 'r-met');
    const published = detailSheet(detail, 'reports', 'r-pnl');
    // Assert
    expect(detail.reports.map((report) => report.editor)).toEqual(['v2', 'v2']);
    expect(forms).toEqual([null, null]);
    expect(draft).toMatchObject({ pdfOnDemand: 'r-met', url: PORTAL_URL });
    expect(published).toMatchObject({ files: [{ url: PDF_URL, label: 'PDF' }], url: PORTAL_URL });
  });

  it('no screen of the APK reaches Portal\'s report editor', () => {
    // Arrange
    const files = [...sourceFiles(SOURCE), join(APP_ROOT, 'App.tsx')];
    // Act
    const offenders = files.filter((path) => EDITOR_DOORS.test(readFileSync(path, 'utf8')));
    // Assert
    expect(files.length).toBeGreaterThan(100);
    expect(offenders).toEqual([]);
  });
});
