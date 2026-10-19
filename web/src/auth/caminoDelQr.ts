import qrcode from 'qrcode-generator';

/**
 * El QR como UN camino SVG (W5): nítido a cualquier tamaño y sin canvas.
 * Corrección Q (25 %): el logo del centro tapa ~4 % y el teléfono lo lee
 * igual. Con H salía tan denso (versión 9) que costaba enfocarlo. Cada fila se recorre en tramos: un `h` por tramo oscuro, no un
 * rectángulo por módulo (un QR de versión 6 son 1 681 módulos).
 */
export function caminoDelQr(texto: string): { modulos: number; d: string } {
  const qr = qrcode(0, 'Q');
  qr.addData(texto);
  qr.make();
  const modulos = qr.getModuleCount();
  const tramos: string[] = [];
  for (let fila = 0; fila < modulos; fila += 1) {
    let columna = 0;
    while (columna < modulos) {
      if (!qr.isDark(fila, columna)) {
        columna += 1;
        continue;
      }
      const desde = columna;
      while (columna < modulos && qr.isDark(fila, columna)) columna += 1;
      tramos.push(`M${desde} ${fila}h${columna - desde}v1h-${columna - desde}z`);
    }
  }
  return { modulos, d: tramos.join('') };
}
