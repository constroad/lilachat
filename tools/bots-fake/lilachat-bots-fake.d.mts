/** Types of the fake, for the parity test in `server/src/bots/fake.test.ts`. */
export type FakeOptions = { port?: number; clientId?: string; clientSecret?: string; redirectUri?: string; webhookUrl?: string; spaceName?: string; channels?: { id: string; name: string; visibility: 'public' | 'private' }[]; members?: { id: string; name: string; phone: string; role: string; title?: string; area?: string }[]; retryDelaysMs?: number[] };
export type RunningFake = { port: number; close: () => Promise<void>; emit: (type: string, data?: Record<string, unknown>) => string | null; reset: () => void };
export function startFake(options?: FakeOptions): Promise<RunningFake>;
