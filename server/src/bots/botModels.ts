import mongoose, { Schema, type Model, type Types } from 'mongoose';
import type { AppCategory, AppForm, AppShortcut, BotCommand, NoticeTopic, ScheduleRepeat, StoredItemSettings, SuggestedSchedule } from '@lilachat/shared';

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
  /** The actions of the composer's «+» (R160); the manifest replaces them every time, an empty list removes them. */
  shortcuts?: AppShortcut[];
  /** Its notice topics (R160): the space's admin picks a channel for each (`botTopics.ts`). */
  noticeTopics?: NoticeTopic[];
  /** What it asks to see beyond the basics (pending 95); an installation keeps what was accepted. */
  scopes?: string[];
  /** Schedules it suggests, offered to the admin with one tap (agentes, 28/10); the manifest replaces them. */
  suggestedSchedules?: SuggestedSchedule[];
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
  /** Absent when it was used from the space's ⚡, outside any chat. */
  chatId?: Types.ObjectId;
  workspaceId?: Types.ObjectId;
  userId: Types.ObjectId;
  command: string;
  responses: number;
  /** The last answer only the asker saw: «Enviar al canal» posts it (José, 23/10). */
  answer?: { text?: string; card?: unknown; shareable?: false };
  /** The form the app asked for (R160): what was sent is checked against THIS, never against what the phone says. */
  form?: AppForm;
  /** What the asker's Lilachat draws (`forms`, 28/10): 2 with lists; absent = 1. */
  formsLevel?: number;
  /** Why the asker saw «no pudo responder» (23/10): the installation's health is overwritten by the next delivery. */
  failure?: { at: Date; error: string };
  /** A run started by a schedule (28/10): its answers go to the schedule's chat, and «solo si hay algo» is honored. */
  schedule?: { id: Types.ObjectId; scheduledFor: Date; onlyIfSomething: boolean; time: string };
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
  /** The channel the admin picked for each notice topic; null = «Sin canal»; absent = #general (`botTopics.ts`). */
  topicChannels?: Record<string, string | null>;
  /** Who last changed the topics' channels (`user:<id>` or `app`), when, and which topics that change touched. */
  topicChannelsBy?: string;
  topicChannelsAt?: Date;
  topicChannelsTouched?: string[];
  /** The `offer: 'chosen'` topics the app offered to THIS installation (agentes, 28/10: its alerts go to one space). */
  offeredTopics?: string[];
  /** The app's scopes accepted when installing: a newer manifest asking for more needs «Reinstalar». */
  grantedScopes?: string[];
  /** Where each command and action works, as the admin left it (`appItems.ts` in shared); absent = the default. */
  itemSettings?: StoredItemSettings;
  /** Settings v2 (all off, who, the 1:1): set on a new installation and by the migration José approves; absent = the old defaults. */
  itemsV2?: boolean;
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
    commands: { type: [{ command: String, description: String, usageHint: String, schedulable: Boolean, shareable: Boolean, _id: false }], default: undefined },
    shortcuts: { type: [{ key: String, name: String, description: String, _id: false }], default: undefined },
    noticeTopics: { type: [{ key: String, name: String, description: String, icon: String, noDefault: Boolean, offerChosen: Boolean, _id: false }], default: undefined },
    suggestedSchedules: { type: Schema.Types.Mixed, default: undefined },
    scopes: { type: [String], default: undefined },
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
    topicChannels: { type: Schema.Types.Mixed },
    topicChannelsBy: { type: String },
    topicChannelsAt: { type: Date },
    topicChannelsTouched: { type: [String], default: undefined },
    offeredTopics: { type: [String], default: undefined },
    grantedScopes: { type: [String], default: undefined },
    itemSettings: { type: Schema.Types.Mixed },
    itemsV2: { type: Boolean },
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
    chatId: { type: Schema.Types.ObjectId },
    workspaceId: { type: Schema.Types.ObjectId },
    userId: { type: Schema.Types.ObjectId, required: true },
    command: { type: String, required: true },
    responses: { type: Number, default: 0 },
    answer: { type: Schema.Types.Mixed },
    form: { type: Schema.Types.Mixed },
    formsLevel: { type: Number },
    failure: { at: Date, error: String },
    schedule: { type: Schema.Types.Mixed },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const BotAppModel: Model<BotApp> = (mongoose.models.BotApp as Model<BotApp>) ?? mongoose.model<BotApp>('BotApp', appSchema);
export const BotInstallationModel: Model<BotInstallation> = (mongoose.models.BotInstallation as Model<BotInstallation>) ?? mongoose.model<BotInstallation>('BotInstallation', installationSchema);
export const OAuthCodeModel: Model<OAuthCode> = (mongoose.models.OAuthCode as Model<OAuthCode>) ?? mongoose.model<OAuthCode>('OAuthCode', codeSchema);
export const BotDeliveryModel: Model<BotDelivery> = (mongoose.models.BotDelivery as Model<BotDelivery>) ?? mongoose.model<BotDelivery>('BotDelivery', deliverySchema);
export const BotCommandRunModel: Model<BotCommandRun> = (mongoose.models.BotCommandRun as Model<BotCommandRun>) ?? mongoose.model<BotCommandRun>('BotCommandRun', commandRunSchema);
