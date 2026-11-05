import { useSyncExternalStore } from 'react';

/**
 * «Instalar Lilachat en esta computadora» (W4). The browser fires its event ONCE per page load,
 * often before anyone signs in: heard from the Shell it was lost, and Ajustes never offered to
 * install. So `main.tsx` catches it first and this module keeps it for whoever asks, never alone.
 */
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

let deferredPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function keepPrompt(next: InstallPromptEvent | null): void {
  deferredPrompt = next;
  listeners.forEach((listener) => listener());
}

export function catchInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    keepPrompt(event as InstallPromptEvent);
  });
  window.addEventListener('appinstalled', () => keepPrompt(null));
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useInstallPrompt(): { canInstall: boolean; install: () => Promise<void> } {
  const prompt = useSyncExternalStore(subscribe, () => deferredPrompt);
  return {
    canInstall: prompt !== null,
    install: async () => {
      if (!prompt) return;
      await prompt.prompt();
      await prompt.userChoice;
      keepPrompt(null);
    },
  };
}
