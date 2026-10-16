/**
 * Los tipos que comparten el teléfono y el server. Nada de acá importa
 * `react-native` ni `node`: es lo que permite testear cada decisión en Jest
 * o Vitest en menos de un segundo.
 *
 * Nacieron en Lilafotos (`shared/tipos.ts`, 14/09/2026) y se copiaron acá el
 * 15/09 para que Lilachat respalde sus conversaciones por el MISMO camino. Lo
 * que era de fotos (`tipo: foto|video`, la fecha local de captura) se quedó
 * allá: cada app extiende `ElementoDelRollo` con lo suyo.
 */

/** sha256 en hexadecimal minúscula, 64 caracteres. Es la identidad de un archivo. */
export type Huella = string;

/**
 * Lo que el teléfono sabe de algo que hay que subir SIN haberlo leído. «Rollo»
 * viene del rollo de la cámara; para Lilachat es la carpeta de respaldos. Es lo
 * mismo: una lista local de archivos de los que hay que asegurar una copia.
 */
export type ElementoDelRollo = {
  /** Id estable mientras el archivo exista; cambia si se borra y se vuelve a crear. */
  id: string;
  nombre: string;
  bytes: number;
  /** Epoch ms de cuándo se produjo (captura de la foto, momento del respaldo). Ordena la subida. */
  capturadoEn: number;
  /** Epoch ms de la última modificación del archivo en el teléfono. */
  modificadoEn: number;
};

/**
 * Lo que queda anotado en el teléfono después de una subida, o de que el
 * server dijera «ya lo tengo». Congela bytes y modificación del momento en que
 * se calculó la huella: una edición posterior tiene que volver a salir.
 */
export type AsientoDelLibro = {
  id: string;
  huella: Huella;
  bytes: number;
  modificadoEn: number;
  subidoEn: number;
};

/** El libro del teléfono: por id del rollo. */
export type Libro = ReadonlyMap<string, AsientoDelLibro>;

/** Lo que el sistema informa en el momento de decidir si se sube. */
export type Condiciones = {
  cargando: boolean;
  wifi: boolean;
  /** Un hotspot ajeno o un wifi que Android marca como medido. */
  wifiMedido: boolean;
  /** `null` cuando el sistema no lo informa. */
  bateriaPct: number | null;
};

export type MotivoDeEspera = 'sin_wifi' | 'wifi_medido' | 'sin_carga' | 'bateria_baja';

export type Veredicto = { puede: true } | { puede: false; motivo: MotivoDeEspera };
