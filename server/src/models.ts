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
  /** La foto del perfil (FL9), RELATIVA como toda media; se sirve absoluta. */
  avatarUrl?: string;
  /** Auto-respuesta de ausente (F11): cuando estás sin socket, el server
   *  contesta solo con este texto a los chats 1:1. */
  autoReply?: { enabled: boolean; text: string };
  /** The presence I choose and whether my «últ. vez» shows (pending 15). */
  presenceMode?: 'auto' | 'away' | 'busy' | 'invisible';
  lastSeenHidden?: boolean;
  /** People I blocked (pending 9): our 1:1 closes both ways and neither sees the other's presence. */
  blockedUsers?: Types.ObjectId[];
  /** Lists of chats of my own, in my order (pending 45). */
  chatLists?: { _id: Types.ObjectId; name: string; chatIds: string[] }[];
  /** «últ. vez» (FL10): cuándo se cerró su último socket. */
  lastSeenAt?: Date;
  /** A bot of an installed app (`bots/`): a member with a name, never a person who logs in; its `phone` is an internal key. */
  app?: { appId: Types.ObjectId; installationId: Types.ObjectId; workspaceId: Types.ObjectId };
  /** Created now and not yet announced to who invited them (`joinNotice.ts`): set only on insert. */
  joinPending?: boolean;
  /** Required to sign up (backlog 17): the year is optional; `birthdayVisible` false hides it from the chats. */
  birthday?: { day: number; month: number; year?: number };
  birthdayVisible?: boolean;
  /** When the email was proved with a code (`profileRoutes.ts`); an unverified one does not count. */
  emailVerifiedAt?: Date;
}

export interface Device {
  deviceId: string;
  userId: Types.ObjectId;
  platform: 'android' | 'web';
  pushToken?: string;
  /** Clave pública X25519 en base64, para los chats cifrados (F9). */
  publicKey?: string;
  /** Lo que sabe hacer con un push (`CAPACIDADES_DE_PUSH`, FL8.1). */
  capacidades?: string[];
  lastSeenAt?: Date;
  /**
   * Web vinculada con el QR (W5): el teléfono que la autorizó. Su secreto NO
   * está en constroad-auth; acá va solo su hash.
   */
  vinculadoPor?: string;
  secretoHash?: string;
  /** «Chrome en macOS», para reconocerla en «Dispositivos vinculados». */
  nombre?: string;
  /** «Mantener la sesión iniciada» apagado: la cookie muere con el navegador. */
  sesionTemporal?: boolean;
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
    avatarUrl: { type: String },
    lastSeenAt: { type: Date },
    joinPending: { type: Boolean },
    birthday: { day: Number, month: Number, year: Number },
    birthdayVisible: { type: Boolean },
    emailVerifiedAt: { type: Date },
    app: {
      appId: { type: Schema.Types.ObjectId },
      installationId: { type: Schema.Types.ObjectId },
      workspaceId: { type: Schema.Types.ObjectId },
    },
    autoReply: {
      enabled: { type: Boolean, default: false },
      text: { type: String, default: '' },
    },
    presenceMode: { type: String, enum: ['auto', 'away', 'busy', 'invisible'] },
    lastSeenHidden: { type: Boolean },
    blockedUsers: { type: [Schema.Types.ObjectId], default: undefined },
    chatLists: { type: [{ name: { type: String, required: true }, chatIds: { type: [String], default: [] } }], default: undefined },
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
/**
 * Lo mismo en las invitaciones (18/10/2026): el `email_1` viejo era único sin
 * sparse y con UNA invitación sin correo «Invitar» daba 500 para todas las
 * siguientes. En la bóveda no hay `autoIndex`: el índice de la base lo arregla
 * `scripts/fix-indexes.ts`; declararlo acá deja la base en memoria igual.
 */
invitationSchema.index({ email: 1 }, { unique: true, sparse: true });

const deviceSchema = new Schema<Device>(
  {
    deviceId: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    platform: { type: String, enum: ['android', 'web'], default: 'android' },
    pushToken: { type: String },
    // La clave PÚBLICA X25519 del dispositivo (F9). La privada nunca sale de él.
    publicKey: { type: String },
    capacidades: { type: [String], default: undefined },
    lastSeenAt: { type: Date },
    vinculadoPor: { type: String },
    secretoHash: { type: String },
    nombre: { type: String },
    sesionTemporal: { type: Boolean },
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
