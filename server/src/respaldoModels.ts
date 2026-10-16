import mongoose, { Schema, type Model, type Types } from 'mongoose';

/**
 * El índice de los respaldos que suben los teléfonos (F12.1). El ARCHIVO es la
 * verdad (vive en el disco externo de la mini, con su copia restic); esto es
 * el catálogo: qué tiene cada persona, con qué huella y de cuándo.
 *
 * El server no puede abrirlos —van cifrados con la passphrase del usuario— y
 * tampoco necesita: solo los guarda, los deduplica y los devuelve.
 */
export interface Respaldo {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  /** El nombre del archivo en `<teléfono>/respaldos/`. */
  nombre: string;
  /** sha256 de los bytes, calculada por el server al recibir. */
  huella: string;
  bytes: number;
  creadoEn: Date;
}

const respaldoSchema = new Schema<Respaldo>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    nombre: { type: String, required: true },
    huella: { type: String, required: true },
    bytes: { type: Number, required: true },
    creadoEn: { type: Date, required: true },
  },
  { timestamps: true }
);
// La deduplicación, en la BASE: dos subidas del mismo respaldo que corren a la
// vez terminan en «ya existe», no en dos archivos.
respaldoSchema.index({ userId: 1, huella: 1 }, { unique: true });
// «El último» y la retención se preguntan por persona y por fecha.
respaldoSchema.index({ userId: 1, creadoEn: -1 });

export const RespaldoModel: Model<Respaldo> =
  (mongoose.models.Respaldo as Model<Respaldo>) ?? mongoose.model<Respaldo>('Respaldo', respaldoSchema);
