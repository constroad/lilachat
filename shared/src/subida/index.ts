/**
 * La subida de archivos del teléfono al disco de la mini: el corredor, las
 * reglas de cuándo, la huella y el dedup. Copiado de Lilafotos el 15/09/2026
 * para el respaldo de conversaciones (F12.1, spec §44); genérico en `E` para
 * que el elemento sea el archivo de respaldo. Lo que toca el disco vive en el
 * server (`disco.ts`, `plazo.ts`). Decisión de José: copia, no paquete
 * compartido.
 */
export * from './tipos.js';
export * from './constantes.js';
export * from './huella.js';
export * from './recepcion.js';
export * from './conciliarRollo.js';
export * from './planDeSubida.js';
export * from './subida.js';
