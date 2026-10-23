import mongoose, { Schema, type Model, type Types } from 'mongoose';
import type { AppCategory, BotCommand } from '@lilachat/shared';

/**
 * The bots API (`specs/BOTS-API.spec.md`). An app (Lila, through agentes) is
 * registered once by a Lilachat admin; a space's owner or admin installs it by
 * OAuth with PKCE, and each installation has its own bot user, token and
 * signing secret. Only hashes of the client secret, the codes and the tokens
 * are kept. The vault creates no index by itself: the ones declared here are
 * created by hand (`scripts/bot-indexes.ts`, with José's OK).
 */
export type BotApp = {
  _id: Types.ObjectId;
  clientId: string;
  clientSecretHash: string;
  name: string;
  avatarUrl?: string;
  redirectUris: string[];
  webhookUrl: string;
  /** Where Integraciones' «Instalar» sends an admin (agentes picks the company first, 23/10); `?space=<id>` is added. */
  installUrl?: string;
  /** Its slash commands (§c-bis), the same in every space it is installed in; `PUT /api/bots/commands` replaces them. */
  commands?: BotCommand[];
  /** Made by a developer app through its manifest (§0-bis): only that app sees or changes it, by its own `key`. */
  ownerAppId?: Types.ObjectId;
  key?: string;
  /** The directory's texts (design e-24), from the manifest. */
  description?: string;
  features?: string[];
  developer?: string;
  category?: AppCategory;
  /** The spaces that may install it, set from agentes' console (§0-ter); absent = everywhere. */
  availableIn?: Types.ObjectId[];
  createdAt: Date;
};

/** One use of a slash command: the app may answer it later through `/respond` until it expires. */
export type BotCommandRun = {
  _id: Types.ObjectId;
  installationId: Types.ObjectId;
  chatId: Types.ObjectId;
  userId: Types.ObjectId;
  command: string;
  responses: number;
  /** The last answer only the asker saw: «Enviar al canal» posts it (José, 23/10). */
  answer?: { text?: string; card?: unknown };
  expiresAt: Date;
  createdAt: Date;
};

export type BotInstallation = {
  _id: Types.ObjectId;
  appId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  botUserId: Types.ObjectId;
  tokenHash: string;
  /** It signs the events, so it must be readable (like a webhook secret); the vault is private. */
  signingSecret: string;
  installedBy: Types.ObjectId;
  revokedAt?: Date;
  /** The latest idempotency keys and what they published: the same key does not publish twice. */
  recentKeys: { key: string; messageId: string; chatId: string; seq: number }[];
  lastDelivery?: { at: Date; ok: boolean; error?: string };
  createdAt: Date;
};

export type OAuthCode = {
  _id: Types.ObjectId;
  codeHash: string;
  appId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  userId: Types.ObjectId;
  redirectUri: string;
  codeChallenge: string;
  expiresAt: Date;
  usedAt?: Date;
};

export type BotDeliveryStatus = 'pending' | 'delivered' | 'failed';
export type BotDelivery = {
  _id: Types.ObjectId;
  installationId: Types.ObjectId;
  deliveryId: string;
  event: string;
  /** The exact body that is signed and sent, the same on every attempt. */
  body: string;
  attempts: number;
  status: BotDeliveryStatus;
  nextAttemptAt?: Date;
  lastError?: string;
  createdAt: Date;
};

const appSchema = new Schema<BotApp>(
  {
    clientId: { type: String, required: true, unique: true },
    clientSecretHash: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    avatarUrl: { type: String },
    redirectUris: { type: [String], required: true },
    webhookUrl: { type: String, required: true },
    installUrl: { type: String },
    commands: { type: [{ command: String, description: String, usageHint: String, _id: false }], default: undefined },
    ownerAppId: { type: Schema.Types.ObjectId },
    key: { type: String },
    description: { type: String },
    features: { type: [String], default: undefined },
    developer: { type: String },
    category: { type: String },
    availableIn: { type: [Schema.Types.ObjectId], default: undefined },
  },
  { timestamps: true }
);

const installationSchema = new Schema<BotInstallation>(
  {
    appId: { type: Schema.Types.ObjectId, required: true },
    workspaceId: { type: Schema.Types.ObjectId, required: true, index: true },
    botUserId: { type: Schema.Types.ObjectId, required: true },
    tokenHash: { type: String, required: true, unique: true },
    signingSecret: { type: String, required: true },
    installedBy: { type: Schema.Types.ObjectId, required: true },
    revokedAt: { type: Date },
    recentKeys: { type: [{ key: String, messageId: String, chatId: String, seq: Number, _id: false }], default: [] },
    lastDelivery: { at: Date, ok: Boolean, error: String },
  },
  { timestamps: true }
);
installationSchema.index({ appId: 1, workspaceId: 1 });

const codeSchema = new Schema<OAuthCode>({
  codeHash: { type: String, required: true, unique: true },
  appId: { type: Schema.Types.ObjectId, required: true },
  workspaceId: { type: Schema.Types.ObjectId, required: true },
  userId: { type: Schema.Types.ObjectId, required: true },
  redirectUri: { type: String, required: true },
  codeChallenge: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date },
});

const deliverySchema = new Schema<BotDelivery>(
  {
    installationId: { type: Schema.Types.ObjectId, required: true },
    deliveryId: { type: String, required: true },
    event: { type: String, required: true },
    body: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'delivered', 'failed'], default: 'pending' },
    nextAttemptAt: { type: Date },
    lastError: { type: String },
  },
  { timestamps: true }
);
deliverySchema.index({ status: 1, nextAttemptAt: 1 });

// Read by _id only, and the expired ones are purged on each new use: no index of its own to create.
const commandRunSchema = new Schema<BotCommandRun>(
  {
    installationId: { type: Schema.Types.ObjectId, required: true },
    chatId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    command: { type: String, required: true },
    responses: { type: Number, default: 0 },
    answer: { type: Schema.Types.Mixed },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const BotAppModel: Model<BotApp> = (mongoose.models.BotApp as Model<BotApp>) ?? mongoose.model<BotApp>('BotApp', appSchema);
export const BotInstallationModel: Model<BotInstallation> = (mongoose.models.BotInstallation as Model<BotInstallation>) ?? mongoose.model<BotInstallation>('BotInstallation', installationSchema);
export const OAuthCodeModel: Model<OAuthCode> = (mongoose.models.OAuthCode as Model<OAuthCode>) ?? mongoose.model<OAuthCode>('OAuthCode', codeSchema);
export const BotDeliveryModel: Model<BotDelivery> = (mongoose.models.BotDelivery as Model<BotDelivery>) ?? mongoose.model<BotDelivery>('BotDelivery', deliverySchema);
export const BotCommandRunModel: Model<BotCommandRun> = (mongoose.models.BotCommandRun as Model<BotCommandRun>) ?? mongoose.model<BotCommandRun>('BotCommandRun', commandRunSchema);
