import mongoose, { Schema, type Model, type Types } from 'mongoose';

/**
 * Espejo mínimo local (spec §7). La CREDENCIAL vive en constroad-auth (hash
 * del secreto); acá solo lo operativo: quién es cada uno y a qué teléfono
 * empujar.
 *
 * El `?? mongoose.model(...)` existe por los tests: vitest puede evaluar este
 * módulo más de una vez y re-declarar un modelo revienta.
 */

export interface Invitation {
  /** La IDENTIDAD: celular local de 9 dígitos. */
  phone: string;
  /**
   * Canal de RESPALDO. El código va por WhatsApp (constroad-auth lo decide por
   * el formato del destino), y esta app existe justamente para sobrevivir a que
   * WhatsApp se caiga: sin un segundo canal, el día que se cae nadie puede
   * enrolar un teléfono nuevo.
   */
  email?: string;
  invitedBy: string;
  status: 'invited' | 'revoked';
}

export interface User {
  _id: Types.ObjectId;
  phone: string;
  email?: string;
  name?: string;
  avatarMediaId?: string;
}

export interface Device {
  deviceId: string;
  userId: Types.ObjectId;
  platform: 'android' | 'web';
  pushToken?: string;
  /** Clave pública X25519 en base64, para los chats cifrados (F9). */
  publicKey?: string;
  lastSeenAt?: Date;
}

const invitationSchema = new Schema<Invitation>(
  {
    phone: { type: String, required: true, unique: true, trim: true },
    email: { type: String, lowercase: true, trim: true },  // sparse: ver abajo
    invitedBy: { type: String, required: true },
    status: { type: String, enum: ['invited', 'revoked'], default: 'invited' },
  },
  { timestamps: true }
);

const userSchema = new Schema<User>(
  {
    phone: { type: String, required: true, unique: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    name: { type: String },
    avatarMediaId: { type: String },
  },
  { timestamps: true }
);
/**
 * `sparse` es OBLIGATORIO acá y costó un E2E descubrirlo.
 *
 * Cuando el email era la identidad, este índice era `unique` a secas. Al pasar
 * la identidad al teléfono el campo quedó opcional — pero **el índice viejo
 * sigue en la base**: mongoose no borra índices que ya no declara. Resultado:
 * el SEGUNDO usuario sin correo choca con `dup key: { email: null }`.
 *
 * Un test con base en memoria jamás lo ve, porque arranca sin índices previos.
 * El índice viejo se borra con `scripts/fix-indexes.ts`.
 */
userSchema.index({ email: 1 }, { unique: true, sparse: true });

const deviceSchema = new Schema<Device>(
  {
    deviceId: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    platform: { type: String, enum: ['android', 'web'], default: 'android' },
    pushToken: { type: String },
    // La clave PÚBLICA X25519 del dispositivo (F9). La privada nunca sale de él.
    publicKey: { type: String },
    lastSeenAt: { type: Date },
  },
  { timestamps: true }
);

export const InvitationModel: Model<Invitation> =
  (mongoose.models.Invitation as Model<Invitation>) ??
  mongoose.model<Invitation>('Invitation', invitationSchema);
export const UserModel: Model<User> =
  (mongoose.models.User as Model<User>) ?? mongoose.model<User>('User', userSchema);
export const DeviceModel: Model<Device> =
  (mongoose.models.Device as Model<Device>) ?? mongoose.model<Device>('Device', deviceSchema);
