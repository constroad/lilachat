/** The live locations this phone is sending (pending 11): one per message, until it ends. PURE. */
export type LiveShare = { chatId: string; seq: number; liveUntil: string };

const isShare = (raw: unknown): raw is LiveShare => {
  const share = raw as Partial<LiveShare> | null;
  return typeof share?.chatId === 'string' && Number.isInteger(share.seq) && typeof share.liveUntil === 'string';
};

/** What was stored, without the ones that already ended (or never parsed). */
export function activeShares(raw: unknown, now: Date): LiveShare[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isShare).filter((share) => new Date(share.liveUntil).getTime() > now.getTime());
}

const sameMessage = (share: LiveShare, chatId: string, seq: number) => share.chatId === chatId && share.seq === seq;

export const withShare = (shares: LiveShare[], share: LiveShare): LiveShare[] => [...withoutShare(shares, share.chatId, share.seq), share];

export const withoutShare = (shares: LiveShare[], chatId: string, seq: number): LiveShare[] => shares.filter((share) => !sameMessage(share, chatId, seq));
