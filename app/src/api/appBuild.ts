/**
 * Every request says this app's build (backlog 32): below the minimum José
 * sets in LilaStore, the server answers 426 and the socket refuses with
 * `update_required`. Whoever gets that reports it here, and the update hook
 * checks LilaStore at once, which shows the lock screen (§97) without waiting
 * for its 30-minute pace.
 */
export const BUILD_HEADER = 'x-lilachat-build';
export const UPDATE_REQUIRED_STATUS = 426;

let currentBuild = 0;
/** Set once at start (`App.tsx`): this module stays free of Expo so the API clients remain testable. */
export function setAppBuild(build: number): void {
  currentBuild = build;
}

/**
 * Which OTA update is running (the id of the update, or `embedded` for the code
 * inside the APK). The build alone no longer identifies the code a phone runs:
 * the same APK can run any update published for its runtime.
 */
export const UPDATE_HEADER = 'x-lilachat-update';

let currentUpdate = '';
/** Set once at start (`index.ts`), like the build: `null` means the code of the APK itself. */
export function setAppUpdateId(updateId: string | null): void {
  currentUpdate = updateId ?? 'embedded';
}

/** The code running now, for a crash report: the update id, `embedded`, or '' before start sets it. */
export const appUpdateId = (): string => currentUpdate;

export function buildHeader(build: number = currentBuild, update: string = currentUpdate): Record<string, string> {
  return {
    ...(build > 0 ? { [BUILD_HEADER]: String(build) } : {}),
    ...(update ? { [UPDATE_HEADER]: update } : {}),
  };
}

const listeners = new Set<() => void>();

export function subscribeUpdateRequired(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function reportStatus(status: number | undefined): void {
  if (status === UPDATE_REQUIRED_STATUS) listeners.forEach((listener) => listener());
}
