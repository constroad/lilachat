import type { AnimationItem } from 'lottie-web';

/**
 * Lottie for the animated pack (José 11/11, like Telegram): the light player
 * (SVG only, no expressions) loads the first time a sticker needs it, in its
 * own chunk, and each file is fetched once per page however many times it
 * shows in the chat.
 */
const animations = new Map<string, Promise<unknown>>();

function animationOf(url: string): Promise<unknown> {
  const known = animations.get(url);
  if (known) return known;
  const loading = fetch(url).then((response) => {
    if (!response.ok) throw new Error(`lottie ${response.status}`);
    return response.json() as Promise<unknown>;
  });
  // A failed fetch is forgotten, so the next bubble tries again.
  loading.catch(() => animations.delete(url));
  animations.set(url, loading);
  return loading;
}

/** Plays the sticker's Lottie inside `container`; rejects when the file or the player cannot load. */
export async function playLottieSticker(container: HTMLElement, url: string): Promise<AnimationItem> {
  const [{ default: lottie }, animationData] = await Promise.all([import('lottie-web/build/player/lottie_light'), animationOf(url)]);
  return lottie.loadAnimation({ container, renderer: 'svg', loop: true, autoplay: true, animationData, rendererSettings: { preserveAspectRatio: 'xMidYMid meet' } });
}
