import mongoose, { Schema, type Model, type Types } from 'mongoose';

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

export const BotAppModel: Model<BotApp> = (mongoose.models.BotApp as Model<BotApp>) ?? mongoose.model<BotApp>('BotApp', appSchema);
export const BotInstallationModel: Model<BotInstallation> = (mongoose.models.BotInstallation as Model<BotInstallation>) ?? mongoose.model<BotInstallation>('BotInstallation', installationSchema);
export const OAuthCodeModel: Model<OAuthCode> = (mongoose.models.OAuthCode as Model<OAuthCode>) ?? mongoose.model<OAuthCode>('OAuthCode', codeSchema);
export const BotDeliveryModel: Model<BotDelivery> = (mongoose.models.BotDelivery as Model<BotDelivery>) ?? mongoose.model<BotDelivery>('BotDelivery', deliverySchema);
