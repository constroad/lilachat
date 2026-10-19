/**
 * «Chrome en macOS»: el nombre con que el teléfono pregunta «¿Vincular…?» y la
 * lista de dispositivos vinculados lo muestra (W5). Sale del User-Agent, así
 * que es orientativo: sirve para reconocer la computadora, no para confiar en
 * ella. El orden importa: Edge y Opera también dicen «Chrome», y Chrome también
 * dice «Safari».
 */
const NAVEGADORES: [RegExp, string][] = [
  [/\bEdg(?:e|A|iOS)?\//, 'Edge'],
  [/\bOPR\/|\bOpera\b/, 'Opera'],
  [/\bFirefox\/|\bFxiOS\//, 'Firefox'],
  [/\bChrome\/|\bCriOS\//, 'Chrome'],
  [/\bVersion\/[\d.]+.*Safari\//, 'Safari'],
];

const SISTEMAS: [RegExp, string][] = [
  [/\biPad\b/, 'iPadOS'],
  [/\biPhone\b/, 'iOS'],
  [/\bAndroid\b/, 'Android'],
  [/\bCrOS\b/, 'ChromeOS'],
  [/\bMacintosh\b|\bMac OS X\b/, 'macOS'],
  [/\bWindows\b/, 'Windows'],
  [/\bLinux\b/, 'Linux'],
];

const buscar = (lista: [RegExp, string][], agente: string): string | null =>
  lista.find(([patron]) => patron.test(agente))?.[1] ?? null;

export function nombreDelNavegador(agente: string | undefined): string {
  const texto = agente ?? '';
  const navegador = buscar(NAVEGADORES, texto);
  const sistema = buscar(SISTEMAS, texto);
  if (!sistema) return navegador ?? 'Navegador';
  return `${navegador ?? 'Navegador'} en ${sistema}`;
}
