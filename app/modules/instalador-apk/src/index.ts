import { requireOptionalNativeModule } from 'expo';

/**
 * The update installer of our own (José, 22/10): a PackageInstaller session
 * that keeps full-screen calls on across the update. In a build without the
 * module (or on the web) it is not available, and the update goes to the
 * system installer as before.
 */
export type SessionResult =
  | { status: 'installed' | 'cancelled' }
  /** Lilachat may not install apps yet: the system installer walks the person through it. */
  | { status: 'not-allowed' }
  | { status: 'failed'; code: string; message?: string | null };

type InstaladorApk = {
  install(fileUri: string): Promise<SessionResult>;
  installedBy(): string | null;
};

const native = requireOptionalNativeModule<InstaladorApk>('InstaladorApk');

export const sessionInstaller = {
  available: (): boolean => native !== null,
  install: (fileUri: string): Promise<SessionResult> =>
    native ? native.install(fileUri) : Promise.reject(new Error('The session installer is not in this build')),
  /** The package that installed this copy, or null when unknown. */
  installedBy: (): string | null => {
    try {
      return native?.installedBy() ?? null;
    } catch {
      return null;
    }
  },
};
